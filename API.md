# API Документация

Базовый URL: `http://localhost:3000/api`

## Каналы

### GET `/api/channels`
Список каналов с фильтрами.

**Query:** `min_subscribers`, `max_subscribers`, `min_price`, `max_price`, `ad_format`, `limit`, `offset`

**Пример:**
```bash
curl "http://localhost:3000/api/channels?min_subscribers=10000&ad_format=post&limit=20"
```

---

### GET `/api/channels/:id`
Информация о канале.

**Пример:**
```bash
curl "http://localhost:3000/api/channels/1"
```

---

### POST `/api/channels`
Регистрация канала.

**Body:**
```json
{
  "telegram_id": 123456789,
  "telegram_channel_id": -1001234567890,
  "bot_token": "123456:ABC-DEF..."
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/channels" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 123456789,
    "telegram_channel_id": -1001234567890,
    "bot_token": "123456:ABC-DEF..."
  }'
```

---

### POST `/api/channels/:id/pricing`
Установить цену за формат.

**Body:**
```json
{
  "ad_format": "post",
  "price_ton": 25.5
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/channels/1/pricing" \
  -H "Content-Type: application/json" \
  -d '{"ad_format": "post", "price_ton": 25.5}'
```

---

### POST `/api/channels/:id/refresh-stats`
Обновить статистику канала.

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/channels/1/refresh-stats"
```

---

## Сделки

### GET `/api/deals`
Список сделок.

**Query:** `user_id`, `status`, `deal_type`, `limit`

**Пример:**
```bash
curl "http://localhost:3000/api/deals?user_id=1&status=paid"
```

---

### GET `/api/deals/:id`
Информация о сделке (включая сообщения и креатив).

**Пример:**
```bash
curl "http://localhost:3000/api/deals/1"
```

---

### POST `/api/deals`
Создать сделку.

**Body:**
```json
{
  "deal_type": "listing",
  "channel_id": 1,
  "channel_owner_id": 1,
  "advertiser_id": 2,
  "ad_format": "post",
  "price_ton": 25.5
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals" \
  -H "Content-Type: application/json" \
  -d '{
    "deal_type": "listing",
    "channel_id": 1,
    "channel_owner_id": 1,
    "advertiser_id": 2,
    "ad_format": "post",
    "price_ton": 25.5
  }'
```

---

### POST `/api/deals/:id/accept`
Принять сделку (владелец канала).

**Body:**
```json
{
  "channel_owner_id": 1
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/accept" \
  -H "Content-Type: application/json" \
  -d '{"channel_owner_id": 1}'
```

---

### POST `/api/deals/:id/payment`
Подтвердить оплату.

**Body:**
```json
{
  "tx_hash": "0x123..."
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/payment" \
  -H "Content-Type: application/json" \
  -d '{"tx_hash": "0x123..."}'
```

---

### POST `/api/deals/:id/creative`
Отправить креатив на утверждение.

**Body:**
```json
{
  "channel_owner_id": 1,
  "content_type": "text",
  "content_data": {
    "text": "Check out our product! 🚀"
  }
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/creative" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_owner_id": 1,
    "content_type": "text",
    "content_data": {"text": "Check out our product! 🚀"}
  }'
```

---

### POST `/api/deals/:id/creative/approve`
Утвердить креатив.

**Body:**
```json
{
  "advertiser_id": 2
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/creative/approve" \
  -H "Content-Type: application/json" \
  -d '{"advertiser_id": 2}'
```

---

### POST `/api/deals/:id/creative/revision`
Запросить правки креатива.

**Body:**
```json
{
  "advertiser_id": 2,
  "notes": "Добавьте больше информации о продукте"
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/creative/revision" \
  -H "Content-Type: application/json" \
  -d '{
    "advertiser_id": 2,
    "notes": "Добавьте больше информации о продукте"
  }'
```

---

### POST `/api/deals/:id/schedule`
Запланировать публикацию.

**Body:**
```json
{
  "post_time": "2026-01-26T10:00:00Z"
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/schedule" \
  -H "Content-Type: application/json" \
  -d '{"post_time": "2026-01-26T10:00:00Z"}'
```

---

### POST `/api/deals/:id/cancel`
Отменить сделку.

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/deals/1/cancel"
```

---

## Кампании

### GET `/api/campaigns`
Список кампаний.

**Query:** `advertiser_id`, `status`, `min_budget`, `max_budget`, `limit`, `offset`

**Пример:**
```bash
curl "http://localhost:3000/api/campaigns?advertiser_id=2&status=active"
```

---

### GET `/api/campaigns/:id`
Информация о кампании.

**Пример:**
```bash
curl "http://localhost:3000/api/campaigns/1"
```

---

### POST `/api/campaigns`
Создать кампанию.

**Body:**
```json
{
  "telegram_id": 987654321,
  "title": "Tech Product Launch",
  "description": "Looking for tech channels",
  "budget_ton": 500,
  "target_subscribers_min": 10000,
  "preferred_formats": ["post"]
}
```

**Пример:**
```bash
curl -X POST "http://localhost:3000/api/campaigns" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 987654321,
    "title": "Tech Product Launch",
    "budget_ton": 500,
    "target_subscribers_min": 10000,
    "preferred_formats": ["post"]
  }'
```

---

### PUT `/api/campaigns/:id`
Обновить кампанию.

**Body:**
```json
{
  "title": "Updated Title",
  "budget_ton": 600,
  "status": "active"
}
```

**Пример:**
```bash
curl -X PUT "http://localhost:3000/api/campaigns/1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "budget_ton": 600
  }'
```

---

## Статусы сделок

`pending` → `approved` → `paid` → `creative_submitted` → `creative_approved` → `scheduled` → `posted` → `verified` → `completed`

Альтернативные: `cancelled`, `refunded`

---

## Health Check

### GET `/health`

**Пример:**
```bash
curl "http://localhost:3000/health"
```

**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-25T00:00:00.000Z"
}
```

---

## Ошибки

Все ошибки возвращаются в формате:
```json
{
  "error": "Описание ошибки"
}
```

**Коды:** `200` - успех, `400` - валидация, `404` - не найдено, `500` - ошибка сервера
