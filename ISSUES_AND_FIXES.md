# Критические проблемы и исправления

## 🔴 Критические проблемы

### 1. Race Conditions в мутирующих операциях

#### Проблема 1.1: Двойное подтверждение платежа
**Файл:** `src/cron/jobs.ts:67-87`, `src/services/dealFlow.ts:67-98`

**Проблема:**
- Cron job и ручное подтверждение могут обработать один платеж дважды
- Нет проверки, что статус уже изменился между чтением и записью

**Сценарий:**
1. Cron job читает deal со статусом `payment_pending`
2. Пользователь вручную подтверждает платеж → статус `paid`
3. Cron job все еще обрабатывает старые данные → двойное обновление

**Исправление:** Использовать `UPDATE ... WHERE status = 'payment_pending'` с проверкой статуса

#### Проблема 1.2: Двойной перевод средств
**Файл:** `src/bot/handlers.ts:2025-2033`

**Проблема:**
- Два пользователя могут одновременно нажать "Confirm Publication"
- Оба запроса прочитают статус `verified` и оба переведут средства

**Исправление:** Использовать транзакцию с `SELECT FOR UPDATE` или `UPDATE ... WHERE status = 'verified'`

### 2. Отсутствие транзакций БД

#### Проблема 2.1: `acceptDeal` - частичное обновление
**Файл:** `src/services/dealFlow.ts:44-59`

**Проблема:**
```typescript
await db.query(`UPDATE deals ...`);  // Операция 1
await db.query(`INSERT INTO deal_messages ...`);  // Операция 2
```

Если вторая операция упадет, первая уже выполнена → несогласованное состояние

**Исправление:** Обернуть в транзакцию

#### Проблема 2.2: `confirmPayment` - множественные UPDATE
**Файл:** `src/services/dealFlow.ts:85-95`

**Проблема:**
```typescript
const updated = await DealModel.confirmPayment(dealId, txHash);  // UPDATE 1: status = 'paid'
await DealModel.updateStatus(dealId, finalStatus);  // UPDATE 2: может быть 'scheduled' или 'paid'
```

Второй UPDATE может перезаписать первый, если между ними статус изменился

**Исправление:** Объединить в один UPDATE или использовать транзакцию

#### Проблема 2.3: `handleConfirmPublication` - перевод средств + обновление статуса
**Файл:** `src/bot/handlers.ts:2025-2033`

**Проблема:**
```typescript
const txHash = await TONService.releaseFunds(...);  // Блокчейн операция
await DealModel.markCompleted(deal.id);  // UPDATE БД
```

Если UPDATE упадет, средства уже переведены → несогласованность

**Исправление:** Сначала обновить статус, потом переводить средства (или использовать компенсирующую транзакцию)

### 3. Логические ошибки в флоу

#### Проблема 3.1: Двойное обновление статуса в `confirmPayment`
**Файл:** `src/services/dealFlow.ts:85-89`

**Проблема:**
```typescript
const updated = await DealModel.confirmPayment(dealId, txHash);  // Устанавливает status = 'paid'
// ...
await DealModel.updateStatus(dealId, finalStatus);  // Может установить 'paid' снова или 'scheduled'
```

`DealModel.confirmPayment` уже устанавливает статус `paid`, второй вызов избыточен

#### Проблема 3.2: Нет защиты от повторной обработки в cron job
**Файл:** `src/cron/jobs.ts:65-87`

**Проблема:**
- Cron job читает все deals со статусом `payment_pending`
- Не проверяет, что статус не изменился во время обработки
- Может обработать один и тот же платеж несколько раз

### 4. Проблема: Buyer не подтверждает получение

#### Текущая ситуация:
- Seller публикует пост → статус `posted`
- Проходит 24 часа → статус `verified` (автоматически)
- **Проблема:** Если buyer не нажимает "Confirm Publication", средства остаются в escrow навсегда

#### Отсутствующие механизмы:
1. **Timeout для verified статуса** - автоматический release через N дней
2. **Dispute механизм** - возможность оспорить сделку
3. **Автоматический release** - если buyer не подтверждает, автоматически переводить через определенное время

## ✅ Рекомендуемые исправления

### Исправление 1: Добавить транзакции для атомарных операций

```typescript
// Пример для acceptDeal
static async acceptDeal(dealId: number, channelOwnerId: number, telegramUserId?: number): Promise<any> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Проверка статуса в транзакции
    const deal = await client.query(
      `SELECT * FROM deals WHERE id = $1 FOR UPDATE`,
      [dealId]
    );
    
    if (!deal.rows[0] || deal.rows[0].status !== 'pending' && deal.rows[0].status !== 'negotiating') {
      throw new Error(`Cannot accept deal in status: ${deal.rows[0].status}`);
    }
    
    // UPDATE и INSERT в одной транзакции
    await client.query(`UPDATE deals ...`);
    await client.query(`INSERT INTO deal_messages ...`);
    
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Исправление 2: Защита от race conditions через UPDATE с условием

```typescript
// Вместо чтения + обновления
const deal = await DealModel.findById(dealId);
if (deal.status !== 'verified') throw Error();
await DealModel.markCompleted(deal.id);

// Использовать атомарный UPDATE
const result = await db.query(
  `UPDATE deals 
   SET status = 'completed', updated_at = CURRENT_TIMESTAMP
   WHERE id = $1 AND status = 'verified'
   RETURNING *`,
  [dealId]
);

if (result.rows.length === 0) {
  throw new Error('Deal is not in verified status or already completed');
}
```

### Исправление 3: Защита от двойной обработки платежа

```typescript
// В cron job
const result = await db.query(
  `UPDATE deals 
   SET status = 'paid', payment_tx_hash = $1, payment_confirmed_at = CURRENT_TIMESTAMP
   WHERE id = $2 AND status = 'payment_pending'
   RETURNING *`,
  [txHash, deal.id]
);

if (result.rows.length === 0) {
  // Уже обработан другим процессом
  continue;
}
```

### Исправление 4: Добавить timeout для verified статуса

```typescript
// В cron job добавить проверку verified deals с timeout
static async findVerifiedDealsWithTimeout(): Promise<Deal[]> {
  const timeoutHours = parseInt(process.env.VERIFIED_TIMEOUT_HOURS || '168', 10); // 7 дней по умолчанию
  const result = await db.query(
    `SELECT * FROM deals 
     WHERE status = 'verified' 
     AND post_verification_until < CURRENT_TIMESTAMP - INTERVAL '${timeoutHours} hours'
     ORDER BY post_verification_until ASC`
  );
  return result.rows;
}

// Автоматически переводить средства если buyer не подтвердил
// После N дней после verification
```

### Исправление 5: Добавить dispute механизм

```sql
-- Добавить в schema
ALTER TABLE deals ADD COLUMN dispute_reason TEXT;
ALTER TABLE deals ADD COLUMN dispute_opened_at TIMESTAMP;
ALTER TABLE deals ADD COLUMN auto_release_at TIMESTAMP; -- Автоматический release через N дней
```

## 📋 Чеклист исправлений

- [ ] Добавить транзакции для всех мутирующих операций
- [ ] Использовать `SELECT FOR UPDATE` для критических секций
- [ ] Использовать атомарные UPDATE с условиями статуса
- [ ] Добавить защиту от двойной обработки платежей
- [ ] Добавить timeout для verified статуса (автоматический release)
- [ ] Добавить dispute механизм
- [ ] Добавить логирование всех критических операций
- [ ] Добавить idempotency keys для операций с блокчейном
- [ ] Добавить retry механизм для failed транзакций
- [ ] Добавить мониторинг для обнаружения зависших deals
