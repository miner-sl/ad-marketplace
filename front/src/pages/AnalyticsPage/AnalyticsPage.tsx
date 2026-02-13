import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Group,
  GroupItem,
  Spinner,
} from '@components'
import { useUserTransactionAnalyticsQuery } from '@store-new'

function formatTon(value: string): string {
  const n = parseFloat(value)
  return n.toFixed(4) + ' TON'
}

export function AnalyticsPage() {
  const { data: analytics, isLoading, error } = useUserTransactionAnalyticsQuery()

  if (isLoading) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
          <BlockNew padding="16px">
            <Spinner size={24} />
            <Text type="text" color="secondary">Loading analytics...</Text>
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

  if (!analytics) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
          <BlockNew padding="16px">
            <Text type="text" color="secondary">No analytics data</Text>
          </BlockNew>
        </PageLayout>
      </Page>
    )
  }

  const net = parseFloat(analytics.net_balance_change)
  const count = parseInt(analytics.transaction_count, 10)

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className="analytics-container">
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              Wallet Analytics
            </Text>
            <Text type="caption" color="secondary">
              Summary of confirmed transactions
            </Text>
          </BlockNew>

          <Group header="SUMMARY">
            <GroupItem
              text="Total received"
              after={
                <Text type="text" weight="bold" color="accent">
                  {formatTon(analytics.total_received)}
                </Text>
              }
            />
            <GroupItem
              text="Total sent"
              after={
                <Text type="text" weight="bold">
                  {formatTon(analytics.total_sent)}
                </Text>
              }
            />
            <GroupItem
              text="Net balance change"
              after={
                <Text
                  type="text"
                  weight="bold"
                  color={net >= 0 ? 'accent' : 'danger'}
                >
                  {net >= 0 ? '+' : ''}{formatTon(analytics.net_balance_change)}
                </Text>
              }
            />
            <GroupItem
              text="Transaction count"
              after={
                <Text type="text" weight="medium">
                  {count}
                </Text>
              }
            />
          </Group>
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
