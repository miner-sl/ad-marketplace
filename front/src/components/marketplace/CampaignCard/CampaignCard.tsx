import { useNavigate } from 'react-router-dom'
import type { Campaign } from '../../../types'
import { Block, Text } from '../../index';
import { separateNumber } from '../../../common/utils'
import styles from './CampaignCard.module.scss'

interface CampaignCardProps {
  campaign: Campaign
  onClick?: () => void
}

export const CampaignCard = ({ campaign, onClick }: CampaignCardProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate(`/marketplace/campaigns/${campaign.id}`)
    }
  }

  return (
    <div className={styles.root}>
      <Block
        onClick={handleClick}
        paddingValue={16}
        marginValue={8}
      >
        <Block gap={8}>
        <Block row justify="between" align="start" gap={12}>
          <Text type="title2" weight="bold">
            {campaign.title}
          </Text>
          <Text
            type="caption"
            color={
              campaign.status === 'active'
                ? 'accent'
                : campaign.status === 'completed'
                  ? 'primary'
                  : 'secondary'
            }
          >
            {campaign.status}
          </Text>
        </Block>
        {campaign.description && (
          <Text type="caption" color="secondary">
            {campaign.description.slice(0, 150)}
            {campaign.description.length > 150 ? '...' : ''}
          </Text>
        )}
        <Block row gap={16} marginValue={8}>
          {campaign.budget_ton && (
            <Text type="caption" color="secondary">
              💰 Budget: {campaign.budget_ton} TON
            </Text>
          )}
          {campaign.target_subscribers_min && (
            <Text type="caption" color="secondary">
              👥 Min: {separateNumber(campaign.target_subscribers_min)}
            </Text>
          )}
          {campaign.target_subscribers_max && (
            <Text type="caption" color="secondary">
              Max: {separateNumber(campaign.target_subscribers_max)}
            </Text>
          )}
        </Block>
        {campaign.preferred_formats && campaign.preferred_formats.length > 0 && (
          <Block row gap={8} marginValue={8}>
            <Text type="caption" color="secondary">
              Formats:
            </Text>
            {campaign.preferred_formats.map((format) => (
              <Text key={format} type="caption" color="accent">
                {format}
              </Text>
            ))}
          </Block>
        )}
        </Block>
      </Block>
    </div>
  )
}
