import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  Text,
} from '@components'
import { DealCard, CampaignCard } from '@components'
import { useDealsQuery, useCampaignsQuery } from '@store-new'
import { useUser } from '@store'
import { ROUTES_NAME } from '@routes'
import styles from './RequestsPage.module.scss'

export const RequestsPage = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: deals, isLoading: dealsLoading } = useDealsQuery({
    user_id: user?.id,
    status: 'pending',
  })
  const { data: campaigns } = useCampaignsQuery({
    status: 'active',
  })

  // Get deals where user is channel owner and deal is pending (incoming requests)
  const incomingRequests =
    deals?.filter(
      (deal) =>
        deal.channel_owner_id === user?.id &&
        deal.status === 'pending' &&
        deal.deal_type === 'campaign'
    ) || []

  // Get active campaigns that match user's channels
  const matchingCampaigns = campaigns?.filter((campaign) => {
    // This would need backend logic to match campaigns to channels
    // For now, show all active campaigns
    return campaign.status === 'active'
  })

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="hero" weight="bold">
              Incoming Requests
            </Text>
            <BlockNew marginValue={8}>
              <Text type="text" color="secondary">
                Ad requests from advertisers for your channels
              </Text>
            </BlockNew>
          </BlockNew>

          {dealsLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading requests...
            </Text>
          ) : incomingRequests.length > 0 ? (
            <BlockNew gap={8}>
              {incomingRequests.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onClick={() =>
                    navigate(
                      ROUTES_NAME.MARKETPLACE_DEAL_DETAILS.replace(
                        ':id',
                        deal.id.toString()
                      )
                    )
                  }
                />
              ))}
            </BlockNew>
          ) : (
            <BlockNew gap={12}>
              <Text type="text" color="secondary" align="center">
                No incoming requests at the moment
              </Text>
              {matchingCampaigns && matchingCampaigns.length > 0 && (
                <BlockNew gap={8}>
                  <Text type="title2" weight="bold" align="center">
                    Active Campaigns You Can Apply To
                  </Text>
                  {matchingCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onClick={() =>
                        navigate(`/marketplace/campaigns/${campaign.id}`)
                      }
                    />
                  ))}
                </BlockNew>
              )}
            </BlockNew>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
