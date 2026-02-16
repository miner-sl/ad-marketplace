import {useNavigate} from 'react-router-dom'
import type {Deal} from '@types'
import {Block, Text} from '@components'
import {DealStatusBadge} from '../DealStatusBadge'
import {separateNumber} from '@utils'
import styles from './DealCard.module.scss'

interface DealCardProps {
  deal: Deal
  onClick?: () => void
}

export const DealCard = ({deal, onClick}: DealCardProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate(`/marketplace/deals/${deal.id}`)
    }
  }

  const channelName =
    deal.channel?.title || `@${deal.channel?.username || 'channel'}`

  return (
    <div className={styles.root}>
      <Block
        onClick={handleClick}
        paddingValue={2}
        marginValue={0}
      >
        <Block gap={2}>
          <Block row justify="between" align="start" gap={2}>
            <div style={{flex: 1}}>
              <Block gap={2}>
                <Text type="title2" weight="bold">
                  Deal #{deal.id}
                </Text>
                <Text type="caption" color="secondary">
                  {deal.deal_type === 'listing' ? 'Channel Listing' : 'Campaign'}
                </Text>
              </Block>
            </div>
            <DealStatusBadge status={deal.status}/>
          </Block>
          <Block gap={2} marginValue={0}>
            <Text type="text">
              Channel: <strong>{channelName}</strong>
            </Text>
            <Text type="text">
              Format: <strong>{deal.ad_format}</strong>
            </Text>
            <Text type="text" weight="bold" color="accent">
              Price: {deal.price_ton} TON
            </Text>
          </Block>
          {deal.channel?.stats && (
            <Block row gap={8} marginValue={0}>
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
            </Block>
          )}
        </Block>
      </Block>
    </div>
  )
}
