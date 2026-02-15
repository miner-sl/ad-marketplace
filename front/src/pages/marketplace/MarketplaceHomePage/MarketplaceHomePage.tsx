import {useNavigate} from 'react-router-dom';

import {BlockNew, Button, ChannelListSnippet, Group, Page, PageLayout, Spinner, Text,} from '@components';
import {useChannelsQuery,} from '@store-new';
import {ROUTES_NAME} from '@routes';

import styles from './MarketplaceHomePage.module.scss';

export const MarketplaceHomePage = () => {
  const navigate = useNavigate()


  const {data: channels, isLoading: channelsLoading} = useChannelsQuery({
    limit: 5,
  })

  // const { data: campaigns, isLoading: campaignsLoading } = useCampaignsQuery({
  // const {isLoading: campaignsLoading} = useCampaignsQuery({
  //   status: 'active',
  //   limit: 14,
  // })

  // const handleAddChat = useCallback(
  //   () => navigate('/admin/add-telegram-chat'),
  //   []
  // )

  const campaignsLoading = false;
  const isLoading = channelsLoading || campaignsLoading;

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
              <ChannelListSnippet
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
  ];
  return (
    <Page back={false}>
      <PageLayout>
        {/*<TelegramMainButton text="Add Bot To Channel" onClick={handleAddChat}/>*/}

        <BlockNew gap={12} className={styles.chatsBlock}>

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


          {isLoading ? (
            <BlockNew align="center" marginValue={12}>
              <Spinner size={24}/>
            </BlockNew>
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
