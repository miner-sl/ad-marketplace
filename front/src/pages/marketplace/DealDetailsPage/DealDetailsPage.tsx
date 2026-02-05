import {useParams} from 'react-router-dom'
import {useState} from 'react'
import {openTelegramLink} from '@tma.js/sdk-react'
import {
  Block,
  BlockNew,
  ChannelLink,
  DealStatusBadge,
  DeclineDealModal,
  Group,
  Icon,
  Image,
  ListItem,
  Page,
  PageLayout,
  Spinner,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  useToast,
} from '@components'
import {
  type EnhancedDeal,
  useAcceptDealMutation,
  useDealQuery,
  useDeclineDealMutation,
  useRequestCreativeRevisionMutation,
  useUpdateDealMessageMutation,
} from '@store-new'
import styles from './DealDetailsPage.module.scss'
import {useClipboard, useTonTransfer} from "@hooks"
import config from '@config'
import {useAuth} from "@context";

interface DealHeaderProps {
  deal: EnhancedDeal
}

const DealHeader = ({ deal }: DealHeaderProps) => {
  if (!deal) {
    return null
  }

  return (
    <BlockNew align='center'>
      <BlockNew align="center">
        <Image
          size={112}
          src={null}
          borderRadius={50}
          fallback={deal.channel?.title || `Deal #${deal.id}`}
        />
      </BlockNew>
      <BlockNew margin="top" marginValue={12} row justify="center" align="center" gap={4}>
        <Text type="title" align="center" weight="bold">
          Deal #{deal.id}
        </Text>
        <DealStatusBadge status={deal.status} />
      </BlockNew>
      {deal.formattedMembersCount && (
        <BlockNew margin="top" marginValue={8}>
          <Text type="caption2" color="tertiary" align="center">
            {deal.formattedMembersCount}
          </Text>
        </BlockNew>
      )}
    </BlockNew>
  )
}

const getTONScanUrl = (address: string): string => {
  const baseUrl = config.isDev
    ? 'https://testnet.tonscan.org'
    : 'https://tonscan.org';
  return `${baseUrl}/address/${address}`;
}

