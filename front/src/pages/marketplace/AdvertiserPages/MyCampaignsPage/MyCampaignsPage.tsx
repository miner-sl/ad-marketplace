import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Text,
} from '@components'
import { useCampaignsQuery } from '@store-new'
import { ROUTES_NAME } from '@routes'

import styles from './MyCampaignsPage.module.scss'

export const MyCampaignsPage = () => {
  const navigate = useNavigate()
  const { data: campaigns, isLoading } = useCampaignsQuery()

  // Filter campaigns by advertiser_id
  // For now, showing all campaigns - backend should filter by advertiser_id
  const myCampaigns = campaigns || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <TelegramMainButton
          text="Create New Campaign"
          onClick={() => navigate(ROUTES_NAME.MARKETPLACE_ADVERTISER_CREATE_CAMPAIGN)}
        />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              My Campaigns
            </Text>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : myCampaigns.length > 0 ? (
            <BlockNew gap={8}>
              {myCampaigns.map((campaign) => (
                <BlockNew
                  key={campaign.id}
                  paddingValue={16}
                  marginValue={8}
                  onClick={() => {
                    // Navigate to campaign details if route exists
                    // navigate(`/marketplace/campaigns/${campaign.id}`)
                  }}
                >
                  <Text type="title2" weight="bold">
                    {campaign.title}
                  </Text>
                  {campaign.description && (
                    <Text type="caption" color="secondary">
                      {campaign.description.slice(0, 100)}
                      {campaign.description.length > 100 ? '...' : ''}
                    </Text>
                  )}
                  <BlockNew row gap={12} marginValue={8}>
                    {campaign.budget_ton && (
                      <Text type="caption" color="secondary">
                        Budget: {campaign.budget_ton} TON
                      </Text>
                    )}
                    {campaign.target_subscribers_min && (
                      <Text type="caption" color="secondary">
                        Min subscribers: {campaign.target_subscribers_min}
                      </Text>
                    )}
                  </BlockNew>
                  <Text type="caption" color="accent">
                    Status: {campaign.status}
                  </Text>
                </BlockNew>
              ))}
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              You don't have any campaigns yet. Create one to get started!
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
