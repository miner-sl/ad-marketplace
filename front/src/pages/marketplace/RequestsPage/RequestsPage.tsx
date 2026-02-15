import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CampaignCard,
  Button,
  ListToggler, AppSelect, type AppSelectOption,
} from '@components';
import { useDealRequestsQuery, useCampaignsQuery } from '@store-new';
import { useTelegramUser } from '@hooks';
import { ROUTES_NAME } from '@routes';
import { pluralize, hapticFeedback } from '@utils';
import type {Deal} from "@types";

import styles from './RequestsPage.module.scss';

const LIMIT = 20

type Locales = 'en' | 'ru' | 'es' | 'it';

const locales: AppSelectOption[] = [
  {
    value: '',
    name: 'Any',
  }, {
    value: 'en',
    name: 'English',
  },
  {
    value: 'ru',
    name: 'Russian',
  },
  {
    value: 'es',
    name: 'Spanish',
  },
  {
    value: 'it',
    name: 'Italian',
  }
];
export const RequestsPage = () => {
  const navigate = useNavigate()
  const telegramUser = useTelegramUser()
  const [channelID] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [dateFrom] = useState('')
  const [dateTo] = useState('')
  const country = undefined;
  // const [country, setCountry] = useState('')
  const [locale, setLocale] = useState<Locales>('en');
  const [premiumOnly, setPremiumOnly] = useState(false)

  const filters = useMemo(
    () => ({
      channelId: channelID,
      limit: LIMIT,
      page,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      country: country || undefined,
      locale: locale || undefined,
      premiumOnly: premiumOnly || undefined,
    }),
    [channelID, page, dateFrom, dateTo, country, locale, premiumOnly]
  )

  const { data: response, isLoading: dealsLoading } = useDealRequestsQuery(
    telegramUser?.id,
    filters
  )

  // const lastLoadedPageRef = useRef(0)
  // const [accumulatedDeals, setAccumulatedDeals] = useState<any[]>([])
  //
  // useEffect(() => {
  //   if (!response) return
  //   const { data, page } = response
  //   if (page === 1) {
  //     setAccumulatedDeals(data ?? [])
  //     lastLoadedPageRef.current = 1
  //   } else if (page > lastLoadedPageRef.current) {
  //     setAccumulatedDeals((prev) => [...prev, ...(data ?? [])])
  //     lastLoadedPageRef.current = page
  //   }
  // }, [response])

  const incomingRequests = response?.data || [];
  const allAmount = response?.allAmount ?? 0
  const currentPage = response?.page ?? 1
  const totalPages = Math.ceil(allAmount / LIMIT) || 0
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const isLoadingMore = dealsLoading;

  const { data: campaigns } = useCampaignsQuery({
    status: 'active',
  })

  const matchingCampaigns = campaigns?.filter((campaign) => {
    return campaign.status === 'active'
  })

  const goNext = () => {
    if (hasNextPage) {
      setPage((p) => p + 1)
      hapticFeedback('soft')
    }
  }

  const goPrev = () => {
    if (hasPrevPage) {
      setPage((p) => Math.max(1, p - 1))
      hapticFeedback('soft')
    }
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="title" weight="bold">
              Incoming Requests
            </Text>
            <BlockNew marginValue={8}>
              <Text type="text" color="secondary">
                Ad requests from advertisers for your channels
              </Text>
            </BlockNew>
          </BlockNew>

          <BlockNew padding="0 16px">
            <BlockNew row gap={16} marginValue={8} >
              {/*<BlockNew gap={4}>*/}
              {/*  <Text type="caption" color="secondary">*/}
              {/*    From*/}
              {/*  </Text>*/}
              {/*  <ListInput*/}
              {/*    type="date"*/}
              {/*    value={dateFrom}*/}
              {/*    onChange={(v) => {*/}
              {/*      setDateFrom(v)*/}
              {/*      setPage(1)*/}
              {/*    }}*/}
              {/*  />*/}
              {/*</BlockNew>*/}
              {/*<BlockNew gap={4}>*/}
              {/*  <Text type="caption" color="secondary">*/}
              {/*    To*/}
              {/*  </Text>*/}
              {/*  <ListInput*/}
              {/*    type="date"*/}
              {/*    value={dateTo}*/}
              {/*    onChange={(v) => {*/}
              {/*      setDateTo(v)*/}
              {/*      setPage(1)*/}
              {/*    }}*/}
              {/*  />*/}
              {/*</BlockNew>*/}
              {/*<BlockNew gap={4} align="start">*/}
              {/*  <Text type="caption" color="secondary">*/}
              {/*    Country*/}
              {/*  </Text>*/}
              {/*  <ListInput*/}
              {/*    type="text"*/}
              {/*    placeholder="Country"*/}
              {/*    value={country}*/}
              {/*    onChange={(v) => {*/}
              {/*      setCountry(v)*/}
              {/*      setPage(1);*/}
              {/*      showToast({*/}
              {/*        message: 'Todo',*/}
              {/*      })*/}
              {/*    }}*/}
              {/*  />*/}
              {/*</BlockNew>*/}
              <BlockNew gap={4} row align="start">
                <Text type="caption" color="secondary">
                  Locale
                </Text>
                <AppSelect
                  options={locales}
                  value={locale || null}
                  onChange={(value) => setLocale(value as Locales)}
                  placeholder="Select a topic"
                />
              </BlockNew>
              <BlockNew gap={4} row align="start">
                <Text type="caption" color="secondary">
                  Only Premium User
                </Text>
                <ListToggler
                  isEnabled={premiumOnly}
                  onChange={(v) => {
                    setPremiumOnly(v)
                    setPage(1)
                  }}
                />
              </BlockNew>
            </BlockNew>
          </BlockNew>

          {dealsLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading requests...
            </Text>
          ) : incomingRequests.length > 0 ? (
            <BlockNew id="requests-container">
              <Group>
                {incomingRequests.map((deal: Deal) => {
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
                        navigate(
                          ROUTES_NAME.MARKETPLACE_DEAL_DETAILS.replace(
                            ':id',
                            deal.id.toString()
                          )
                        )
                      }}
                    />
                  )
                })}
              </Group>
              {isLoadingMore && (
                <Text type="caption" color="secondary" align="center">
                  Loading more...
                </Text>
              )}
              {(hasPrevPage || hasNextPage) && (
                <BlockNew row gap={12} padding="16px 16px 0" align="center">
                  {/*<Button*/}
                  {/*  type="secondary"*/}
                  {/*  size="small"*/}
                  {/*  disabled={!hasPrevPage}*/}
                  {/*  onClick={goPrev}*/}
                  {/*>*/}
                  {/*  Previous*/}
                  {/*</Button>*/}
                  <Text type="caption" color="secondary">
                    Page {currentPage}
                  </Text>
                  <Button
                    type="secondary"
                    size="small"
                    disabled={!hasNextPage}
                    onClick={goNext}
                  >
                    Next
                  </Button>
                </BlockNew>
              )}
            </BlockNew>
          ) : (
            <BlockNew gap={12}>
              <Text type="text" color="secondary" align="center">
                No incoming requests at the moment
              </Text>
              {(hasPrevPage || hasNextPage) && (
                <BlockNew row gap={12} padding="16px 16px 0" align="center">
                  <Button
                    type="secondary"
                    size="small"
                    disabled={!hasPrevPage}
                    onClick={goPrev}
                  >
                    Previous
                  </Button>
                  <Text type="caption" color="secondary">
                    Page {currentPage}
                  </Text>
                  <Button
                    type="secondary"
                    size="small"
                    disabled={!hasNextPage}
                    onClick={goNext}
                  >
                    Next
                  </Button>
                </BlockNew>
              )}
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
