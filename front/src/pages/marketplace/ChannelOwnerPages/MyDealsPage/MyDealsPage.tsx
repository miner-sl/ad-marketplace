import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
  Group,
  GroupItem,
  Image,
  DealStatusBadge,
} from '@components'
import { useDealsQuery } from '@store-new'
import { useTelegramUser } from '@hooks'
import { ROUTES_NAME } from '@routes'
import { pluralize, hapticFeedback } from '@utils'
import styles from './MyDealsPage.module.scss'

export const MyDealsPage = () => {
  const navigate = useNavigate()
  const userId = useTelegramUser()?.id;

  const { data: deals, isLoading } = useDealsQuery({
    user_id: userId,
  })

  const myDeals = deals || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              My Deals
            </Text>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : myDeals.length > 0 ? (
            <BlockNew id="deals-container">
              <Group>
                {myDeals.map((deal) => {
                  const channelName = deal.channel?.title || `@${deal.channel?.username || 'channel'}`
                  const subscribersCount = deal.channel?.stats?.subscribers_count || 0

                  return (
                    <GroupItem
                      key={deal.id}
                      text={
                        <BlockNew row align="center" gap={8}>
                          <Text type="text" weight="bold">
                            Deal #{deal.id}
                          </Text>
                          <DealStatusBadge status={deal.status} />
                        </BlockNew>
                      }
                      description={
                        <BlockNew gap={6} row align="center" fadeIn={false}>
                          <Text type="caption2" color="tertiary">
                            {channelName}
                          </Text>
                          {subscribersCount > 0 && (
                            <>
                              <Text type="caption2" color="tertiary">
                                •
                              </Text>
                              <Text type="caption2" color="tertiary">
                                {pluralize(
                                  ['member', 'members', 'members'],
                                  subscribersCount
                                )}
                              </Text>
                            </>
                          )}
                          <Text type="caption2" color="tertiary">
                            • {deal.price_ton?.toFixed?.(2) || '-'} USDT
                          </Text>
                        </BlockNew>
                      }
                      chevron
                      before={
                        <Image
                          src={null}
                          size={40}
                          borderRadius={50}
                          fallback={channelName}
                        />
                      }
                      onClick={() => {
                        hapticFeedback('soft')
                        navigate(ROUTES_NAME.MARKETPLACE_DEAL_DETAILS.replace(':id', deal.id.toString()))
                      }}
                    />
                  )
                })}
              </Group>
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              You don't have any deals yet.
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
