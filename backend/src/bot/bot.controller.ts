import { Context, Markup } from 'telegraf';
import { UserModel } from '../repositories/user.repository';
import { DealFlowService } from '../services/deal-flow.service';
import { DealModel } from '../repositories/deal-model.repository';
import { ChannelModel } from '../repositories/channel-model.repository';
import { ChannelService } from '../services/channel.service';
import { TelegramService } from '../services/telegram.service';
import { CreativeService } from '../services/creative.service';
import { TONService } from '../services/ton.service';
import { TelegramNotificationService } from '../services/telegram-notification.service';
import { ChannelRepository } from '../repositories/channel.repository';
import { DealRepository } from '../repositories/deal.repository';
import { CreativeRepository } from '../repositories/creative.repository';
import logger from '../utils/logger';
import { buildBotAdminLink } from '../utils/telegram';
import {CampaignRepository} from "../repositories/campaign.repository";

export class BotController {
  /**
   * Escape Markdown special characters
   */
  private static escapeMarkdown(text: string): string {
    return text
      .replace(/\_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\~/g, '\\~')
      .replace(/\`/g, '\\`')
      .replace(/\>/g, '\\>')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
  }

  /**
   * Handle /start command
   */
  static async handleStart(ctx: Context) {
    await ctx.reply(
      `Welcome to Ad Marketplace! 🎯\n\n` +
      `You can:\n` +
      `• List your channel as a channel owner\n` +
      `• Create campaigns as an advertiser\n` +
      `• Manage deals and negotiations\n\n` +
      `Use /help for more commands.`
    );
  }

  /**
   * Handle /help command
   */
  static async handleHelp(ctx: Context) {
    await ctx.reply(
      `Available commands:\n\n` +
      `/start - Start using the bot\n` +
      `/mydeals - View your deals\n` +
      `/mychannels - View your channels\n` +
      `/mycampaigns - View your campaigns\n` +
      `/browse_channels - Browse available channels (Advertisers)\n` +
      `/requests - View incoming ad requests (Channel Owners)\n` +
      `/deal <id> - View deal details\n` +
      `/msg_deal <id> <message> - Send message in deal\n` +
      `/register_channel [channel_id] - Register channel\n` +
      `/set_price_<id> <format> <amount> - Set channel pricing\n` +
      `/verify_admins [channel_id] - Verify channel admins\n` +
      `/help - Show this help message\n\n` +
      `Use interactive buttons in deals for quick actions!`
    );
  }

  /**
   * Handle /mydeals command
   */
  static async handleMyDeals(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deals = await DealModel.findByUser(user.id);
    if (deals.length === 0) {
      return ctx.reply('You have no deals yet.');
    }

    const dealList = deals
      .slice(0, 10)
      .map(
        (deal) =>
          `Deal #${deal.id}\n` +
          `Status: ${this.formatDealStatus(deal.status)}\n` +
          `Type: ${deal.deal_type}\n` +
          `Price: ${deal.price_ton} TON\n` +
          `Format: ${deal.ad_format}\n`
      )
      .join('\n---\n');

    await ctx.reply(`Your deals:\n\n${dealList}`);
  }

  /**
   * Handle /mychannels command
   */
  static async handleMyChannels(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const channels = await ChannelModel.findByOwner(user.id);
    if (channels.length === 0) {
      return ctx.reply('You have no channels registered yet.\n\nUse /register_channel to add a channel.');
    }

    let message = `📺 Your Channels (${channels.length}):\n\n`;

    for (const channel of channels.slice(0, 10)) {
      const stats = await ChannelModel.getLatestStats(channel.id);
      const pricing = await ChannelModel.getPricing(channel.id);

      message += `📺 ${channel.title || channel.username || `Channel #${channel.id}`}\n`;
      message += `ID: ${channel.id}\n`;
      if (stats) {
        if (stats.subscribers_count) {
          message += `👥 ${stats.subscribers_count.toLocaleString()} subscribers\n`;
        }
        if (stats.average_views) {
          message += `👁️ ${stats.average_views.toLocaleString()} avg views\n`;
        }
      }
      if (pricing.length > 0) {
        message += `💰 Pricing: ${pricing.map(p => `${p.ad_format} (${p.price_ton} TON)`).join(', ')}\n`;
      }
      message += `Status: ${channel.is_verified ? '✅ Verified' : '⏳ Pending'}\n\n`;


      const buttons = [
        [
          Markup.button.callback('📊 View Stats', `refresh_stats_${channel.id}`),
          Markup.button.callback('💰 Set Pricing', `set_pricing_menu_${channel.id}`)
        ],
        [
          Markup.button.callback('👥 View Admins', `view_admins_${channel.id}`),
          Markup.button.callback('🤝 View Deals', `view_deals_channel_${channel.id}`)
        ]
      ];

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
      message = '';
    }
  }

  /**
   * Handle /mycampaigns command
   */
  static async handleMyCampaigns(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const campaigns = await CampaignRepository.findByAdvertiser(user.id);
    if (campaigns.length === 0) {
      return ctx.reply('You have no campaigns yet.');
    }

    let message = `📢 Your Campaigns (${campaigns.length}):\n\n`;

    for (const campaign of campaigns.slice(0, 10)) {
      message += `📢 ${campaign.title}\n`;
      message += `ID: ${campaign.id}\n`;
      message += `Status: ${this.formatCampaignStatus(campaign.status)}\n`;
      if (campaign.budget_ton) {
        message += `Budget: ${campaign.budget_ton} TON\n`;
      }
      message += `\n`;

      const buttons = [
        [
          Markup.button.callback('✏️ Edit', `edit_campaign_${campaign.id}`),
          Markup.button.callback('🤝 View Deals', `view_deals_campaign_${campaign.id}`)
        ]
      ];

      if (campaign.status === 'active') {
        buttons.push([
          Markup.button.callback('⏸️ Pause', `pause_campaign_${campaign.id}`),
          Markup.button.callback('🔒 Close', `close_campaign_${campaign.id}`)
        ]);
      } else if (campaign.status === 'closed') {
        buttons.push([
          Markup.button.callback('▶️ Reactivate', `reactivate_campaign_${campaign.id}`)
        ]);
      }

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
      message = '';
    }
  }

  /**
   * Handle /browse_channels command
   */
  static async handleBrowseChannels(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    // Get all active channels with pricing
    const channels = await ChannelRepository.findWithPricing(20);

    if (channels.length === 0) {
      return ctx.reply('No channels available at the moment.');
    }

    let message = `📺 Available Channels (${channels.length}):\n\n`;

    for (const channel of channels) {
      const stats = await ChannelModel.getLatestStats(channel.id);
      const pricing = await ChannelModel.getPricing(channel.id);

      message += `📺 ${channel.title || channel.username || `Channel #${channel.id}`}\n`;
      if (stats) {
        if (stats.subscribers_count) {
          message += `👥 ${stats.subscribers_count.toLocaleString()} subscribers\n`;
        }
        if (stats.average_views) {
          message += `👁️ ${stats.average_views.toLocaleString()} avg views\n`;
        }
      }
      if (pricing.length > 0) {
        message += `💰 From ${Math.min(...pricing.map(p => p.price_ton))} TON\n`;
      }
      message += `\n`;

      const buttons = [
        [
          Markup.button.callback('📋 View Details', `channel_details_${channel.id}`)
        ]
      ];

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
      message = '';
    }
  }

  /**
   * Handle /requests command (channel owner views incoming requests)
   */
  static async handleIncomingRequests(ctx: Context) {
    try {
      const { data: deals } = await DealFlowService.findDealRequestByTelegramId(ctx.from!.id, { limit: 20 });

      if (deals.length === 0) {
        return ctx.reply('No pending requests at the moment.');
      }

      let message = `📨 Incoming Requests (${deals.length}):\n\n`;

      for (const deal of deals) {
        const channelName = deal.channel?.title || deal.channel?.username || `Channel #${deal.channel_id}`;
        const briefText = deal.brief || null;

        message += `📋 Deal #${deal.id}\n`;
        message += `📺 Channel: ${channelName}\n`;
        message += `💰 Price: ${deal.price_ton} TON\n`;
        message += `📝 Format: ${deal.ad_format}\n`;
        if (briefText) {
          const briefPreview = briefText.substring(0, 100);
          message += `📄 Brief: ${briefPreview}${briefText.length > 100 ? '...' : ''}\n`;
        }
        message += `\n`;

        const buttons = [
          [
            Markup.button.callback('✅ Accept', `accept_request_${deal.id}`),
            Markup.button.callback('❌ Decline', `decline_request_${deal.id}`)
          ],
          [
            Markup.button.callback('📋 View Details', `deal_details_${deal.id}`)
          ]
        ];

        await ctx.reply(message, Markup.inlineKeyboard(buttons));
        message = '';
      }
    } catch (error: any) {
      if (error.message === 'User not found') {
        return ctx.reply('Please use /start first');
      }
      throw error;
    }
  }

  // Store pending deal requests waiting for brief
  private static pendingDealRequests = new Map<number, {
    channelId: number;
    adFormat: string;
    priceTon: number;
    userId: number;
  }>();

  // Store pending creative drafts waiting for submission (channel owner)
  private static pendingCreativeDrafts = new Map<number, {
    dealId: number;
    userId: number;
  }>();

  // Store pending revision notes
  private static pendingRevisionNotes = new Map<number, {
    dealId: number;
    userId: number;
  }>();

  // Store pending draft comments (for send to draft)
  private static pendingDraftComments = new Map<number, {
    dealId: number;
    userId: number;
  }>();

  /**
   * Check if user is waiting for brief submission
   */
  static isWaitingForBrief(telegramUserId: number): boolean {
    return this.pendingDealRequests.has(telegramUserId);
  }

  /**
   * Check if user is waiting for creative draft submission (channel owner)
   */
  static isWaitingForCreativeDraft(telegramUserId: number): boolean {
    return this.pendingCreativeDrafts.has(telegramUserId);
  }

  /**
   * Check if user is waiting for revision notes submission
   */
  static isWaitingForRevisionNotes(telegramUserId: number): boolean {
    return this.pendingRevisionNotes.has(telegramUserId);
  }

  /**
   * Check if user is waiting for draft comment submission
   */
  static isWaitingForDraftComment(telegramUserId: number): boolean {
    return this.pendingDraftComments.has(telegramUserId);
  }

  /**
   * Handle cancel pending request
   */
  static async handleCancelPendingRequest(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    if (this.pendingDealRequests.has(ctx.from!.id)) {
      this.pendingDealRequests.delete(ctx.from!.id);
      await ctx.reply('❌ Request cancelled. You can start a new request using /browse_channels');
    } else if (this.pendingCreativeDrafts.has(ctx.from!.id)) {
      this.pendingCreativeDrafts.delete(ctx.from!.id);
      await ctx.reply('❌ Creative draft cancelled.');
    } else if (this.pendingRevisionNotes.has(ctx.from!.id)) {
      this.pendingRevisionNotes.delete(ctx.from!.id);
      await ctx.reply('❌ Revision notes cancelled.');
    } else if (this.pendingDraftComments.has(ctx.from!.id)) {
      this.pendingDraftComments.delete(ctx.from!.id);
      await ctx.reply('❌ Draft comment cancelled.');
    } else {
      await ctx.reply('No pending operation to cancel.');
    }
  }

  /**
   * Format deal status for display
   */
  static formatDealStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '⏳ Pending',
      'negotiating': '💬 Negotiating',
      'approved': '✅ Approved',
      'payment_pending': '💰 Payment Pending',
      'paid': '✅ Paid',
      'creative_submitted': '📝 Creative Submitted',
      'creative_approved': '✅ Creative Approved',
      'scheduled': '📅 Scheduled',
      'posted': '📤 Posted',
      'verified': '✅ Verified',
      'completed': '✅ Completed',
      'declined': '❌ Declined',
      'refunded': '💰 Refunded'
    };
    return statusMap[status] || status;
  }

  /**
   * Format campaign status for display
   */
  static formatCampaignStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'draft': '📝 Draft',
      'active': '✅ Active',
      'closed': '🔒 Closed',
      'completed': '✅ Completed'
    };
    return statusMap[status] || status;
  }

  /**
   * Handle /deal command
   */
  static async handleDeal(ctx: Context, dealId: string) {
    const deal = await DealModel.findById(parseInt(dealId));
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user || (deal.channel_owner_id !== user.id && deal.advertiser_id !== user.id)) {
      return ctx.reply('You are not authorized to view this deal');
    }

    // Get messages
    const messages = await DealRepository.getMessages(deal.id);

    // Get creative if exists
    const creative = await CreativeRepository.findByDeal(deal.id);

    // Get channel information
    const channel = await DealRepository.getChannelInfoForDeal(deal.id);

    // Determine user role
    const isChannelOwner = deal.channel_owner_id === user.id;
    const isAdvertiser = deal.advertiser_id === user.id;

    let dealInfo = `📋 Deal #${deal.id}\n\n`;
    dealInfo += `Status: ${this.formatDealStatus(deal.status)}\n`;
    dealInfo += `Type: ${deal.deal_type}\n`;

    // Add channel link
    if (channel) {
      const channelLinkData = this.getChannelLink(channel);
      if (channelLinkData) {
        const {channelName, channelLink} = channelLinkData;
        if (channelLink) {
          dealInfo += `📺 Channel: <a href="${channelLink}">${channelName}</a>\n`;
        } else {
          dealInfo += `📺 Channel: ${channelName}\n`;
        }
      }
    }

    dealInfo += `Price: ${deal.price_ton} TON\n`;
    dealInfo += `Format: ${deal.ad_format}\n`;

    // Show scheduled publish date if set
    if (deal.scheduled_post_time) {
      const scheduledDate = new Date(deal.scheduled_post_time);
      const formattedDate = scheduledDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      dealInfo += `📅 Scheduled Publish: ${formattedDate}\n`;
    }

    // Show payment information for advertiser when payment is pending
    if (deal.status === 'payment_pending' && isAdvertiser && deal.escrow_address) {
      dealInfo += `\n💰 Payment Required:\n`;
      dealInfo += `Send ${deal.price_ton} USDT to:\n`;
      dealInfo += `${deal.escrow_address}\n\n`;
      dealInfo += `After sending payment, click "✅ Confirm Payment" below.\n`;
    } else if (deal.escrow_address) {
      dealInfo += `Escrow: ${deal.escrow_address.substring(0, 20)}...\n`;
    }

    dealInfo += `\n💬 Messages: ${messages.length}\n`;

    // Show brief (first message) if available
    if (messages.length > 0) {
      const briefMessage = messages[0];
      const briefText = briefMessage.message_text;
      const briefPreviewLength = 300;
      const briefPreview = briefText.length > briefPreviewLength
        ? briefText.substring(0, briefPreviewLength) + '...'
        : briefText;
      dealInfo += `\n📄 Brief:\n${this.escapeMarkdown(briefPreview)}\n`;
    }

    // if (creative) {
    //   const creativeData = creative.content_data;
    //   dealInfo += `\n📝 Creative Status: ${creative.status}\n`;
    //
    //   // Show creative text if available
    //   if (creativeData && creativeData.text) {
    //     const creativeText = creativeData.text;
    //     const previewLength = 200;
    //     const creativePreview = creativeText.length > previewLength
    //       ? creativeText.substring(0, previewLength) + '...'
    //       : creativeText;
    //     dealInfo += `\n📄 Creative Text:\n${this.escapeMarkdown(creativePreview)}\n`;
    //   }
    // }

    // Add action buttons based on deal status and user role
    const buttons: any[] = [];

    // Add View Post button if post is published
    if ((deal.status === 'posted' || deal.status === 'verified') && deal.post_message_id && channel) {
      const channelLinkData = this.getChannelLink(channel);
      if (channelLinkData?.channelLink) {
        const postLink = `${channelLinkData.channelLink}/${deal.post_message_id}`;
        buttons.push([
          Markup.button.url('🔗 View Post', postLink)
        ]);
      }
    }

    if (deal.status === 'pending' && isChannelOwner) {
      buttons.push([
        Markup.button.callback('✅ Accept', `deal_action_${deal.id}_accept_${user.id}`),
        Markup.button.callback('📝 Draft', `send_to_draft_${deal.id}`)
      ]);
      buttons.push([
        Markup.button.callback('❌ Decline', `decline_request_${deal.id}`)
      ]);
    }

    if (deal.status === 'payment_pending' && isAdvertiser && deal.escrow_address) {
      buttons.push([
        Markup.button.callback('💳 Pay Now', `copy_escrow_${deal.id}`),
        Markup.button.callback('✅ Confirm Payment', `confirm_payment_${deal.id}`)
      ]);
    }

    if (deal.status === 'paid' && isChannelOwner) {
      // Show publish post button when deal is paid
      buttons.push([
        Markup.button.callback('📤 Publish Post', `publish_post_${deal.id}`)
      ]);
    }

    // Show confirm publication button for advertiser ONLY when deal is verified
    // (after minimum post duration has passed and post was verified)
    if (deal.status === 'verified' && isAdvertiser) {
      buttons.push([
        Markup.button.callback('✅ Confirm Publication', `confirm_publication_${deal.id}`)
      ]);
    }

    if (deal.status === 'creative_submitted' && isAdvertiser) {
      buttons.push([
        Markup.button.callback('✅ Approve', `deal_action_${deal.id}_approve_creative_${user.id}`),
        Markup.button.callback('✏️ Request Revision', `deal_action_${deal.id}_request_revision_${user.id}`)
      ]);
    }

    buttons.push([
      Markup.button.callback('💬 Send Message', `deal_message_${deal.id}`),
      Markup.button.callback('📋 Full Details', `deal_details_${deal.id}`)
    ]);

    // Use HTML parse mode if channel link is present
    const parseMode = channel && (channel.username || channel.telegram_channel_id) ? 'HTML' : undefined;

    await ctx.reply(dealInfo, {
      ...Markup.inlineKeyboard(buttons),
      parse_mode: parseMode
    });
  }

  private static getChannelLink(channel: any): {channelName: string; channelLink: string} | undefined {
    if (!channel) {
      return undefined;
    }
    const channelName = channel.title || channel.username || `Channel #${channel.id}`;
    let channelLink = '';
    if (channel.username) {
      channelLink = `https://t.me/${channel.username.replace('@', '')}`;
    } else if (channel.telegram_channel_id) {
      channelLink = `https://t.me/c/${channel.telegram_channel_id.toString().replace('-100', '')}`;
    }
    return {channelName, channelLink};
  }

  /**
   * Handle deal action buttons
   */
  static async handleDealAction(ctx: Context, dealId: number, action: string, userId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user || user.id !== userId) {
      return ctx.reply('Unauthorized');
    }

    try {
      switch (action) {
        case 'accept':
          // await DealFlowService.acceptDeal(dealId, user.id, ctx.from!.id);

          const acceptedDeal = await DealModel.findById(dealId);
          if (!acceptedDeal || !acceptedDeal.escrow_address) {
            return ctx.reply('Error: Deal or escrow address not found');
          }

          const channelInfo = await DealFlowService.getChannelInfoForDeal(dealId);

          await TelegramNotificationService.notifyPaymentInvoice(dealId, acceptedDeal.advertiser_id, {
            dealId,
            channelId: channelInfo.channelId,
            channelName: channelInfo.channelName,
            priceTon: acceptedDeal.price_ton,
            adFormat: acceptedDeal.ad_format,
            escrowAddress: acceptedDeal.escrow_address,
          });

          await ctx.reply('✅ Deal accepted! Payment invoice sent to advertiser.');
          break;
        case 'submit_creative':
          this.pendingCreativeDrafts.set(ctx.from!.id, { dealId, userId: user.id });
          await ctx.reply('Please send your creative draft as text:');
          break;
        case 'approve_creative':
          await DealFlowService.approveCreative(dealId, user.id);
          await ctx.reply('✅ Creative approved!');
          break;
        case 'request_revision':
          this.pendingRevisionNotes.set(ctx.from!.id, { dealId, userId: user.id });
          await ctx.reply('Please send revision notes:');
          break;
        default:
          await ctx.reply('Unknown action');
      }
    } catch (error: any) {
      await ctx.reply(`Error: ${error.message}`);
    }
  }

  /**
   * Handle deal message
   */
  static async handleDealMessage(ctx: Context, dealId: number, messageText: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id && deal.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to message this deal');
    }

    await DealFlowService.addDealMessage(dealId, user.id, messageText);

    const otherUserId = deal.channel_owner_id === user.id ? deal.advertiser_id : deal.channel_owner_id;
    await TelegramNotificationService.notifyDealMessage(dealId, user.id, otherUserId, messageText);

    await ctx.reply('✅ Message sent!');
  }

  /**
   * Handle brief submission
   */
  static async handleBriefSubmission(ctx: Context, briefText: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const pending = this.pendingDealRequests.get(ctx.from!.id);
    if (!pending) {
      return ctx.reply('No pending request found.');
    }

    const ownerId = await ChannelRepository.getOwnerId(pending.channelId);
    if (!ownerId) {
      return ctx.reply('Channel not found');
    }

    const deal = await DealFlowService.createDealWithBrief({
      deal_type: 'campaign',
      channel_id: pending.channelId,
      channel_owner_id: ownerId,
      advertiser_id: pending.userId,
      ad_format: pending.adFormat,
      price_ton: pending.priceTon,
      briefText,
    });

    this.pendingDealRequests.delete(ctx.from!.id);

    const channelInfo = await DealFlowService.getChannelInfoForDeal(deal.id);
    const briefPreview = briefText.substring(0, 200);
    const briefTextDisplay = briefText.length > 200 ? `${briefPreview}...` : briefPreview;

    await TelegramNotificationService.notifyNewAdRequest(deal.id, deal.channel_owner_id, {
      dealId: deal.id,
      channelId: channelInfo.channelId,
      channelName: channelInfo.channelName,
      priceTon: deal.price_ton,
      adFormat: deal.ad_format,
      briefPreview: briefTextDisplay,
    });

    await ctx.reply(
      `✅ Request submitted!\n\n` +
      `Deal #${deal.id} has been created.\n` +
      `The channel owner will review your request.\n\n` +
      `Use /deal ${deal.id} to view details.`
    );
  }

  /**
   * Handle creative draft submission
   */
  static async handleCreativeDraftSubmission(ctx: Context, text: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const pending = this.pendingCreativeDrafts.get(ctx.from!.id);
    if (!pending) {
      return ctx.reply('No pending creative draft found.');
    }

    await DealFlowService.submitCreative(pending.dealId, pending.userId, {
      contentType: 'text',
      contentData: { text }
    });

    this.pendingCreativeDrafts.delete(ctx.from!.id);

    await ctx.reply('✅ Creative submitted! Waiting for advertiser approval.');
  }

  /**
   * Handle revision notes submission
   */
  static async handleRevisionNotesSubmission(ctx: Context, text: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const pending = this.pendingRevisionNotes.get(ctx.from!.id);
    if (!pending) {
      return ctx.reply('No pending revision notes found.');
    }

    await DealFlowService.requestRevision(pending.dealId, pending.userId, text);

    this.pendingRevisionNotes.delete(ctx.from!.id);

    await ctx.reply('✅ Revision requested! Channel owner will review.');
  }

  /**
   * Handle register channel
   */
  static async handleRegisterChannel(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    await ctx.reply(
      `📺 Register Channel\n\n` +
      `To register a channel:\n\n` +
      `1. Add @${(await TelegramService.bot.getMe()).username} as admin to your channel\n` +
      `2. Use command: /register_channel <channel_id>\n\n` +
      `Example: /register_channel -1001234567890\n\n` +
      `Or click the button below to check admin status:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Check Bot Admin Status', 'check_bot_admin_new')]
      ])
    );
  }

  /**
   * Handle check channel admin status button click
   * Validates if bot is admin of the channel
   */
  static async handleCheckChannelAdmin(ctx: Context, channelId: number, channelName: string) {
    try {
      await ctx.answerCbQuery('Checking admin status...');

      const isAdmin = await ChannelService.validateChannelAdmin(channelName);

      if (isAdmin) {
        await ctx.reply(
          `✅ Bot Admin Status: Verified\n\n` +
          `The bot is successfully added as admin to your channel.\n` +
          `Channel: ${channelName}\n\n` +
          `Your channel is ready to receive deals!`
        );
      } else {
        const botInfo = await TelegramService.bot.getMe();
        const botUsername = botInfo.username || '';
        const addBotLink = buildBotAdminLink(botUsername, channelName);

        await ctx.reply(
          `❌ Bot Admin Status: Not Admin\n\n` +
          `The bot is not yet added as admin to your channel.\n` +
          `Channel: ${channelName}\n\n` +
          `Please add the bot as admin with the following permissions:\n` +
          `• Post messages\n` +
          `• Post stories\n\n` +
          `Click the button below to add the bot:`,
          Markup.inlineKeyboard([
            [
              {
                text: '➕ Add Bot as Admin',
                url: addBotLink
              }
            ],
            [
              {
                text: '✅ Check Again',
                callback_data: `check_channel_admin_${channelId}_${channelName}`
              }
            ]
          ])
        );
      }
    } catch (error: any) {
      logger.error('Error checking channel admin status', {
        error: error.message,
        channelId,
        channelName,
      });
      await ctx.reply(
        `❌ Error checking admin status: ${error.message}\n\n` +
        `Please try again later.`
      );
    }
  }
  //
  // /**
  //  * Check bot admin status and register channel
  //  */
  // static async checkBotAdmin(ctx: Context, channelId?: number) {
  //   if (!channelId) {
  //     await ctx.reply(
  //       `Please provide channel ID:\n\n` +
  //       `/register_channel -1001234567890\n\n` +
  //       `Or use the button below:`,
  //       Markup.inlineKeyboard([
  //         [Markup.button.callback('✅ Check Bot Admin Status', 'check_bot_admin_new')]
  //       ])
  //     );
  //     return;
  //   }
  //
  //   const result = await ChannelService.registerChannel(ctx.from!.id, channelId);
  //
  //   if (!result.success) {
  //     switch (result.error) {
  //       case 'USER_NOT_FOUND':
  //         await ctx.reply(result.message || 'Please use /start first');
  //         return;
  //
  //       case 'BOT_NOT_ADMIN':
  //         await ctx.reply(
  //           `❌ Bot is not admin of channel ${channelId}\n\n` +
  //           `Please add @${result.botUsername || 'the bot'} as admin to your channel and try again.`
  //         );
  //         return;
  //
  //       case 'CHANNEL_ALREADY_EXISTS':
  //         const channelName = result.channelInfo?.title ||
  //                           result.channelInfo?.username ||
  //                           `Channel #${channelId}`;
  //         await ctx.reply(
  //           `✅ Channel already registered!\n\n` +
  //           `Channel: ${channelName}\n` +
  //           `Use /mychannels to manage.`
  //         );
  //         return;
  //
  //       case 'FAILED_TO_CREATE':
  //         await ctx.reply(
  //           `❌ Failed to register channel: ${result.message || 'Unknown error'}\n\n` +
  //           `Please try again or contact support.`
  //         );
  //         return;
  //
  //       default:
  //         await ctx.reply(
  //           `❌ An error occurred: ${result.message || 'Unknown error'}`
  //         );
  //         return;
  //     }
  //   }
  //
  //   if (result.channel && result.channelInfo) {
  //     const channelName = result.channel.title ||
  //                        result.channel.username ||
  //                        `Channel #${result.channel.id}`;
  //
  //     await ctx.reply(
  //       `✅ Channel registered successfully!\n\n` +
  //       `Channel: ${channelName}\n` +
  //       `ID: ${result.channel.id}\n\n` +
  //       `Next steps:\n` +
  //       `• Set pricing using /set_price_${result.channel.id} <format> <amount>\n` +
  //       `• Or use the button below:`,
  //       Markup.inlineKeyboard([
  //         [Markup.button.callback('💰 Set Pricing', `set_pricing_menu_${result.channel.id}`)]
  //       ])
  //     );
  //   }
  // }

  /**
   * Handle verify admins
   */
  static async handleVerifyAdmins(ctx: Context, channelId?: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    if (!channelId) {
      const channels = await ChannelModel.findByOwner(user.id);
      if (channels.length === 0) {
        return ctx.reply('You have no channels. Use /register_channel to add one.');
      }

      let message = `Select channel to verify admins:\n\n`;
      const buttons: any[] = [];
      for (const channel of channels.slice(0, 10)) {
        message += `${channel.title || channel.username || `Channel #${channel.id}`}\n`;
        buttons.push([
          Markup.button.callback(
            `Verify ${channel.title || channel.username || `#${channel.id}`}`,
            `view_admins_${channel.id}`
          )
        ]);
      }

      await ctx.reply(message, Markup.inlineKeyboard(buttons));
      return;
    }

    const channel = await ChannelRepository.findById(channelId);
    if (!channel) {
      return ctx.reply('Channel not found');
    }

    if (channel.owner_id !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    const isAdmin = await TelegramService.isBotAdmin(channel.telegram_channel_id!);

    await ctx.reply(
      `👥 Admin Status for Channel #${channelId}\n\n` +
      `Bot Admin: ${isAdmin ? '✅ Yes' : '❌ No'}\n` +
      `Channel Owner: ✅ Yes (You)\n\n` +
      `${isAdmin ? 'Bot is properly configured as admin.' : 'Please add bot as admin to enable features.'}`
    );
  }

  /**
   * Handle set price command
   */
  static async handleSetPriceCommand(ctx: Context, channelId: number, format: string, amount: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const ownerId = await ChannelRepository.getOwnerId(channelId);
    if (!ownerId) {
      return ctx.reply('Channel not found');
    }

    if (ownerId !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    await ChannelModel.setPricing(channelId, format, amount);

    await ctx.reply(
      `✅ Pricing set!\n\n` +
      `Channel: #${channelId}\n` +
      `Format: ${format}\n` +
      `Price: ${amount} TON`
    );
  }

  /**
   * Handle set pricing (interactive)
   */
  static async handleSetPricing(ctx: Context, channelId: number, format: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    await ctx.reply(
      `💰 Set Price for ${format}\n\n` +
      `Please send the price in TON using this format:\n\n` +
      `/set_price_${channelId} ${format} <amount>\n\n` +
      `Example: /set_price_${channelId} ${format} 10.5`
    );
  }

  /**
   * Handle view pricing
   */
  static async handleViewPricing(ctx: Context, channelId: number) {
    const pricing = await ChannelModel.getPricing(channelId);

    if (pricing.length === 0) {
      await ctx.reply('No pricing set for this channel yet.');
      return;
    }

    const result = pricing.reduce((message,p) => {
      return message + `• ${p.ad_format}: ${p.price_ton} TON\n`;
    },  `💰 Pricing for Channel #${channelId}:\n\n`);

    await ctx.reply(result);
  }

  /**
   * Handle set pricing menu
   */
  static async handleSetPricingMenu(ctx: Context, channelId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const ownerId = await ChannelRepository.getOwnerId(channelId);
    if (!ownerId) {
      return ctx.reply('Channel not found');
    }

    if (ownerId !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    const formats = ['post', 'forward', 'repost', 'story'];
    const buttons = formats.map(format => [
      Markup.button.callback(`Set ${format} price`, `set_price_${channelId}_${format}`)
    ]);

    buttons.push([
      Markup.button.callback('✅ Done', `pricing_done_${channelId}`)
    ]);

    await ctx.reply(
      `💰 Set Pricing for Channel #${channelId}\n\n` +
      `Select format to set price:`,
      Markup.inlineKeyboard(buttons)
    );
  }

  /**
   * Handle create deal request
   */
  static async handleCreateDealRequest(ctx: Context, channelId: number, adFormat: string, priceTon: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    // Store pending request
    this.pendingDealRequests.set(ctx.from!.id, {
      channelId,
      adFormat,
      priceTon,
      userId: user.id
    });

    await ctx.reply(
      `📝 Create Ad Request\n\n` +
      `Channel: #${channelId}\n` +
      `Format: ${adFormat}\n` +
      `Price: ${priceTon} TON\n\n` +
      `Please send your brief (post text/content):\n\n` +
      `Or type /cancel to cancel.`
    );
  }

  /**
   * Handle accept request
   */
  static async handleAcceptRequest(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    try {
      // await DealFlowService.acceptDeal(dealId, user.id, ctx.from!.id);

      const deal = await DealModel.findById(dealId);
      if (!deal || !deal.escrow_address) {
        return ctx.reply('Error: Deal or escrow address not found');
      }

      const channelInfo = await DealFlowService.getChannelInfoForDeal(dealId);

      await TelegramNotificationService.notifyPaymentInvoice(dealId, deal.advertiser_id, {
        dealId,
        channelId: channelInfo.channelId,
        channelName: channelInfo.channelName,
        priceTon: deal.price_ton,
        adFormat: deal.ad_format,
        escrowAddress: deal.escrow_address,
      });

      await ctx.reply('✅ Deal accepted! Payment invoice sent to advertiser.');
    } catch (error: any) {
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  /**
   * Handle decline request
   */
  static async handleDeclineRequest(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id) {
      return ctx.reply('You are not authorized to decline this deal');
    }

    await DealFlowService.declineDeal(dealId, user.id);

    const channelInfo = await DealFlowService.getChannelInfoForDeal(dealId);

    await TelegramNotificationService.notifyDealDeclined(dealId, deal.advertiser_id, {
      dealId,
      channelId: channelInfo.channelId,
      channelName: channelInfo.channelName,
      priceTon: deal.price_ton,
      adFormat: deal.ad_format,
    });

    await ctx.reply('❌ Deal declined. Advertiser has been notified.');
  }

  /**
   * Handle copy escrow address
   */
  static async handleCopyEscrowAddress(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to view this escrow address');
    }

    if (!deal.escrow_address) {
      return ctx.reply('Escrow address not set for this deal.');
    }

    await ctx.reply(
      `💳 Escrow Address for Deal #${dealId}\n\n` +
      `Send exactly ${deal.price_ton} TON to:\n\n` +
      `${deal.escrow_address}\n\n` +
      `After sending payment, click "✅ Confirm Payment" below.\n\n` +
      `Payment is usually auto-detected within 2 minutes.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Confirm Payment', `confirm_payment_${dealId}`)
        ],
        [
          Markup.button.callback('📋 View Deal', `deal_details_${dealId}`)
        ]
      ])
    );
  }

  /**
   * Handle confirm payment button
   */
  static async handleConfirmPaymentButton(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to confirm payment for this deal');
    }

    if (deal.status !== 'payment_pending') {
      return ctx.reply(`Deal is not in payment_pending status. Current status: ${deal.status}`);
    }

    if (!deal.escrow_address) {
      return ctx.reply('Escrow address not set for this deal.');
    }

    try {
      // Check payment on blockchain
      const paymentCheck = await TONService.checkPayment(
        deal.escrow_address,
        deal.price_ton.toString()
      );

      if (paymentCheck.received) {
        // Payment confirmed
        const txHash = paymentCheck.txHash || 'confirmed';
        await DealFlowService.confirmPayment(dealId, txHash);

        // Update status based on scheduled_post_time
        const updatedDeal = await DealModel.findById(dealId);
        if (updatedDeal?.scheduled_post_time) {
          await DealModel.updateStatus(dealId, 'scheduled');
        } else {
          await DealModel.updateStatus(dealId, 'paid');
        }

        await TelegramNotificationService.notifyPaymentReceived(dealId, deal.channel_owner_id, deal.price_ton);

        await ctx.reply(
          `✅ Payment Confirmed!\n\n` +
          `Deal #${dealId} payment has been verified.\n` +
          `The channel owner will now prepare the creative.\n\n` +
          `Use /deal ${dealId} to view details.`
        );
      } else {
        // Payment not found
        await ctx.reply(
          `❌ Payment Not Found\n\n` +
          `We couldn't detect payment of ${deal.price_ton} USDT at the escrow address.\n\n` +
          `Please verify:\n` +
          `• You sent exactly ${deal.price_ton} USDT\n` +
          `• You sent to: <code>${deal.escrow_address}</code>\n` +
          `• Transaction was completed\n\n` +
          `Current balance: ${paymentCheck.amount} TON\n\n` +
          `If you already sent the payment, please wait a few minutes for blockchain confirmation.\n` +
          `Payment is usually auto-detected within 2 minutes.\n\n` +
          `Click "✅ Confirm Payment" to check again.`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Confirm Payment', `confirm_payment_${dealId}`)
              ],
              [
                Markup.button.callback('📋 View Deal', `deal_details_${dealId}`)
              ]
            ])
          }
        );
      }
    } catch (error: any) {
      await ctx.reply(`❌ Error checking payment: ${error.message}`);
    }
  }

  /**
   * Handle draft creative
   */
  static async handleDraftCreative(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id) {
      return ctx.reply('You are not authorized to draft creative for this deal');
    }

    if (deal.status !== 'paid') {
      return ctx.reply(`Cannot draft creative. Deal status: ${deal.status}`);
    }

    this.pendingCreativeDrafts.set(ctx.from!.id, { dealId, userId: user.id });

    await ctx.reply(
      `📝 Draft Creative for Deal #${dealId}\n\n` +
      `Please send your creative draft as text:\n\n` +
      `Or type /cancel to cancel.`
    );
  }

  /**
   * Handle submit creative
   */
  static async handleSubmitCreative(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id) {
      return ctx.reply('You are not authorized to submit creative for this deal');
    }

    const creative = await CreativeService.findByDeal(dealId);
    if (!creative || creative.status !== 'draft') {
      return ctx.reply('No draft creative found. Please draft a creative first.');
    }

    await CreativeService.submit(dealId);
    await DealModel.updateStatus(dealId, 'creative_submitted');

    await TelegramNotificationService.notifyCreativeSubmitted(dealId, deal.advertiser_id);

    await ctx.reply('✅ Creative submitted! Waiting for advertiser approval.');
  }

  /**
   * Handle approve creative
   */
  static async handleApproveCreative(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    try {
      await DealFlowService.approveCreative(dealId, user.id);

      const deal = await DealModel.findById(dealId);
      if (deal) {
        await TelegramNotificationService.notifyCreativeApproved(dealId, deal.channel_owner_id);
      }

      await ctx.reply('✅ Creative approved! Channel owner can now publish.');
    } catch (error: any) {
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  /**
   * Handle request revision
   */
  static async handleRequestRevision(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to request revision for this deal');
    }

    this.pendingRevisionNotes.set(ctx.from!.id, { dealId, userId: user.id });

    await ctx.reply(
      `✏️ Request Revision for Deal #${dealId}\n\n` +
      `Please send your revision notes:\n\n` +
      `Or type /cancel to cancel.`
    );
  }

  /**
   * Handle refresh stats
   */
  static async handleRefreshStats(ctx: Context, channelId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const channel = await ChannelRepository.findById(channelId);
    if (!channel) {
      return ctx.reply('Channel not found');
    }

    if (channel.owner_id !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    try {
      const stats = await TelegramService.fetchChannelStats(channel.telegram_channel_id!);
      await ChannelModel.saveStats(channelId, stats);

      let message = `📊 Statistics Updated for Channel #${channelId}\n\n`;
      if (stats.subscribers_count) {
        message += `👥 Subscribers: ${stats.subscribers_count.toLocaleString()}\n`;
      }
      if (stats.average_views) {
        message += `👁️ Avg Views: ${stats.average_views.toLocaleString()}\n`;
      }
      if (stats.average_reach) {
        message += `📈 Avg Reach: ${stats.average_reach.toLocaleString()}\n`;
      }

      await ctx.reply(message);
    } catch (error: any) {
      await ctx.reply(`❌ Error refreshing stats: ${error.message}`);
    }
  }

  /**
   * Handle pause campaign
   */
  static async handlePauseCampaign(ctx: Context, campaignId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const campaign = await CampaignRepository.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to pause this campaign');
    }

    await CampaignRepository.update(campaignId, { status: 'closed' });
    await ctx.reply('⏸️ Campaign paused.');
  }

  /**
   * Handle close campaign
   */
  static async handleCloseCampaign(ctx: Context, campaignId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const campaign = await CampaignRepository.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to close this campaign');
    }

    await CampaignRepository.update(campaignId, { status: 'closed' });
    await ctx.reply('🔒 Campaign closed.');
  }

  /**
   * Handle reactivate campaign
   */
  static async handleReactivateCampaign(ctx: Context, campaignId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const campaign = await CampaignRepository.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to reactivate this campaign');
    }

    await CampaignRepository.update(campaignId, { status: 'active' });
    await ctx.reply('▶️ Campaign reactivated.');
  }

  /**
   * Handle send to draft (channel owner sends request back to advertiser with comments)
   */
  static async handleSendToDraft(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id) {
      return ctx.reply('You are not authorized to send this deal to draft');
    }

    if (deal.status !== 'pending') {
      return ctx.reply(`Cannot send to draft. Deal status: ${deal.status}`);
    }

    // Set pending state for draft comment
    this.pendingDraftComments.set(ctx.from!.id, { dealId, userId: user.id });

    await ctx.reply(
      `📝 Send to Draft for Deal #${dealId}\n\n` +
      `Please send your comments/feedback for the advertiser:\n\n` +
      `Or type /cancel to cancel.`
    );
  }

  /**
   * Handle draft comment submission
   */
  static async handleDraftCommentSubmission(ctx: Context, commentText: string) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const pending = this.pendingDraftComments.get(ctx.from!.id);
    if (!pending) {
      return ctx.reply('No pending draft comment found.');
    }

    const deal = await DealModel.findById(pending.dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    await DealFlowService.sendToDraft(pending.dealId, pending.userId, commentText);

    this.pendingDraftComments.delete(ctx.from!.id);

    await TelegramNotificationService.notifyDealSentToDraft(pending.dealId, deal.advertiser_id, commentText);

    await ctx.reply(
      `✅ Request sent to draft!\n\n` +
      `Deal #${pending.dealId} has been sent back to the advertiser with your feedback.\n` +
      `The advertiser will review your comments and can update their brief.\n\n` +
      `Use /deal ${pending.dealId} to view details.`
    );
  }

  /**
   * Handle publish post (channel owner publishes approved creative)
   */
  static async handlePublishPost(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.channel_owner_id !== user.id) {
      return ctx.reply('You are not authorized to publish post for this deal');
    }

    try {
      const { postLink } = await DealFlowService.publishPost(dealId, user.id);

      await TelegramNotificationService.notifyPostPublished(dealId, deal.advertiser_id, postLink);

      const ownerButtons: any[] = [];
      if (postLink) {
        ownerButtons.push([
          Markup.button.url('🔗 View Post', postLink)
        ]);
      }
      ownerButtons.push([
        Markup.button.callback('📋 View Deal', `deal_details_${dealId}`)
      ]);

      await ctx.reply(
        `✅ Post published successfully!\n\n` +
        `Deal #${dealId} post has been published to the channel.\n\n` +
        `Waiting for advertiser confirmation...\n\n` +
        `After advertiser confirms, funds will be released to your wallet.\n\n` +
        `Use /deal ${dealId} to view details.`,
        Markup.inlineKeyboard(ownerButtons)
      );
    } catch (error: any) {
      logger.error(`Error publishing post for Deal #${dealId}`, { dealId, error: error.message, stack: error.stack });
      await ctx.reply(`❌ Error publishing post: ${error.message}`);
    }
  }

  /**
   * Handle confirm publication (advertiser confirms post is published)
   * Verifies that:
   * 1. Post verification period has passed (24 hours)
   * 2. Post still exists in the channel
   * 3. Only then releases funds to channel owner
   */
  static async handleConfirmPublication(ctx: Context, dealId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const deal = await DealModel.findById(dealId);
    if (!deal) {
      return ctx.reply('Deal not found');
    }

    if (deal.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to confirm publication for this deal');
    }

    if (deal.status !== 'verified') {
      return ctx.reply(
        `Deal is not ready for confirmation. Current status: ${deal.status}\n\n` +
        (deal.status === 'posted'
          ? `The post verification period is not yet complete. Please wait.\n` +
            (deal.post_verification_until
              ? `Verification will be available after: ${new Date(deal.post_verification_until).toISOString()}\n`
              : '')
          : `Only deals in 'verified' status can be confirmed.\n')` +
        `Use /deal ${deal.id} to view details.`
      ));
    }

    if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
      return ctx.reply('Escrow address or channel owner wallet address not set.');
    }

    // Deal is already verified (status = 'verified'), so we can proceed with fund release
    // Verification period has passed and post was verified by cron job
    // Just do a final check that post still exists
    try {
      const { txHash } = await DealFlowService.confirmPublication(dealId, user.id);

      logger.info(`Funds released for Deal #${dealId}`, {
        dealId,
        txHash,
        advertiserId: user.id,
      });

      await TelegramNotificationService.notifyDealCompleted(dealId, deal.channel_owner_id, {
        dealId,
        priceTon: deal.price_ton,
        channelOwnerWalletAddress: deal.channel_owner_wallet_address,
        txHash,
      });

      await ctx.reply(
        `✅ Publication Confirmed!\n\n` +
        `Deal #${dealId} has been completed.\n` +
        `Post verification period completed and post verified.\n` +
        `Funds (${deal.price_ton} TON) have been released to the channel owner.\n\n` +
        `Transaction: ${txHash}\n\n` +
        `Use /deal ${dealId} to view details.`
      );
    } catch (error: any) {
      logger.error(`Error releasing funds for Deal #${dealId}`, {
        dealId,
        error: error.message,
        stack: error.stack,
      });
      await ctx.reply(`❌ Error releasing funds: ${error.message}\n\nPlease contact support.`);
    }
  }
}
