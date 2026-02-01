import {useParams} from 'react-router-dom'
import {openTelegramLink} from '@tma.js/sdk-react'
import {BlockNew, Button, DealStatusBadge, PageLayout, Page, TelegramBackButton, Text,} from '@components'
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

export const DealDetailsPage = () => {
  const { id } = useParams<{ id: string }>()
  // const navigate = useNavigate()
  // const { user } = useUser()
  const dealId = id ? parseInt(id) : 0

  const { data: deal, isLoading } = useDealQuery(dealId)
  // const { data: creative } = useDealCreativeQuery(dealId)
  const acceptDealMutation = useAcceptDealMutation()
  const rejectDealMutation = useRejectDealMutation()
  const approveCreativeMutation = useApproveCreativeMutation()
  const requestRevisionMutation = useRequestCreativeRevisionMutation()
  const creative = undefined;
  // const submitCreativeMutation = useSubmitCreativeMutation()
  const user = useTelegramUser()
  const { copy } = useClipboard()
  if (isLoading || !deal) {
    return (
      <Page back>
        <PageLayout>
          <TelegramBackButton />
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

  const getChannelLink = (): string | null => {
    if (!deal.channel) return null
    if (deal.channel.username) {
      return `https://t.me/${deal.channel.username.replace('@', '')}`
    }
    if (deal.channel.telegram_channel_id) {
      // For private channels, use the channel ID format
      const channelId = deal.channel.telegram_channel_id.toString().replace('-100', '')
      return `https://t.me/c/${channelId}`
    }
    return null
  }

  let channelLink = getChannelLink();
  console.log({ deal,channelLink });
  const handleChannelClick = () => {
    const link = channelLink
    if (link) {
      openTelegramLink(link)
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

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
        <BlockNew padding="0 16px">
          <BlockNew row justify="between" align="center" gap={12}>
            <Text type="hero">
              Deal #{deal.id}
            </Text>
            <DealStatusBadge status={deal.status} />
          </BlockNew>
        </BlockNew>

        <BlockNew gap={12} padding="0 16px">
          <BlockNew gap={4}>
            <BlockNew row>
              {channelLink ? (
                <span style={{ textDecoration: 'underline' }}>
                  <Text
                    type="text"
                    color="accent"
                    onClick={handleChannelClick}
                  >
                    {`@${deal.channel?.title}` || `@${deal.channel?.username || 'channel'}`}
                  </Text>
                </span>
              ) : (
                <Text type="text">
                  Channel: {deal.channel?.title || `@${deal.channel?.username || 'channel'}`}
                </Text>
              )}
            </BlockNew>
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
            <BlockNew row>
              <Text
                type="text"
                onClick={() => copy(deal.escrow_address!, 'Escrow address copied')}
              >
                Escrow Address: {collapseAddress(deal.escrow_address, 4)}
              </Text>
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
        </BlockNew>
      </BlockNew>
      </PageLayout>
    </Page>
  )
}
