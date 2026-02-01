import {useCallback, useState} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramMainButton,
  Button,
  Text,
  TabsContainer,
} from '@components'
import { ChannelCard, CampaignCard } from '@components'
import {
  useChannelsQuery,
  useCampaignsQuery,
} from '@store-new'
import { useUser } from '@store'
import {ROUTES_NAME} from "../../../routes/routes.ts";

export const MarketplaceHomePage = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'channels' | 'campaigns'>('channels')
  const { user: currentUser } = useUser()

  const tabs = [
    { id: 1, label: 'Channels', value: 'channels' },
    { id: 2, label: 'Campaigns', value: 'campaigns' },
  ]

  const handleChangeActiveTab = (value: string) => {
    setActiveTab(value as 'channels' | 'campaigns')
  }

  const { data: channels, isLoading: channelsLoading, error: channelsError, status: channelsStatus } = useChannelsQuery({
    limit: 20,
  })

  console.log({channels, channelsLoading, channelsError, channelsStatus});
  const { data: campaigns, isLoading: campaignsLoading } = useCampaignsQuery({
    status: 'active',
    limit: 20,
  })

  console.log('MarketplaceHomePage render:', {
    channelsStatus,
    channelsLoading,
    channelsError,
    channels,
  })

  const handleCreateListing = () => {
    navigate('/marketplace/channel-owner/create-listing')
  }

  const handleCreateCampaign = () => {
    navigate('/marketplace/advertiser/create-campaign')
  }

  const handleAddChat = useCallback(
    () => navigate('/admin/add-telegram-chat'),
    []
  )

  return (
    <Page back={false}>
      <PageLayout>
      <TelegramMainButton text="Add Group or Channel" onClick={handleAddChat} />

      <BlockNew gap={16}>
        <BlockNew padding="0 16px">
          <BlockNew marginValue={8}>
            <Text type="text" color="secondary">
              Connect channel owners with advertisers
            </Text>
          </BlockNew>
        </BlockNew>

        <BlockNew gap={4}>
          <BlockNew gap={8} row>
            <Button
              type="basic"
              onClick={() => navigate('/browse_channels')}
            >
              Browse Channels
            </Button>
            <Button
              type="basic"
              onClick={() => navigate('/requests')}
            >
              Incoming Requests
            </Button>
          </BlockNew>
          <BlockNew gap={8} row>
            <Button
              type="basic"
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_CHANNEL_OWNER_MY_DEALS)}
            >
              My Deals
            </Button>
            <Button
              type="basic"
              onClick={() => navigate('/')}
            >
              My Channels
            </Button>
            <Button
              type="basic"
              onClick={() => navigate('/')}
            >
              My Campaigns
            </Button>
          </BlockNew>
        </BlockNew>

        <BlockNew justify="between" align="center" row padding="0 16px">
          <TabsContainer
            tabs={tabs}
            activeTab={activeTab}
            onChangeTab={handleChangeActiveTab as (value: string) => void}
          />
          {currentUser && (
            <Button
              type="primary"
              onClick={
                activeTab === 'channels' ? handleCreateListing : handleCreateCampaign
              }
            >
              {activeTab === 'channels' ? 'List Your Channel' : 'Create Campaign'}
            </Button>
          )}
        </BlockNew>

        {activeTab === 'channels' && (
          <>
            {channelsLoading ? (
              <Text type="text" color="secondary" align="center">
                Loading channels...
              </Text>
            ) : channels && channels.length > 0 ? (
              <BlockNew gap={8}>
                {channels.map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} />
                ))}
              </BlockNew>
            ) : (
              <Text type="text" color="secondary" align="center">
                No channels available
              </Text>
            )}
          </>
        )}

        {activeTab === 'campaigns' && (
          <>
            {campaignsLoading ? (
              <Text type="text" color="secondary" align="center">
                Loading campaigns...
              </Text>
            ) : campaigns && campaigns.length > 0 ? (
              <BlockNew gap={8}>
                {campaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </BlockNew>
            ) : (
              <Text type="text" color="secondary" align="center">
                No active campaigns
              </Text>
            )}
          </>
        )}
      </BlockNew>
      </PageLayout>
    </Page>
  )
}
