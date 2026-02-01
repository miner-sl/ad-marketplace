import { useNavigate } from 'react-router-dom'
import styles from './ChannelCard.module.scss'
import type {Channel} from "../../../types";
import {Block} from "../../Block";
import {Text} from "../../Text";
import {separateNumber} from "../../../common/utils";
import { ROUTES_NAME } from '@routes';

interface ChannelCardProps {
  channel: Channel
  onClick?: () => void
  showPricing?: boolean
}

export const ChannelCard = ({
  channel,
  onClick,
  showPricing = true,
}: ChannelCardProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate(ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS.replace(':id', channel.id.toString()))
    }
  }

  const postPricing = channel.pricing?.find((p) => p.ad_format === 'post')
  const subscribers = channel.stats?.subscribers_count || 0
  const avgViews = channel.stats?.average_views || 0

  return (
    <div className={styles.root}>
      <Block
        onClick={handleClick}
        paddingValue={16}
        marginValue={8}
      >
        <Block row justify="between" align="start" gap={12}>
          <div style={{ flex: 1 }}>
            <Block gap={8}>
            <Block row gap={8} align="center">
              <Text type="title2" weight="bold">
                {channel.title || `@${channel.username || 'channel'}`}
              </Text>
              {channel.price_ton && (
                <span className={styles.priceBadge}>
                  {channel.price_ton} TON
                </span>
              )}
            </Block>
            {channel.description && (
              <Text type="caption" color="secondary">
                {channel.description.slice(0, 100)}
                {channel.description.length > 100 ? '...' : ''}
              </Text>
            )}
            <Block row gap={12} marginValue={8}>
              {subscribers > 0 && (
                <Text type="caption" color="secondary">
                  👥 {separateNumber(subscribers)} subscribers
                </Text>
              )}
              {avgViews > 0 && (
                <Text type="caption" color="secondary">
                  👁️ {separateNumber(avgViews)} avg views
                </Text>
              )}
            </Block>
            {showPricing && postPricing && (
              <Block marginValue={8}>
                <Text type="text" weight="bold" color="accent">
                  {postPricing.price_ton} TON per post
                </Text>
              </Block>
            )}
            </Block>
          </div>
          {channel.is_verified && (
            <Text type="caption" color="accent">
              ✓ Verified
            </Text>
          )}
        </Block>
      </Block>
    </div>
  )
}
