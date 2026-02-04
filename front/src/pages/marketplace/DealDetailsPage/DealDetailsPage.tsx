import {useParams} from 'react-router-dom'
import {openTelegramLink} from '@tma.js/sdk-react'
import {
  Block,
  BlockNew,
  DealStatusBadge,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  Image,
  ListItem,
  Group,
  Icon,
  useToast,
  Spinner,
} from '@components'
import {
  useAcceptDealMutation,
  useApproveCreativeMutation,
  useDealQuery,
  useRejectDealMutation,
  useRequestCreativeRevisionMutation,
} from '@store-new'
import styles from './DealDetailsPage.module.scss'
import {separateNumber, collapseAddress, createMembersCount} from "@utils"
import {useTelegramUser, useClipboard} from "@hooks"
import config from '@config'
import type {Deal, ChannelStats, Creative} from '@types'

interface DealHeaderProps {
  deal: Deal
  stats?: ChannelStats
}

const DealHeader = ({ deal, stats }: DealHeaderProps) => {
  const subscribersCount = stats?.subscribers_count || deal.channel?.stats?.subscribers_count || 0

  return (
    <>
      <Block align="center">
        <Image
          size={112}
          src={null}
          borderRadius={50}
          fallback={deal.channel?.title || `Deal #${deal.id}`}
        />
      </Block>
      <Block margin="top" marginValue={12} row justify="center" align="center" gap={4}>
        <Text type="title" align="center" weight="bold">
          Deal #{deal.id}
        </Text>
        <DealStatusBadge status={deal.status} />
      </Block>
      {deal.channel?.title && (
        <Block margin="top" marginValue={8}>
          <Text type="text" align="center" color="tertiary">
            {deal.channel.title}
          </Text>
        </Block>
      )}
      {subscribersCount > 0 && (
        <Block margin="top" marginValue={8}>
          <Text type="caption2" color="tertiary" align="center">
            {createMembersCount(subscribersCount)}
          </Text>
        </Block>
      )}
    </>
  )
}

