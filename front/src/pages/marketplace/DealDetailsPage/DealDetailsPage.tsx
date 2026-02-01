import {useParams} from 'react-router-dom'
import {openTelegramLink} from '@tma.js/sdk-react'
import {BlockNew, Button, DealStatusBadge, PageLayout, Page, TelegramBackButton, TelegramMainButton, Text, ChannelLink, useToast} from '@components'
import {
  useAcceptDealMutation,
  useApproveCreativeMutation,
  useDealQuery,
  useRejectDealMutation,
  useRequestCreativeRevisionMutation,
} from '@store-new'
// import { useUser } from '@store'
import styles from './DealDetailsPage.module.scss'
import {separateNumber, collapseAddress} from "@utils";
import {useTelegramUser, useClipboard} from "@hooks";
import config from '@config';

export const DealDetailsPage = () => {
  const {id} = useParams<{ id: string }>()
  // const navigate = useNavigate()
  // const { user } = useUser()
  const dealId = id ? parseInt(id) : 0
  const user = useTelegramUser()

  const {data: deal, isLoading} = useDealQuery(dealId, user?.id)
  // const { data: creative } = useDealCreativeQuery(dealId)
  const acceptDealMutation = useAcceptDealMutation()
  const rejectDealMutation = useRejectDealMutation()
  const approveCreativeMutation = useApproveCreativeMutation()
  const requestRevisionMutation = useRequestCreativeRevisionMutation()
  const creative = undefined;
  // const submitCreativeMutation = useSubmitCreativeMutation()
  const {copy} = useClipboard()
  const {showToast} = useToast()
  if (isLoading || !deal) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton/>
          <Text type="text" align="center">
            Loading...
          </Text>
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

  const handlePayDeal = () => {
    if (!deal.escrow_address) {
      showToast({ type: 'error', message: 'Escrow address not available' })
      return
    }
    // Copy escrow address to clipboard
    copy(deal.escrow_address, `send ${deal.price_ton} TON to the escrow address. Escrow address copied`)
    // TODO: Open TON wallet or payment interface
  }

  const isAdvertiserUser = typeof deal.advertiser === 'object' && deal.advertiser !== null
    ? deal.advertiser.telegram_id === user?.id 
    : false
  const showPaymentButton = isAdvertiserUser && deal.status === 'payment_pending' && deal.escrow_address !== undefined;

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton/>
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <BlockNew row justify="between" align="center" gap={12}>
              <Text type="title">
                Deal #{deal.id}
              </Text>
              <DealStatusBadge status={deal.status}/>
            </BlockNew>
          </BlockNew>

          <BlockNew gap={12} padding="0 16px">
            <BlockNew gap={4}>
              <ChannelLink channel={deal.channel} />
              {typeof deal.advertiser === 'object' && deal.advertiser !== null && (
                <BlockNew row gap={8}>
                  <Text type="text" color="secondary">
                    Advertiser:
                  </Text>
                  <span style={{ textDecoration: 'underline' }}>
                    <Text
                      type="text"
                      color="accent"
                      onClick={handleAdvertiserClick}
                    >
                      {deal.advertiser.username 
                        ? `@${deal.advertiser.username}` 
                        : deal.advertiser.first_name || `User #${deal.advertiser.telegram_id}`}
                    </Text>
                  </span>
                </BlockNew>
              )}
              {deal.channel?.stats && (
                <BlockNew row gap={12} marginValue={8}>
                  {deal.channel.stats.subscribers_count && (
                    <Text type="caption" color="secondary">
                      👥 {separateNumber(deal.channel.stats.subscribers_count)}
                    </Text>
                  )}
                  {deal.channel.stats.average_views && (
                    <Text type="caption" color="secondary">
                      👁️ {separateNumber(deal.channel.stats.average_views)}
                    </Text>
                  )}
                </BlockNew>
              )}
            </BlockNew>

            <BlockNew row>
              <Text type="text">Ad Format: {deal.ad_format}</Text>
            </BlockNew>

            <BlockNew row>
              <Text type="text" color="accent">Price: {deal.price_ton} TON</Text>
            </BlockNew>

            {deal.escrow_address && (
              <BlockNew row gap={8} align="center">
                <Text
                  type="text"
                  onClick={handleEscrowAddressClick}
                >
                  Escrow Address: {collapseAddress(deal.escrow_address, 4)}
                </Text>
                <span
                  onClick={() => copy(deal.escrow_address!, 'Escrow address copied')}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '14px',
                    backgroundColor: 'var(--color-backgroundTertiary)',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px',
                  }}
                >
                  📋
                </span>
              </BlockNew>
            )}

            {deal.scheduled_post_time && (
              <BlockNew row>
                <Text type="text">Scheduled Post Time: {new Date(deal.scheduled_post_time).toLocaleString()}</Text>
              </BlockNew>
            )}

            {deal.messages && deal.messages.length > 0 && deal.messages[0]?.message_text && (
              <BlockNew row>
                <Text type="text">Message: {deal.messages[0].message_text}</Text>
              </BlockNew>
            )}

            {creative && (
              <BlockNew gap={4} marginValue={16}>
                <BlockNew row>
                  <Text type="text">Creative Status: {creative.status}</Text>
                </BlockNew>
                {creative.revision_notes && (
                  <Text type="text" color="danger">
                    Revision Notes: {creative.revision_notes}
                  </Text>
                )}
                {isAdvertiser && creative.status === 'pending' && (
                  <BlockNew row gap={8} marginValue={8}>
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
              </BlockNew>
            )}

            {canInteract && deal.status === 'pending' && (
              <BlockNew row gap={8} marginValue={16}>
                {isChannelOwner && (
                  <>
                    <Button
                      type="primary"
                      onClick={handleAcceptDeal}
                      disabled={acceptDealMutation.isPending}
                    >
                      Accept Deal
                    </Button>
                    <Button
                      type="danger"
                      onClick={handleRejectDeal}
                      disabled={rejectDealMutation.isPending}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </BlockNew>
            )}
            {(deal.owner && deal.status === 'pending') && (
              <BlockNew row gap={8} marginValue={16}>
                <Button
                  type="danger"
                  onClick={handleAcceptDeal}
                  disabled={acceptDealMutation.isPending}
                >
                  Accept
                </Button>
                <Button
                  type="danger"
                  onClick={handleRejectDeal}
                  disabled={rejectDealMutation.isPending}
                >
                  Decline
                </Button>
                <Button
                  type="secondary"
                  onClick={handleRequestChanges}
                >
                  Request Changes
                </Button>
              </BlockNew>
            )}
          </BlockNew>
        </BlockNew>
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
