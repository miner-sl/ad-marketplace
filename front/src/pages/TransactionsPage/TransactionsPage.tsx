import {BlockNew, Group, GroupItem, Page, PageLayout, Spinner, TelegramBackButton, Text,} from '@components'
import {useUserTransactionsQuery} from '@store-new'
import {goTo, hapticFeedback} from '@utils'
import type {LedgerTransactionDTO} from "@types";

function formatDate(value: string | null): string {
  if (!value) return '—';

  const tmp = new Date(value);

  const datePart = tmp.toLocaleDateString(undefined, { dateStyle: 'short' });
  const timePart = tmp.toLocaleTimeString(undefined, { timeStyle: 'short' });

  return `${datePart} ${timePart}`;
}

function formatAmount(amount: string): string {
  const n = parseFloat(amount)
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(4)} USDT`
}

export function TransactionsPage() {
  const { data: transactions = [], isLoading, error } = useUserTransactionsQuery();

  if (isLoading) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
          <BlockNew padding="16px">
            <Spinner size={24} />
            <Text type="text" color="secondary">Loading transactions...</Text>
          </BlockNew>
        </PageLayout>
      </Page>
    )
  }

  if (error) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
          <BlockNew padding="16px">
            <Text type="text" color="danger">{(error as Error).message}</Text>
          </BlockNew>
        </PageLayout>
      </Page>
    )
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className="transactions-container">
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              Transactions
            </Text>
            <Text type="caption" color="secondary">
              Confirmed ledger history for your wallet
            </Text>
          </BlockNew>

          {transactions.length === 0 ? (
            <BlockNew padding="16px">
              <Text type="text" color="secondary" align="center">
                No transactions yet
              </Text>
            </BlockNew>
          ) : (
            <Group>
              {transactions.map((tx: LedgerTransactionDTO) => (
                <GroupItem
                  key={`${tx.tx_hash ?? tx.confirmed_at}-${tx.amount}`}
                  text={
                    <BlockNew row align="center" justify="between" gap={8} padding="0px 11px 0 0px">
                      <Text type="text" weight="medium">
                        {tx.type}
                      </Text>
                      <Text
                        type="text"
                        weight="bold"
                        color={parseFloat(tx.amount) >= 0 ? 'accent' : 'danger'}
                      >
                        {formatAmount(tx.amount)}
                      </Text>
                    </BlockNew>
                  }
                  description={
                    <BlockNew gap={4}>
                      <Text type="caption2" color="tertiary">
                        {tx.entry_type.replace(/_/g, ' ')} · {formatDate(tx.confirmed_at)}
                      </Text>
                      {/*{(tx.from || tx.to) && (*/}
                      {/*  <Text type="caption2" color="tertiary">*/}
                      {/*    {tx.type === 'Incoming' ? tx.from : tx.to}*/}
                      {/*  </Text>*/}
                      {/*)}*/}
                    </BlockNew>
                  }
                  chevron={tx.txLink !== undefined}
                  onClick={() => {
                    if (tx.txLink) {
                      hapticFeedback('soft');
                      goTo(tx.txLink);
                    }
                  }}
                />
              ))}
            </Group>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
