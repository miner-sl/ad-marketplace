import { useNavigate } from 'react-router-dom'
import {
  BlockNew,
  PageLayout,
  Page,
  TelegramBackButton,
  TelegramMainButton,
  Button,
  Text,
} from '@components'
import { ChannelCard } from '@components'
import {
  useChannelListingsQuery,
  useDeleteChannelListingMutation,
} from '@store-new'
import { useUser } from '@store'
import styles from './MyListingsPage.module.scss'

export const MyListingsPage = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: listings, isLoading } = useChannelListingsQuery({
    is_active: true,
  })
  const deleteMutation = useDeleteChannelListingMutation()

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this listing?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        console.error('Failed to delete listing:', error)
      }
    }
  }

  const myListings =
    listings?.filter((listing) => listing.channel?.owner_id === user?.id) || []

  return (
    <Page back>
      <PageLayout>
        <TelegramBackButton />
        <TelegramMainButton
          text="Create New Listing"
          onClick={() => navigate('/marketplace/channel-owner/create-listing')}
        />
        <BlockNew gap={16} className={styles.container}>
          <BlockNew padding="0 16px">
            <Text type="hero" weight="bold">
              My Channel Listings
            </Text>
          </BlockNew>

          {isLoading ? (
            <Text type="text" color="secondary" align="center">
              Loading...
            </Text>
          ) : myListings.length > 0 ? (
            <BlockNew gap={8}>
              {myListings.map((listing) => (
                <div key={listing.id}>
                  {listing.channel && (
                    <ChannelCard channel={listing.channel} />
                  )}
                  <BlockNew padding="0 16px" row gap={8} marginValue={8}>
                    <Button
                      type="secondary"
                      onClick={() =>
                        navigate(`/marketplace/listings/${listing.id}/edit`)
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      type="danger"
                      onClick={() => handleDelete(listing.id)}
                    >
                      Delete
                    </Button>
                  </BlockNew>
                </div>
              ))}
            </BlockNew>
          ) : (
            <Text type="text" color="secondary" align="center">
              You don't have any listings yet. Create one to get started!
            </Text>
          )}
        </BlockNew>
      </PageLayout>
    </Page>
  )
}
