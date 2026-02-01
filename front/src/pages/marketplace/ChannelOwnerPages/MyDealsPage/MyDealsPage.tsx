import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
} from '@components'
import { DealCard } from '@components'
import { useDealsQuery } from '@store-new'
import { useTelegramUser } from '@hooks'
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
            <Text type="hero" weight="bold">
              My Deals
            </Text>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : myDeals.length > 0 ? (
            <BlockNew gap={8}>
              {myDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onClick={() => navigate(`/marketplace/deals/${deal.id}`)}
                />
              ))}
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
