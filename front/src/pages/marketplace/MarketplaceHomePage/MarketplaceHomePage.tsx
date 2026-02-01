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
import { ChannelCard, CampaignCard, Skeleton } from '@components'
import {
  useChannelsQuery,
  useCampaignsQuery,
} from '@store-new'
import { useUser } from '@store'
import {ROUTES_NAME} from '../../../routes';

import styles from './MarketplaceHomePage.module.scss';

export const MarketplaceHomePage = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'channels' | 'campaigns'>('channels')
  const { user: currentUser } = useUser()

  const tabs = [
    { id: 1, label: 'Channels', value: 'channels' },
    // { id: 2, label: 'Campaigns', value: 'campaigns' },
  ]

  const handleChangeActiveTab = (value: string) => {
    setActiveTab(value as 'channels' | 'campaigns')
  }

  const { data: channels, isLoading: channelsLoading, error: channelsError, status: channelsStatus } = useChannelsQuery({
    limit: 20,
  })

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

  const isLoading = channelsLoading || campaignsLoading;
  const activeTabIndex = tabs.findIndex((tab) => tab.value === activeTab)

  const contentSlides = [
    <BlockNew gap={8}>
      {(!channels || channels.length === 0) && (
          <Text type="text" color="secondary" align="center">
            No channels available
          </Text>
      )}
      {channels?.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
      ))}
    </BlockNew>,
    // <BlockNew gap={8}>
    //   {(!campaigns || campaigns.length === 0) && (
    //       <Text type="text" color="secondary" align="center">
    //         No campaigns available
    //       </Text>
    //   )}
    //   {campaigns?.map((campaign) => (
    //       <CampaignCard key={campaign.id} campaign={campaign} />
    //   ))}
    // </BlockNew>
  ];
  return (
    <Page back={false}>
      <PageLayout>
      <TelegramMainButton text="Add bot to Channel" onClick={handleAddChat} />

      <BlockNew gap={12} className={styles.chatsBlock}>
        <BlockNew>
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
              Incoming Ads
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
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CHANNELS)}
            >
              My Channels
            </Button>
            <Button
              type="basic"
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CAMPAIGNS)}
            >
              My Campaigns
            </Button>
          </BlockNew>
        </BlockNew>

        {/*<BlockNew justify="between" align="center" row padding="0 16px">*/}
        {/*  <TabsContainer*/}
        {/*    tabs={tabs}*/}
        {/*    activeTab={activeTab}*/}
        {/*    onChangeTab={handleChangeActiveTab as (value: string) => void}*/}
        {/*  />*/}
        {/*  {currentUser && (*/}
        {/*    <Button*/}
        {/*      type="primary"*/}
        {/*      onClick={*/}
        {/*        activeTab === 'channels' ? handleCreateListing : handleCreateCampaign*/}
        {/*      }*/}
        {/*    >*/}
        {/*      {activeTab === 'channels' ? 'List Your Channel' : 'Create Campaign'}*/}
        {/*    </Button>*/}
        {/*  )}*/}
        {/*</BlockNew>*/}

        {isLoading ? (
            <Skeleton />
        ) : (
            <div
                className={styles.contentSlider}
                style={{
                  transform: `translateX(-${activeTabIndex * 50}%)`,
                  width: `${contentSlides.length * 100}%`,
                }}
            >
              {contentSlides.map((slide, index) => (
                  <div className={styles.contentSlide} key={index}>
                    {slide}
                  </div>
              ))}
            </div>
        )}
      </BlockNew>
      </PageLayout>
    </Page>
  )
}