export const DealDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  // const navigate = useNavigate()
  // const { user } = useUser()
  const dealId = id ? parseInt(id) : 0
  const user = useTelegramUser()

  const {data: deal, isLoading} = useDealQuery(dealId, user?.id);
  // const { data: creative } = useDealCreativeQuery(dealId)
  const acceptDealMutation = useAcceptDealMutation()
  const rejectDealMutation = useRejectDealMutation()
  const approveCreativeMutation = useApproveCreativeMutation()
  const requestRevisionMutation = useRequestCreativeRevisionMutation()
  // TODO: Uncomment when useDealCreativeQuery is implemented
  // const { data: creative } = useDealCreativeQuery(dealId)
  const creative: Creative | null = null
  // const submitCreativeMutation = useSubmitCreativeMutation()
  const {copy} = useClipboard()
  const {showToast} = useToast()
  // const {transferTon, isConnected} = useTonTransfer()
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


  const getTONScanUrl = (address: string): string => {
    const baseUrl = config.isDev
      ? 'https://testnet.tonscan.org'
      : 'https://tonscan.org';
    return `${baseUrl}/address/${address}`;
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

  const handleRejectDeal = async () => {
    try {
      await rejectDealMutation.mutateAsync(dealId)
    } catch (error) {
      console.error('Failed to reject deal:', error)
    }
  }

  const handleApproveCreative = async () => {
    try {
      await approveCreativeMutation.mutateAsync(dealId)
    } catch (error) {
      console.error('Failed to approve creative:', error)
    }
  }

  const handleRequestRevision = async () => {
    const notes = prompt('Please provide revision notes:')
    if (notes) {
      try {
        await requestRevisionMutation.mutateAsync({
          dealId,
          revision_notes: notes,
        })
      } catch (error) {
        console.error('Failed to request revision:', error)
      }
    }
  }

  const handleRequestChanges = async () => {
    const notes = prompt('Please provide your requested changes:')
    if (notes) {
      // TODO: Implement API call to send message/request changes
      // For now, this is a placeholder
      console.log('Request changes:', notes)
      showToast({ type: 'error', message: 'Request changes functionality will be implemented soon' })
    }
  }

  const handlePayDeal = async () => {
    if (!deal.escrow_address) {
      showToast({ type: 'error', message: 'Escrow address not available' })
      return
    }

    // if (!isConnected) {
    //   showToast({
    //     type: 'error',
    //     message: 'Please connect your TON wallet first'
    //   })
    //   return
    // }

    try {
      // await transferTon(
      //   deal.escrow_address,
      //   deal.price_ton,
      //   `Payment for Deal #${deal.id}`
      // )
      showToast({
        type: 'success',
        message: 'Transaction sent successfully. Waiting for confirmation...',
      })
    } catch (error) {
      // Error handling is done in the hook
      console.error('Payment failed:', error)
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

        {/* Deal Header */}
        <DealHeader deal={deal} stats={channelStats} />

        {/* Statistics Section */}
        {channelStats && (
          <Block margin="bottom" marginValue={24}>
            <Block paddingValue={16}>
              <Group header="STATISTICS">
                {channelStats.subscribers_count && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        👥 {separateNumber(channelStats.subscribers_count)} subscribers
                      </Text>
                    }
                  />
                )}
                {channelStats.average_views && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        👁️ {separateNumber(channelStats.average_views)} average views
                      </Text>
                    }
                  />
                )}
                {channelStats.average_reach && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text">
                        📊 {separateNumber(channelStats.average_reach)} average reach
                      </Text>
                    }
                  />
                )}
              </Group>
            </Block>
          </Block>
        )}

        <Block margin="top" marginValue={24}>
          <Block margin="bottom" marginValue={44}>
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
                      {deal.price_ton?.toFixed?.(2)} TON
                    </Text>
                  </BlockNew>
                }
              />
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
                          {deal.advertiser.username
                            ? `@${deal.advertiser.username}`
                            : deal.advertiser.first_name || `User #${deal.advertiser.telegram_id}`}
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
                          {collapseAddress(deal.escrow_address, 4)}
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
                      Scheduled Post Time: {new Date(deal.scheduled_post_time).toLocaleString()}
                    </Text>
                  }
                />
              )}
              {deal.messages && deal.messages.length > 0 && deal.messages[0]?.message_text && (
                <ListItem
                  padding="6px 16px"
                  text={
                    <Text type="text">
                      Message: {deal.messages[0].message_text}
                    </Text>
                  }
                />
              )}
            </Group>
          </Block>
        </Block>

        {/* Creative Section */}
        {/* TODO: Uncomment when useDealCreativeQuery is implemented
        {creative && (
          <Block margin="top" marginValue={24}>
            <Block margin="bottom" marginValue={44}>
              <Group header="CREATIVE">
                <ListItem
                  padding="6px 16px"
                  text={
                    <Text type="text">
                      Status: {creative.status}
                    </Text>
                  }
                />
                {creative.revision_notes && (
                  <ListItem
                    padding="6px 16px"
                    text={
                      <Text type="text" color="danger">
                        Revision Notes: {creative.revision_notes}
                      </Text>
                    }
                  />
                )}
                {isAdvertiser && creative.status === 'pending' && (
                  <BlockNew row gap={8} paddingValue={16}>
                    <Button
                      type="primary"
                      onClick={handleApproveCreative}
                      disabled={approveCreativeMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      type="secondary"
                      onClick={handleRequestRevision}
                      disabled={requestRevisionMutation.isPending}
                    >
                      Request Revision
                    </Button>
                  </BlockNew>
                )}
              </Group>
            </Block>
          </Block>
        )}
        */}

        {/* Actions Section */}
        {(canInteract && deal.status === 'pending') || (deal.owner && deal.status === 'pending') ? (
          <Block margin="top" marginValue={24}>
            <Block margin="bottom" marginValue={44}>
              <Group header="ACTIONS">
                {isChannelOwner && deal.status === 'pending' && (
                  <>
                    <ListItem
                      padding="6px 16px"
                      text={
                        <Text type="text" color="accent">
                          Accept Deal
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
                          Reject Deal
                        </Text>
                      }
                      before={
                        <Icon name="cross" size={28} color="danger" />
                      }
                      onClick={handleRejectDeal}
                      disabled={rejectDealMutation.isPending}
                    />
                  </>
                )}
                {deal.owner && deal.status === 'pending' && (
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
                      onClick={handleRejectDeal}
                      disabled={rejectDealMutation.isPending}
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
              </Group>
            </Block>
          </Block>
        ) : null}

        {/* Footer */}
        <Block margin="top" marginValue="auto">
          <Text type="caption" align="center" color="tertiary">
            Deal #{deal.id} • Status: {deal.status}
          </Text>
        </Block>
      </PageLayout>

      {showPaymentButton && (
        <TelegramMainButton
          text={`Pay ${deal.price_ton} TON`}
          onClick={handlePayDeal}
          isVisible={true}
        />
      )}
    </Page>
  )
}
