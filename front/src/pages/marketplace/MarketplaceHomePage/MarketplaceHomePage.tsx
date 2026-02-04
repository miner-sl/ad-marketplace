import {useCallback, useState} from 'react'
import {useNavigate} from 'react-router-dom'

import {
  BlockNew,
  Button,
  Page,
  PageLayout,
  Skeleton,
  TelegramMainButton,
  Text,
  Group,
  GroupItem,
  Image,
  Icon,
} from '@components'
import {useCampaignsQuery, useChannelsQuery,} from '@store-new'
import {ROUTES_NAME} from '@routes'
import {pluralize, hapticFeedback} from '@utils'

import styles from './MarketplaceHomePage.module.scss';

export const MarketplaceHomePage = () => {
  const navigate = useNavigate()
  const [activeTab, _] = useState<'channels' | 'campaigns'>('channels')
  // const { user: currentUser } = useUser()

  const tabs = [
    { id: 1, label: 'Channels', value: 'channels' },
    // { id: 2, label: 'Campaigns', value: 'campaigns' },
  ]
  //
  // const handleChangeActiveTab = (value: string) => {
  //   setActiveTab(value as 'channels' | 'campaigns')
  // }

  const { data: channels, isLoading: channelsLoading } = useChannelsQuery({
    limit: 20,
  })

  // const { data: campaigns, isLoading: campaignsLoading } = useCampaignsQuery({
  const { isLoading: campaignsLoading } = useCampaignsQuery({
    status: 'active',
    limit: 20,
  })

  //
  // const handleCreateListing = () => {
  //   navigate('/marketplace/channel-owner/create-listing')
  // }
  //
  // const handleCreateCampaign = () => {
  //   navigate('/marketplace/advertiser/create-campaign')
  // }

  const handleAddChat = useCallback(
    () => navigate('/admin/add-telegram-chat'),
    []
  )

  const isLoading = channelsLoading || campaignsLoading;
  const activeTabIndex = tabs.findIndex((tab) => tab.value === activeTab)

  const contentSlides = [
    <BlockNew id="channels-container">
      {(!channels || channels.length === 0) ? (
        <Text type="text" color="secondary" align="center">
          No channels available
        </Text>
      ) : (
        <Group>
          {channels.map((channel) => {
            const channelName = channel.title || `@${channel.username || 'channel'}`
            const subscribersCount = channel.stats?.subscribers_count || 0
            const postPricing = channel.pricing?.find((p) => p.ad_format === 'post' && p.is_active)
            
            return (
              <GroupItem
                key={channel.id}
                text={
                  <BlockNew row align="center" gap={8}>
                    <Text type="text" weight="bold">
                      {channelName}
                    </Text>
                    {channel.is_verified && (
                      <Icon name="verified" size={16} />
                    )}
                  </BlockNew>
                }
                description={
                  <BlockNew gap={6} row align="center" fadeIn={false}>
                    {subscribersCount > 0 && (
                      <>
                        <Text type="caption2" color="tertiary">
                          {pluralize(
                            ['member', 'members', 'members'],
                            subscribersCount
                          )}
                        </Text>
                        <Text type="caption2" color="tertiary">
                          •
                        </Text>
                      </>
                    )}
                    {postPricing && (
                      <Text type="caption2" color="accent">
                        {postPricing.price_ton} TON
                      </Text>
                    )}
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
                  navigate(ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(':id', channel.id.toString()))
                }}
              />
            )
          })}
        </Group>
      )}
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
      <TelegramMainButton text="Add Bot to Channel" onClick={handleAddChat} />

      <BlockNew gap={12} className={styles.chatsBlock}>
        {/*<BlockNew>*/}
        {/*  <BlockNew marginValue={8} row gap={8} justify="between" align="center">*/}
        {/*    <Text type="text" color="secondary">*/}
        {/*      Connect channel owners with advertisers*/}
        {/*    </Text>*/}
        {/*  </BlockNew>*/}
        {/*</BlockNew>*/}

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
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_ADVERTISER_MY_DEALS)}
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