export const DealDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  // const navigate = useNavigate()
  // const { user } = useUser()
  const dealId = id ? parseInt(id) : 0
  const {user} = useAuth();

  const {data: deal, isLoading} = useDealQuery(dealId, user?.telegramId);
  // const { data: creative } = useDealCreativeQuery(dealId)
  const acceptDealMutation = useAcceptDealMutation()
  const declineDealMutation = useDeclineDealMutation()
  // const approveCreativeMutation = useApproveCreativeMutation()
  const requestRevisionMutation = useRequestCreativeRevisionMutation()
  const updateDealMessageMutation = useUpdateDealMessageMutation()
  // TODO: Uncomment when useDealCreativeQuery is implemented
  // const { data: creative } = useDealCreativeQuery(dealId)
  // const creative: Creative | null = deal?.creative;
  // const submitCreativeMutation = useSubmitCreativeMutation()
  const {copy} = useClipboard()
  const {showToast} = useToast()
  const {transferTon, isConnected} = useTonTransfer()
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  if (isLoading || !deal) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton/>
          <Spinner size={32} />
        </PageLayout>
      </Page>
    )
  }

  const isChannelOwner = deal.channel_owner_id === user?.id
  const isAdvertiser = deal.advertiser_id === user?.id
  const canInteract = isChannelOwner || isAdvertiser
  const canEditMessage = isAdvertiser && deal.status === 'negotiating'

  const handleAdvertiserClick = () => {
    const advertiser = typeof deal.advertiser === 'object' && deal.advertiser !== null ? deal.advertiser : null
    if (advertiser) {
      if (advertiser.username) {
        openTelegramLink(`https://t.me/${advertiser.username.replace('@', '')}`)
      } else if (advertiser.telegram_id) {
        // For users without username, use user ID
        openTelegramLink(`https://t.me/user${advertiser.telegram_id}`)
      }
    }
  }


  const handleEscrowAddressClick = () => {
    if (deal.escrow_address) {
      const url = getTONScanUrl(deal.escrow_address);
      window.open(url, '_blank');
    }
  }

  const handleAcceptDeal = async () => {
    if (!user) return
    try {
      await acceptDealMutation.mutateAsync({
        id: dealId,
        channel_owner_id: user.id,
      })
    } catch (error) {
      console.error('Failed to accept deal:', error)
    }
  }

  const handleDeclineDeal = () => {
    setShowDeclineModal(true)
  }

  const handleConfirmDecline = async (reason?: string) => {
    try {
      if (declineDealMutation.isPending) {
        return
      }
      setShowDeclineModal(false)
      await declineDealMutation.mutateAsync({ id: dealId, reason });
      showToast({message: 'Deal declined successfully', type: 'success' });

    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Failed to decline deal',
        type: 'warning',
      });
      console.error('Failed to decline deal:', error)
    }
  }

  // const handleApproveCreative = async () => {
  //   try {
  //     await approveCreativeMutation.mutateAsync(dealId)
  //   } catch (error) {
  //     console.error('Failed to approve creative:', error)
  //   }
  // }
  //
  // const handleRequestRevision = async () => {
  //   const notes = prompt('Please provide revision notes:')
  //   if (notes) {
  //     try {
  //       await requestRevisionMutation.mutateAsync({
  //         dealId,
  //         revision_notes: notes,
  //       })
  //     } catch (error) {
  //       console.error('Failed to request revision:', error)
  //     }
  //   }
  // }

  const handleRequestChanges = async () => {
    const notes = prompt('Please provide your requested changes:')
    if (!notes || !notes.trim()) {
      return
    }

    try {
      await requestRevisionMutation.mutateAsync({
        dealId: deal.id,
        revision_notes: notes.trim(),
      })
      showToast({
        type: 'success',
        message: 'Revision request sent successfully',
      })
    } catch (error: any) {
      console.error('Failed to request revision:', error)
      showToast({
        type: 'error',
        message: error?.message || 'Failed to request revision',
      })
    }
  }

  const handlePayDeal = async () => {
    if (!deal.escrow_address) {
      showToast({ type: 'error', message: 'Escrow address not available' })
      return
    }

    if (!isConnected) {
      showToast({
        type: 'error',
        message: 'Please connect your USDT wallet first'
      })
      return
    }

    try {
      await transferTon(
        deal.escrow_address,
        deal.price_ton,
        `Payment for Deal #${deal.id}`
      )
      showToast({
        type: 'success',
        message: 'Transaction sent successfully. Waiting for confirmation...',
      })
    } catch (error) {
      // Error handling is done in the hook
      console.error('Payment failed:', error)
    }
  }

  const handleEditMessage = async () => {
    const currentMessage = deal.messages && deal.messages.length > 0
      ? deal.messages[0].message_text
      : ''
    const newMessage = prompt('Edit post message:', currentMessage)

    if (newMessage === null) {
      return // User cancelled
    }

    if (!newMessage.trim()) {
      showToast({
        type: 'error',
        message: 'Message cannot be empty',
      })
      return
    }

    try {
      await updateDealMessageMutation.mutateAsync({
        dealId: dealId,
        message_text: newMessage.trim(),
      })
      showToast({
        type: 'success',
        message: 'Message updated successfully',
      })
    } catch (error: any) {
      console.error('Failed to update message:', error)
      showToast({
        type: 'error',
        message: error?.message || 'Failed to update message',
      })
    }
  }

  const isAdvertiserUser = typeof deal.advertiser === 'object' && deal.advertiser !== null
    ? deal.advertiser.telegram_id === user?.id
    : false
  const showPaymentButton = isAdvertiserUser && deal.status === 'payment_pending' && deal.escrow_address !== undefined;

  const channelStats = deal.channel?.stats

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>

        <DealHeader deal={deal} />

        {channelStats && (
          <Block margin="bottom" marginValue={24}>
            <Block paddingValue={16}>
              <Group header="STATISTICS">
                {channelStats.subscribers_count && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        👥 {deal.formattedSubscribersCount} subscribers
                      </Text>
                    }
                  />
                )}
                {channelStats.average_views && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        👁️ {deal.formattedAverageViews} average views
                      </Text>
                    }
                  />
                )}
                {channelStats.average_reach && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        📊 {deal.formattedAverageReach} average reach
                      </Text>
                    }
                  />
                )}
              </Group>
            </Block>
          </Block>
        )}

        {/*{creative && (*/}
        {/*  <Block margin="bottom" marginValue={24}>*/}
        {/*    <Group header="CREATIVE">*/}
        {/*      <ListItem*/}
        {/*        padding="6px 16px"*/}
        {/*        text={*/}
        {/*          <BlockNew row align="center" gap={8}>*/}
        {/*            <Text type="text" weight="medium">*/}
        {/*              Status:*/}
        {/*            </Text>*/}
        {/*            <Text type="text" color="accent">*/}
        {/*              {creative.status}*/}
        {/*            </Text>*/}
        {/*          </BlockNew>*/}
        {/*        }*/}
        {/*      />*/}
        {/*      {creative.revision_notes && (*/}
        {/*        <ListItem*/}
        {/*          padding="6px 16px"*/}
        {/*          text={*/}
        {/*            <BlockNew gap={4}>*/}
        {/*              <Text type="text" weight="medium">*/}
        {/*                Revision Notes:*/}
        {/*              </Text>*/}
        {/*              <Text type="text" color="danger">*/}
        {/*                {creative.revision_notes}*/}
        {/*              </Text>*/}
        {/*            </BlockNew>*/}
        {/*          }*/}
        {/*        />*/}
        {/*      )}*/}
        {/*      {isAdvertiser && creative.status === 'pending' && (*/}
        {/*        <BlockNew row gap={8} paddingValue={16}>*/}
        {/*          <Button*/}
        {/*            type="primary"*/}
        {/*            onClick={handleApproveCreative}*/}
        {/*            disabled={approveCrceativeMutation.isPending}*/}
        {/*          >*/}
        {/*            Approve*/}
        {/*          </Button>*/}
        {/*          <Button*/}
        {/*            type="secondary"*/}
        {/*            onClick={handleRequestRevision}*/}
        {/*            disabled={requestRevisionMutation.isPending}*/}
        {/*          >*/}
        {/*            Request Revision*/}
        {/*          </Button>*/}
        {/*        </BlockNew>*/}
        {/*      )}*/}
        {/*    </Group>*/}
        {/*  </Block>*/}
        {/*)}*/}

        <Block>
          <Group header="DEAL INFORMATION">
            <ListItem
              padding="6px 16px"
              text={
                <BlockNew row align="center" gap={8}>
                  <Text type="text" weight="medium">
                    Ad Format:
                  </Text>
                  <Text type="text" color="accent">
                    {deal.ad_format}
                  </Text>
                </BlockNew>
              }
            />
            <ListItem
              padding="6px 16px"
              text={
                <BlockNew row align="center" gap={8}>
                  <Text type="text" weight="medium">
                    Price:
                  </Text>
                  <Text type="text" color="accent">
                    {deal?.price_ton?.toFixed?.(2) || '-'} USDT
                  </Text>
                </BlockNew>
              }
            />
            {deal.channel?.title && (
              <ListItem
                padding="6px 16px"
                text={
                  <BlockNew row align="center" gap={8}>
                    <Text type="text" weight="medium">
                      Channel:
                    </Text>
                    <ChannelLink channel={deal.channel} showLabel={false} textType="text" />
                  </BlockNew>
                }
              />
            )}
            {typeof deal.advertiser === 'object' && deal.advertiser !== null && (
              <ListItem
                padding="6px 16px"
                text={
                  <BlockNew row align="center" gap={8}>
                    <Text type="text" weight="medium">
                      Advertiser:
                    </Text>
                    <div onClick={handleAdvertiserClick} className={styles.clickable}>
                      <Text
                        type="text"
                        color="accent"
                      >
                        {deal.advertiserDisplayName}
                      </Text>
                    </div>
                  </BlockNew>
                }
              />
            )}
            {deal.escrow_address && (
              <ListItem
                padding="6px 16px"
                text={
                  <BlockNew row align="center" gap={8} className={styles.flexRow}>
                    <Text type="text" weight="medium">
                      Escrow Address:
                    </Text>
                    <div onClick={handleEscrowAddressClick} className={styles.clickable}>
                      <Text
                        type="text"
                        color="accent"
                      >
                        {deal.formattedEscrowAddress}
                      </Text>
                    </div>
                  </BlockNew>
                }
                after={
                  <Icon
                    name="share"
                    size={20}
                    color="accent"
                    className={styles.clickable}
                    onClick={(e) => {
                      e.stopPropagation()
                      copy(deal.escrow_address!, 'Escrow address copied')
                    }}
                  />
                }
              />
            )}
            {deal.scheduled_post_time && (
              <ListItem
                padding="6px 16px"
                text={
                  <Text type="text">
                    <Text type="text" weight="medium">
                      Scheduled Post Time:
                    </Text>
                    {deal.formattedScheduledPostTime}
                  </Text>
                }
              />
            )}
            {deal.messages && deal.messages.length > 0 && deal.messages[0]?.message_text && (
              <ListItem
                padding="6px 16px"
                text={
                  <BlockNew gap={8}>
                    <Text type="text" weight="medium">
                      Message:
                    </Text>
                    <Text type="text">
                      {deal.messages[0].message_text}
                    </Text>
                  </BlockNew>
                }
                after={
                  canEditMessage ? (
                    <Icon
                      name="share"
                      size={20}
                      color="accent"
                      className={styles.clickable}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditMessage()
                      }}
                    />
                  ) : undefined
                }
              />
            )}
          </Group>
        </Block>

        {(canInteract && deal.status === 'pending') || (deal.owner && deal.status === 'pending') ? (
          <BlockNew margin="top" marginValue={24}>
            <Group header="ACTIONS">
              <BlockNew gap={4}>
                {/*{isChannelOwner && deal.status === 'pending' && (*/}
                {/*  <Block row justify="between">*/}
                {/*    <ListItem*/}
                {/*      padding="6px 16px"*/}
                {/*      text={*/}
                {/*        <Text type="text" color="accent">*/}
                {/*          Accept Deal*/}
                {/*        </Text>*/}
                {/*      }*/}
                {/*      before={*/}
                {/*        <Icon name="checkmark" size={28} color="accent" />*/}
                {/*      }*/}
                {/*      onClick={handleAcceptDeal}*/}
                {/*      disabled={acceptDealMutation.isPending}*/}
                {/*    />*/}
                {/*    <ListItem*/}
                {/*      padding="6px 16px"*/}
                {/*      text={*/}
                {/*        <Text type="text" color="danger">*/}
                {/*          Reject Deal*/}
                {/*        </Text>*/}
                {/*      }*/}
                {/*      before={*/}
                {/*        <Icon name="cross" size={28} color="danger" />*/}
                {/*      }*/}
                {/*      onClick={handleDeclineDeal}*/}
                {/*      disabled={declineDealMutation.isPending}*/}
                {/*    />*/}
                {/*  </Block>*/}
                {/*)}*/}
                {isChannelOwner && deal.owner && deal.status === 'pending' && (
                  <>
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text" color="accent">
                          Accept
                        </Text>
                      }
                      before={
                        <Icon name="checkmark" size={28} color="accent" />
                      }
                      onClick={handleAcceptDeal}
                      disabled={acceptDealMutation.isPending}
                    />
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text" color="danger">
                          Decline
                        </Text>
                      }
                      before={
                        <Icon name="cross" size={28} color="danger" />
                      }
                      onClick={handleDeclineDeal}
                      disabled={declineDealMutation.isPending}
                    />
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text">
                          Request Changes
                        </Text>
                      }
                      before={
                        <Icon name="share" size={28} color="accent" />
                      }
                      onClick={handleRequestChanges}
                    />
                  </>
                )}
              </BlockNew>
            </Group>
          </BlockNew>
        ) : null}

        <Block margin="top" marginValue="auto">
          <Text type="caption" align="center" color="tertiary">
            Deal #{deal.id} • Status: {deal.status}
          </Text>
        </Block>
      </PageLayout>

      {showPaymentButton && (
        <TelegramMainButton
          text={`Pay ${deal.price_ton} USDT`}
          onClick={handlePayDeal}
          isVisible={true}
        />
      )}

      <DeclineDealModal
        active={showDeclineModal}
        onConfirm={handleConfirmDecline}
        onClose={() => setShowDeclineModal(false)}
      />
    </Page>
  )
}
