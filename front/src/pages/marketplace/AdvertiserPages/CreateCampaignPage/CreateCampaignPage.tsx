import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Text,
  ListInput,
} from '@components'
// import { useCreateCampaignMutation } from '@store-new'
import styles from './CreateCampaignPage.module.scss'
import type {AdFormat} from "@types";
import {useCreateCampaignMutation} from "@store-new";

export const CreateCampaignPage = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budgetTon, setBudgetTon] = useState('')
  const [minSubscribers, setMinSubscribers] = useState('')
  const [maxSubscribers, setMaxSubscribers] = useState('')
  const [minViews, setMinViews] = useState('')
  const [selectedFormats, setSelectedFormats] = useState<AdFormat[]>(['post'])

  const createCampaignMutation = useCreateCampaignMutation()

  const toggleFormat = (format: AdFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    )
  }

  const handleSubmit = async () => {
    if (!title.trim()) return

    try {
      await createCampaignMutation.mutateAsync({
        title,
        description: description || undefined,
        budget_ton: budgetTon ? parseFloat(budgetTon) : undefined,
        target_subscribers_min: minSubscribers
          ? parseInt(minSubscribers)
          : undefined,
        target_subscribers_max: maxSubscribers
          ? parseInt(maxSubscribers)
          : undefined,
        target_views_min: minViews ? parseInt(minViews) : undefined,
        preferred_formats: selectedFormats.length > 0 ? selectedFormats : undefined,
      })
      navigate('/marketplace/advertiser/my-campaigns')
    } catch (error) {
      console.error('Failed to create campaign:', error)
    }
  }

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <BlockNew gap={16} className={styles.container}>
        <BlockNew padding="0 16px">
          <Text type="title" weight="bold">
            Create Campaign
          </Text>
        </BlockNew>

        <BlockNew gap={12}>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Campaign Title *
            </Text>
            <ListInput
              value={title}
              onChange={(value) => setTitle(value)}
              placeholder="e.g., Promote my new product"
              required
            />
          </BlockNew>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Description
            </Text>
            <ListInput
              value={description}
              onChange={(value) => setDescription(value)}
              placeholder="Describe your campaign goals and requirements"
            />
          </BlockNew>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Budget (TON)
            </Text>
            <ListInput
              value={budgetTon}
              onChange={(value) => setBudgetTon(value)}
              placeholder="0.0"
              type="number"
            />
          </BlockNew>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Min Subscribers
            </Text>
            <ListInput
              value={minSubscribers}
              onChange={(value) => setMinSubscribers(value)}
              placeholder="0"
              type="number"
            />
          </BlockNew>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Max Subscribers
            </Text>
            <ListInput
              value={maxSubscribers}
              onChange={(value) => setMaxSubscribers(value)}
              placeholder="0"
              type="number"
            />
          </BlockNew>
          <BlockNew gap={4}>
            <Text type="text" weight="medium">
              Min Average Views
            </Text>
            <ListInput
              value={minViews}
              onChange={(value) => setMinViews(value)}
              placeholder="0"
              type="number"
            />
          </BlockNew>

          <BlockNew gap={8}>
            <Text type="title2" weight="bold">
              Preferred Ad Formats
            </Text>
            <BlockNew row gap={8}>
              {(['post', 'forward', 'story'] as AdFormat[]).map((format) => (
                <div
                  key={format}
                  onClick={() => toggleFormat(format)}
                  className={`${styles.formatOption} ${
                    selectedFormats.includes(format) ? styles.selected : ''
                  }`}
                >
                  <Text type="text">{format}</Text>
                </div>
              ))}
            </BlockNew>
          </BlockNew>
        </BlockNew>

        <TelegramMainButton
          text={
            createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'
          }
          onClick={handleSubmit}
          disabled={!title.trim() || createCampaignMutation.isPending}
        />
      </BlockNew>
      </PageLayout>
    </Page>
  )
}
