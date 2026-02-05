import {useCallback} from 'react'
import {useNavigate} from 'react-router-dom'

import {
  BlockNew,
  Button,
  ChannelListItem,
  Group,
  Page,
  PageLayout,
  Skeleton,
  TelegramMainButton,
  Text,
} from '@components'
import {useCampaignsQuery, useChannelsQuery,} from '@store-new'
import {ROUTES_NAME} from '@routes'

import styles from './MarketplaceHomePage.module.scss';

export const MarketplaceHomePage = () => {
  const navigate = useNavigate()
  // const [_, _] = useState<'channels' | 'campaigns'>('channels')
  // const { user: currentUser } = useUser()
  //
  // const tabs = [
  //   { id: 1, label: 'Channels', value: 'channels' },
  //   // { id: 2, label: 'Campaigns', value: 'campaigns' },
  // ]
  // //
  // const handleChangeActiveTab = (value: string) => {
  //   setActiveTab(value as 'channels' | 'campaigns')
  // }

  const { data: channels, isLoading: channelsLoading } = useChannelsQuery({
    limit: 14,
  })

  // const { data: campaigns, isLoading: campaignsLoading } = useCampaignsQuery({
  const { isLoading: campaignsLoading } = useCampaignsQuery({
    status: 'active',
    limit: 14,
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
  // const activeTabIndex = tabs.findIndex((tab) => tab.value === activeTab)

  const contentSlides = [
    <BlockNew id="channels-container">
      {(!channels || channels.length === 0) ? (
        <Text type="text" color="secondary" align="center">
          No channels available
        </Text>
      ) : (
        <Group>
          {channels.map((channel) => {
            return (
              <ChannelListItem
                key={channel.id}
                channel={channel}
                showAdFormats
                showTopic
                // showOwner
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
      <TelegramMainButton text="Add Bot To Channel" onClick={handleAddChat} />

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
              size='small'
              type="secondary"
              onClick={() => navigate('/browse_channels')}
            >
              Browse Channels
            </Button>
            <Button
              size='small'
              type="secondary"
              onClick={() => navigate('/requests')}
            >
              Ads Requests
            </Button>
          </BlockNew>
          <BlockNew gap={8} row>
            <Button
              size='small'
              type="secondary"
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_ADVERTISER_MY_DEALS)}
            >
              My Deals
            </Button>
            <Button
              size='small'
              type="secondary"
              onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CHANNELS)}
            >
              My Channels
            </Button>
            <Button
              size='small'
              type="secondary"
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
                  // transform: `translateX(-${activeTabIndex * 50}%)`,
                  // width: `${contentSlides.length * 100}%`,
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
