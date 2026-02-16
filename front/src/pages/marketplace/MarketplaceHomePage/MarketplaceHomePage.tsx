import {useNavigate} from 'react-router-dom';

import {BlockNew, BottomBar, ChannelListSnippet, Group, GroupItem, Page, PageLayout, Spinner, Text,} from '@components';
import {useChannelsQuery,} from '@store-new';
import {ROUTES_NAME} from '@routes';

import styles from './MarketplaceHomePage.module.scss';

export const MarketplaceHomePage = () => {
  const navigate = useNavigate();

  const {data: channels, isLoading: channelsLoading} = useChannelsQuery({
    limit: 5,
  });

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
        <Group header="Channels">

      {(!channels || channels.length === 0) ? (
        <Text type="text" color="secondary" align="center">
          No channels available
        </Text>
      ) : (
         <>
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
         </>
      )}
        </Group>

    </BlockNew>,
  ];
  return (
    <Page back={false}>
      <PageLayout>
        {/*<TelegramMainButton text="Add Bot To Channel" onClick={handleAddChat}/>*/}

        <BlockNew margin="0 0 16px">
          <Group header="Advertiser">
            <GroupItem text="Browse Channels" chevron onClick={() => navigate('/browse_channels')} />
            <GroupItem text="My Deals" chevron onClick={() => navigate(ROUTES_NAME.MARKETPLACE_ADVERTISER_MY_DEALS)} />
          </Group>
        </BlockNew>
        <BlockNew margin="0 0 16px">
          <Group header="Publisher">
            <GroupItem text="Ads Requests" chevron onClick={() => navigate('/requests')} />
            <GroupItem text="My Channels" chevron onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CHANNELS)} />
            <GroupItem text="My Campaigns" chevron onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CAMPAIGNS)} />
          </Group>
        </BlockNew>

        <BlockNew gap={12} className={`${styles.chatsBlock} ${styles.contentWithBottomBar}`}>

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

        {/*<BottomBar>*/}
        {/*  <BottomBar.Row>*/}
        {/*    <BottomBar.Item onClick={() => navigate('/')}>*/}
        {/*      Home*/}
        {/*    </BottomBar.Item>*/}
        {/*    <BottomBar.Item onClick={() => navigate('/requests')}>*/}
        {/*      Publisher*/}
        {/*    </BottomBar.Item>*/}
        {/*    <BottomBar.Item onClick={() => navigate(ROUTES_NAME.MARKETPLACE_ADVERTISER_MY_DEALS)}>*/}
        {/*      Advertiser*/}
        {/*    </BottomBar.Item>*/}
        {/*    /!*<BottomBar.Item onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CHANNELS)}>*!/*/}
        {/*    /!*  My Channels*!/*/}
        {/*    /!*</BottomBar.Item>*!/*/}
        {/*    /!*<BottomBar.Item onClick={() => navigate(ROUTES_NAME.MARKETPLACE_MY_CAMPAIGNS)}>*!/*/}
        {/*    /!*  My Campaigns*!/*/}
        {/*    /!*</BottomBar.Item>*!/*/}
        {/*  </BottomBar.Row>*/}
        {/*</BottomBar>*/}
      </PageLayout>
    </Page>
  )
}
