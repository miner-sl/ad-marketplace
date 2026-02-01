import { Route, Routes } from 'react-router-dom'

import {
  MarketplaceHomePage,
  CreateListingPage,
  MyListingsPage,
  MyDealsPage as ChannelOwnerMyDealsPage,
  MyChannelsPage,
  CreateCampaignPage,
  AdvertiserMyDealsPage,
  MyCampaignsPage,
  DealDetailsPage,
  ChannelDetailsPage,
  BrowseChannelsPage,
  RequestsPage,
  RequestPostPage,
} from '../pages/marketplace'
import { AddBotToChatPage } from '../pages'

import {ROUTES_NAME} from "./routes";

export {ROUTES_NAME};
export default function AppRouter() {
 return (
   <Routes>
     <Route
       path={ROUTES_NAME.MARKETPLACE_HOME}
       element={<MarketplaceHomePage />}
     />
     <Route
       path={ROUTES_NAME.MARKETPLACE_CHANNEL_OWNER_CREATE_LISTING}
       element={<CreateListingPage />}
     />
     <Route
       path={ROUTES_NAME.MARKETPLACE_CHANNEL_OWNER_MY_LISTINGS}
       element={<MyListingsPage />}
     />
     <Route
       path={ROUTES_NAME.MARKETPLACE_CHANNEL_OWNER_MY_DEALS}
       element={<ChannelOwnerMyDealsPage />}
     />
     <Route
       path={ROUTES_NAME.MARKETPLACE_ADVERTISER_CREATE_CAMPAIGN}
       element={<CreateCampaignPage />}
     />
    <Route
      path={ROUTES_NAME.MARKETPLACE_ADVERTISER_MY_DEALS}
      element={<AdvertiserMyDealsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_MY_CHANNELS}
      element={<MyChannelsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_MY_CAMPAIGNS}
      element={<MyCampaignsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_DEAL_DETAILS}
      element={<DealDetailsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_CHANNEL_DETAILS}
      element={<ChannelDetailsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_BROWSE_CHANNELS}
      element={<BrowseChannelsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_REQUESTS}
      element={<RequestsPage />}
    />
    <Route
      path={ROUTES_NAME.MARKETPLACE_REQUEST_POST}
      element={<RequestPostPage />}
    />
    <Route
      path={ROUTES_NAME.ADD_TELEGRAM_CHAT}
      element={<AddBotToChatPage />}
    />
   </Routes>
 );
}
