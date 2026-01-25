import { Context, Markup } from 'telegraf';
import { UserModel } from '../models/User';
import { DealFlowService } from '../services/dealFlow';
import { DealModel } from '../models/Deal';
import { ChannelModel } from '../models/Channel';
import { CampaignModel } from '../models/Campaign';
import { TelegramService } from '../services/telegram';
import { CreativeService } from '../services/creative';
import { TONService } from '../services/ton';
import db from '../db/connection';

export class BotHandlers {
  /**
   * Helper to safely answer callback query (only if it's a callback query)
   */
  private static async safeAnswerCbQuery(ctx: Context, text: string) {
    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery(text);
      } catch (error) {
        // Ignore errors if not a callback query context
      }
    }
  }

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
    const user = await UserModel.findOrCreate({
      telegram_id: ctx.from!.id,
      username: ctx.from!.username,
      first_name: ctx.from!.first_name,
      last_name: ctx.from!.last_name,
    });

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
      message = ''; // Clear for next channel
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

    const campaigns = await CampaignModel.findByAdvertiser(user.id);
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
      message = ''; // Clear for next campaign
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
    const channels = await db.query(
      `SELECT DISTINCT c.* FROM channels c
       INNER JOIN channel_pricing p ON c.id = p.channel_id
       WHERE c.is_active = TRUE AND p.is_active = TRUE
       ORDER BY c.created_at DESC
       LIMIT 20`
    );

    if (channels.rows.length === 0) {
      return ctx.reply('No channels available at the moment.');
    }

    let message = `📺 Available Channels (${channels.rows.length}):\n\n`;

    for (const channel of channels.rows) {
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
      message = ''; // Clear for next channel
    }
  }

  /**
   * Handle /requests command (channel owner views incoming requests)
   */
  static async handleIncomingRequests(ctx: Context) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    // Get pending deals for user's channels
    const deals = await db.query(
      `SELECT d.* FROM deals d
       INNER JOIN channels c ON d.channel_id = c.id
       WHERE c.owner_id = $1 AND d.status = 'pending'
       ORDER BY d.created_at DESC
       LIMIT 20`,
      [user.id]
    );

    if (deals.rows.length === 0) {
      return ctx.reply('No pending requests at the moment.');
    }

    let message = `📨 Incoming Requests (${deals.rows.length}):\n\n`;

    for (const deal of deals.rows) {
      const channel = await db.query('SELECT title, username FROM channels WHERE id = $1', [deal.channel_id]);
      const channelName = channel.rows[0]?.title || channel.rows[0]?.username || `Channel #${deal.channel_id}`;
      
      // Get brief message
      const brief = await db.query(
        `SELECT message_text FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [deal.id]
      );

      message += `📋 Deal #${deal.id}\n`;
      message += `📺 Channel: ${channelName}\n`;
      message += `💰 Price: ${deal.price_ton} TON\n`;
      message += `📝 Format: ${deal.ad_format}\n`;
      if (brief.rows[0]) {
        const briefText = brief.rows[0].message_text.substring(0, 100);
        message += `📄 Brief: ${briefText}${brief.rows[0].message_text.length > 100 ? '...' : ''}\n`;
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
      message = ''; // Clear for next deal
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
      'cancelled': '❌ Cancelled',
      'refunded': '💰 Refunded'
    };
    return statusMap[status] || status;
  }

  /**
   * Get emoji for deal status
   */
  static getDealStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'pending': '⏳',
      'negotiating': '💬',
      'approved': '✅',
      'payment_pending': '💰',
      'paid': '✅',
      'creative_submitted': '📝',
      'creative_approved': '✅',
      'scheduled': '📅',
      'posted': '📤',
      'verified': '✅',
      'completed': '✅',
      'cancelled': '❌',
      'refunded': '💰'
    };
    return emojiMap[status] || '📋';
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
    const messages = await db.query(
      'SELECT * FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC',
      [deal.id]
    );

    // Get creative if exists
    const creative = await db.query(
      'SELECT * FROM creatives WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [deal.id]
    );

    // Get channel information
    const channelResult = await db.query(
      'SELECT id, title, username, telegram_channel_id FROM channels WHERE id = $1',
      [deal.channel_id]
    );
    const channel = channelResult.rows[0];

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
      dealInfo += `Send ${deal.price_ton} TON to:\n`;
      dealInfo += `${deal.escrow_address}\n\n`;
      dealInfo += `After sending payment, click "✅ Confirm Payment" below.\n`;
    } else if (deal.escrow_address) {
      dealInfo += `Escrow: ${deal.escrow_address.substring(0, 20)}...\n`;
    }
    
    dealInfo += `\n💬 Messages: ${messages.rows.length}\n`;

    // Show brief (first message) if available
    if (messages.rows.length > 0) {
      const briefMessage = messages.rows[0];
      const briefText = briefMessage.message_text;
      const briefPreviewLength = 300;
      const briefPreview = briefText.length > briefPreviewLength 
        ? briefText.substring(0, briefPreviewLength) + '...' 
        : briefText;
      dealInfo += `\n📄 Brief:\n${this.escapeMarkdown(briefPreview)}\n`;
    }

    console.log(creative.rows);
    if (creative.rows[0]) {
      const creativeData = creative.rows[0].content_data;
      dealInfo += `\n📝 Creative Status: ${creative.rows[0].status}\n`;
      
      // Show creative text if available
      if (creativeData && creativeData.text) {
        const creativeText = creativeData.text;
        const previewLength = 200;
        const creativePreview = creativeText.length > previewLength 
          ? creativeText.substring(0, previewLength) + '...' 
          : creativeText;
        dealInfo += `\n📄 Creative Text:\n${this.escapeMarkdown(creativePreview)}\n`;
      }
    }
    // Show recent messages
    if (messages.rows.length > 0) {
      // dealInfo += `\n📨 Recent messages: ${messages.rows.length}\n`;
    //   messages.rows.slice(-3).forEach((msg: any) => {
    //     const sender = msg.sender_id === deal.channel_owner_id ? 'Channel Owner' : 'Advertiser';
    //     // Escape user content to prevent Markdown parsing errors
    //     const messagePreview = msg.message_text.substring(0, 50);
    //     const escapedMessage = this.escapeMarkdown(messagePreview);
    //     dealInfo += `\n${sender}: ${escapedMessage}${msg.message_text.length > 50 ? '...' : ''}`;
    //   });
    }

    // Add action buttons based on deal status and user role
    const buttons: any[] = [];

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

    // Show confirm publication button for advertiser when post is published
    if (deal.status === 'posted' && isAdvertiser) {
      const channelLinkData = this.getChannelLink(channel);
      
      // Add View Post button if post_message_id exists
      if (deal.post_message_id && channelLinkData?.channelLink) {
        const postLink = `${channelLinkData.channelLink}/${deal.post_message_id}`;
        buttons.push([
          Markup.button.url('🔗 View Post', postLink)
        ]);
      }
      
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
          await DealFlowService.acceptDeal(dealId, user.id, ctx.from!.id);
          
          // Get updated deal with escrow address
          const acceptedDeal = await DealModel.findById(dealId);
          if (!acceptedDeal || !acceptedDeal.escrow_address) {
            return ctx.reply('Error: Deal or escrow address not found');
          }

          // Get advertiser
          const advertiser = await UserModel.findById(acceptedDeal.advertiser_id);
          if (!advertiser) {
            return ctx.reply('Error: Advertiser not found');
          }

          // Get channel info
          const channelInfo = await db.query(
            'SELECT title, username FROM channels WHERE id = $1',
            [acceptedDeal.channel_id]
          );
          const channelData = channelInfo.rows[0];
          const channelName = channelData?.title || channelData?.username || `Channel #${acceptedDeal.channel_id}`;

          // Send payment invoice to advertiser
          const invoiceMessage = 
            `💰 Payment Invoice for Deal #${dealId}\n\n` +
            `Channel: ${channelName}\n` +
            `Format: ${acceptedDeal.ad_format}\n` +
            `Amount: ${acceptedDeal.price_ton} TON\n\n` +
            `Please send ${acceptedDeal.price_ton} TON to the escrow address:\n\n` +
            `\`${acceptedDeal.escrow_address}\`\n\n` +
            `After sending payment, click "✅ Confirm Payment" below.\n\n` +
            `This is a system-managed escrow wallet. Funds will be held until the post is published and verified.`;

          const invoiceButtons = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💳 Copy Escrow Address', callback_data: `copy_escrow_${dealId}` },
                  { text: '📋 View Deal Details', callback_data: `deal_details_${dealId}` }
                ],
                [
                  { text: '✅ Confirm Payment', callback_data: `confirm_payment_${dealId}` }
                ]
              ]
            }
          };

          await TelegramService.bot.sendMessage(advertiser.telegram_id, invoiceMessage, invoiceButtons);

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

    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, user.id, messageText]
    );

    // Notify other party
    const otherUserId = deal.channel_owner_id === user.id ? deal.advertiser_id : deal.channel_owner_id;
    const otherUser = await UserModel.findById(otherUserId);
    if (otherUser) {
      await TelegramService.bot.sendMessage(
        otherUser.telegram_id,
        `💬 New message in Deal #${dealId}:\n\n${messageText}\n\nUse /deal ${dealId} to view.`
      );
    }

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

    // Create deal
    const channel = await db.query('SELECT owner_id FROM channels WHERE id = $1', [pending.channelId]);
    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    const deal = await DealModel.create({
      deal_type: 'campaign',
      channel_id: pending.channelId,
      channel_owner_id: channel.rows[0].owner_id,
      advertiser_id: pending.userId,
      ad_format: pending.adFormat,
      price_ton: pending.priceTon
    });

    // Save brief as first message
    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [deal.id, pending.userId, briefText]
    );

    this.pendingDealRequests.delete(ctx.from!.id);

    // Notify channel owner about new request
    const channelOwner = await UserModel.findById(deal.channel_owner_id);
    if (channelOwner) {
      // Get channel info
      const channelInfo = await db.query(
        'SELECT title, username FROM channels WHERE id = $1',
        [deal.channel_id]
      );
      const channelData = channelInfo.rows[0];
      const channelName = channelData?.title || channelData?.username || `Channel #${deal.channel_id}`;

      // Get brief preview
      const briefPreview = briefText.substring(0, 200);
      const briefTextDisplay = briefText.length > 200 ? `${briefPreview}...` : briefPreview;

      const notificationMessage = 
        `📨 New Ad Request for Deal #${deal.id}!\n\n` +
        `📺 Channel: ${channelName}\n` +
        `💰 Price: ${deal.price_ton} TON\n` +
        `📝 Format: ${deal.ad_format}\n\n` +
        `📄 Brief:\n${briefTextDisplay}\n\n` +
        `Please review and accept or decline the request.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Accept', callback_data: `accept_request_${deal.id}` },
              { text: '❌ Decline', callback_data: `decline_request_${deal.id}` }
            ],
            [
              { text: '📝 Send to Draft', callback_data: `send_to_draft_${deal.id}` }
            ],
            [
              { text: '📋 View Deal', callback_data: `deal_details_${deal.id}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        channelOwner.telegram_id,
        notificationMessage,
        notificationButtons
      );
    }

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
   * Check bot admin status
   */
  static async checkBotAdmin(ctx: Context, channelId?: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    if (!channelId) {
      await ctx.reply(
        `Please provide channel ID:\n\n` +
        `/register_channel -1001234567890\n\n` +
        `Or use the button below:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Check Bot Admin Status', 'check_bot_admin_new')]
        ])
      );
      return;
    }

    const isAdmin = await TelegramService.isBotAdmin(channelId);
    
    if (!isAdmin) {
      await ctx.reply(
        `❌ Bot is not admin of channel ${channelId}\n\n` +
        `Please add @${(await TelegramService.bot.getMe()).username} as admin to your channel and try again.`
      );
      return;
    }

    // Get channel info
    const channelInfo = await TelegramService.getChannelInfo(channelId);
    
    // Check if channel already exists
    const existing = await ChannelModel.findByTelegramId(channelId);
    if (existing) {
      await ctx.reply(
        `✅ Channel already registered!\n\n` +
        `Channel: ${channelInfo.title || channelInfo.username || `Channel #${channelId}`}\n` +
        `Use /mychannels to manage.`
      );
      return;
    }

    // Create channel
    const channel = await ChannelModel.create({
      owner_id: user.id,
      telegram_channel_id: channelId,
      username: channelInfo.username,
      title: channelInfo.title,
      description: channelInfo.description
    });

    await ChannelModel.updateBotAdmin(channel.id, (await TelegramService.bot.getMe()).id);

    await ctx.reply(
      `✅ Channel registered successfully!\n\n` +
      `Channel: ${channel.title || channel.username || `Channel #${channel.id}`}\n` +
      `ID: ${channel.id}\n\n` +
      `Next steps:\n` +
      `• Set pricing using /set_price_${channel.id} <format> <amount>\n` +
      `• Or use the button below:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💰 Set Pricing', `set_pricing_menu_${channel.id}`)]
      ])
    );
  }

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

    const channel = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    if (channel.rows[0].owner_id !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    const isAdmin = await TelegramService.isBotAdmin(channel.rows[0].telegram_channel_id);
    
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

    const channel = await db.query('SELECT owner_id FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    if (channel.rows[0].owner_id !== user.id) {
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

    let message = `💰 Pricing for Channel #${channelId}:\n\n`;
    pricing.forEach((p) => {
      message += `• ${p.ad_format}: ${p.price_ton} TON\n`;
    });

    await ctx.reply(message);
  }

  /**
   * Handle set pricing menu
   */
  static async handleSetPricingMenu(ctx: Context, channelId: number) {
    const user = await UserModel.findByTelegramId(ctx.from!.id);
    if (!user) {
      return ctx.reply('Please use /start first');
    }

    const channel = await db.query('SELECT owner_id FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    if (channel.rows[0].owner_id !== user.id) {
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
      await DealFlowService.acceptDeal(dealId, user.id, ctx.from!.id);
      
      const deal = await DealModel.findById(dealId);
      if (!deal || !deal.escrow_address) {
        return ctx.reply('Error: Deal or escrow address not found');
      }

      // Get advertiser
      const advertiser = await UserModel.findById(deal.advertiser_id);
      if (!advertiser) {
        return ctx.reply('Error: Advertiser not found');
      }

      // Send payment invoice to advertiser
      const invoiceMessage = 
        `💰 Payment Invoice for Deal #${dealId}\n\n` +
        `Channel: #${deal.channel_id}\n` +
        `Format: ${deal.ad_format}\n` +
        `Amount: ${deal.price_ton} TON\n\n` +
        `Please send ${deal.price_ton} TON to the escrow address:\n\n` +
        `${deal.escrow_address}\n\n` +
        `After sending payment, click "✅ Confirm Payment" below.\n\n` +
        `This is a system-managed escrow wallet. Funds will be held until the post is published and verified.`;

      const invoiceButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Copy Escrow Address', callback_data: `copy_escrow_${dealId}` },
              { text: '📋 View Deal Details', callback_data: `deal_details_${dealId}` }
            ],
            [
              { text: '✅ Confirm Payment', callback_data: `confirm_payment_${dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(advertiser.telegram_id, invoiceMessage, invoiceButtons);

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

    await DealModel.updateStatus(dealId, 'cancelled');

    // Save cancellation message
    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [dealId, user.id, 'Deal declined by channel owner']
    );

    // Notify advertiser
    const advertiser = await UserModel.findById(deal.advertiser_id);
    if (advertiser) {
      // Get channel info for notification
      const channelInfo = await db.query(
        'SELECT title, username FROM channels WHERE id = $1',
        [deal.channel_id]
      );
      const channelData = channelInfo.rows[0];
      const channelName = channelData?.title || channelData?.username || `Channel #${deal.channel_id}`;

      const notificationMessage = 
        `❌ Deal #${dealId} Declined\n\n` +
        `The channel owner has declined your ad request.\n\n` +
        `📺 Channel: ${channelName}\n` +
        `💰 Price: ${deal.price_ton} TON\n` +
        `📝 Format: ${deal.ad_format}\n\n` +
        `You can browse other channels or create a new request.\n\n` +
        `Use /deal ${dealId} to view details.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 View Deal', callback_data: `deal_details_${dealId}` },
              { text: '📺 Browse Channels', callback_data: 'browse_channels' }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        notificationMessage,
        notificationButtons
      );
    }

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

        // Notify channel owner
        const channelOwner = await UserModel.findById(deal.channel_owner_id);
        if (channelOwner) {
          const ownerNotificationButtons = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 View Deal', callback_data: `deal_details_${dealId}` }
                ]
              ]
            }
          };

          await TelegramService.bot.sendMessage(
            channelOwner.telegram_id,
            `✅ Payment received for Deal #${dealId}!\n\n` +
            `Amount: ${deal.price_ton} TON\n` +
            `You can now publish the post.\n\n` +
            `Use the button below to view deal details.`,
            ownerNotificationButtons
          );
        }

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
          `We couldn't detect payment of ${deal.price_ton} TON at the escrow address.\n\n` +
          `Please verify:\n` +
          `• You sent exactly ${deal.price_ton} TON\n` +
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

    // Notify advertiser
    const advertiser = await UserModel.findById(deal.advertiser_id);
    if (advertiser) {
      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        `📝 Creative submitted for Deal #${dealId}!\n\n` +
        `Please review and approve or request revisions.\n\n` +
        `Use /deal ${dealId} to view details.`
      );
    }

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

      // Notify channel owner
      const deal = await DealModel.findById(dealId);
      if (deal) {
        const channelOwner = await UserModel.findById(deal.channel_owner_id);
        if (channelOwner) {
          await TelegramService.bot.sendMessage(
            channelOwner.telegram_id,
            `✅ Creative approved for Deal #${dealId}!\n\n` +
            `You can now publish the post.\n\n` +
            `Use /deal ${dealId} to view details.`
          );
        }
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

    const channel = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    if (channel.rows[0].owner_id !== user.id) {
      return ctx.reply('You are not the owner of this channel');
    }

    try {
      const stats = await TelegramService.fetchChannelStats(channel.rows[0].telegram_channel_id);
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

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to pause this campaign');
    }

    await CampaignModel.update(campaignId, { status: 'closed' });
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

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to close this campaign');
    }

    await CampaignModel.update(campaignId, { status: 'closed' });
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

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      return ctx.reply('Campaign not found');
    }

    if (campaign.advertiser_id !== user.id) {
      return ctx.reply('You are not authorized to reactivate this campaign');
    }

    await CampaignModel.update(campaignId, { status: 'active' });
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

    // Update deal status to negotiating
    await DealModel.updateStatus(pending.dealId, 'negotiating');

    // Save comment as message
    await db.query(
      `INSERT INTO deal_messages (deal_id, sender_id, message_text)
       VALUES ($1, $2, $3)`,
      [pending.dealId, pending.userId, `📝 Draft feedback: ${commentText}`]
    );

    this.pendingDraftComments.delete(ctx.from!.id);

    // Notify advertiser
    const advertiser = await UserModel.findById(deal.advertiser_id);
    if (advertiser) {
      const notificationMessage = 
        `📝 Deal #${pending.dealId} Sent to Draft\n\n` +
        `The channel owner has sent your request back for revision.\n\n` +
        `💬 Feedback:\n${commentText}\n\n` +
        `Please review the feedback and update your brief if needed.\n\n` +
        `Use /deal ${pending.dealId} to view details and edit your brief.`;

      const notificationButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 View Deal', callback_data: `deal_details_${pending.dealId}` }
            ]
          ]
        }
      };

      await TelegramService.bot.sendMessage(
        advertiser.telegram_id,
        notificationMessage,
        notificationButtons
      );
    }

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

    if (deal.status !== 'paid') {
      return ctx.reply(`Cannot publish post. Deal status: ${deal.status}`);
    }

    // Get creative (any status, prefer approved or submitted)
    const creative = await db.query(
      `SELECT * FROM creatives 
       WHERE deal_id = $1 
       ORDER BY 
         CASE status 
           WHEN 'approved' THEN 1
           WHEN 'submitted' THEN 2
           ELSE 3
         END,
         created_at DESC 
       LIMIT 1`,
      [deal.id]
    );

    if (creative.rows.length === 0) {
      return ctx.reply('No creative found. Please submit a creative first.');
    }

    // Get channel info
    const channel = await db.query(
      'SELECT telegram_channel_id FROM channels WHERE id = $1',
      [deal.channel_id]
    );

    if (channel.rows.length === 0) {
      return ctx.reply('Channel not found');
    }

    const channelId = channel.rows[0].telegram_channel_id;
    const creativeData = creative.rows[0].content_data;

    try {
      // Publish post to channel
      let messageId: number | undefined;
      
      if (creativeData.text) {
        const sentMessage = await TelegramService.bot.sendMessage(
          channelId,
          creativeData.text,
          { parse_mode: creativeData.parse_mode || undefined }
        );
        messageId = sentMessage.message_id;
      } else {
        return ctx.reply('Creative has no text content to publish.');
      }

      if (messageId) {
        // Record post
        const verificationUntil = new Date();
        verificationUntil.setHours(verificationUntil.getHours() + 24); // 24h verification period

        await DealModel.recordPost(deal.id, messageId, verificationUntil);
        await DealModel.updateStatus(deal.id, 'posted');

        console.log(`✅ Post published for Deal #${deal.id} to channel ${channelId}`);

        // Get channel info for link
        const channelInfo = await db.query(
          'SELECT username, telegram_channel_id FROM channels WHERE id = $1',
          [deal.channel_id]
        );
        const channelData = channelInfo.rows[0];
        
        // Build post link
        let postLink = '';
        if (channelData?.username) {
          postLink = `https://t.me/${channelData.username.replace('@', '')}/${messageId}`;
        } else if (channelData?.telegram_channel_id) {
          // Convert channel ID format: -1001234567890 -> 1234567890
          const channelIdStr = channelData.telegram_channel_id.toString().replace('-100', '');
          postLink = `https://t.me/c/${channelIdStr}/${messageId}`;
        }

        // Notify advertiser to confirm publication
        const advertiser = await UserModel.findById(deal.advertiser_id);
        if (advertiser) {
          const confirmMessage = 
            `📤 Post Published for Deal #${deal.id}!\n\n` +
            `The channel owner has published the post.\n\n` +
            (postLink ? `🔗 View Post: <a href="${postLink}">Click here</a>\n\n` : '') +
            `Please verify that the post is visible in the channel and click "✅ Confirm Publication" below.\n\n` +
            `After your confirmation, funds will be released to the channel owner.\n\n` +
            `Use /deal ${deal.id} to view details.`;

          const confirmButtons = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Confirm Publication', callback_data: `confirm_publication_${deal.id}` }
                ],
                [
                  { text: '📋 View Deal', callback_data: `deal_details_${deal.id}` }
                ]
              ]
            },
            parse_mode: 'HTML' as const
          };

          await TelegramService.bot.sendMessage(advertiser.telegram_id, confirmMessage, confirmButtons);
        }

        // Build post link for channel owner
        let ownerPostLink = '';
        if (channelData?.username) {
          ownerPostLink = `https://t.me/${channelData.username.replace('@', '')}/${messageId}`;
        } else if (channelData?.telegram_channel_id) {
          const channelIdStr = channelData.telegram_channel_id.toString().replace('-100', '');
          ownerPostLink = `https://t.me/c/${channelIdStr}/${messageId}`;
        }

        const ownerButtons: any[] = [];
        if (ownerPostLink) {
          ownerButtons.push([
            Markup.button.url('🔗 View Post', ownerPostLink)
          ]);
        }
        ownerButtons.push([
          Markup.button.callback('📋 View Deal', `deal_details_${deal.id}`)
        ]);

        await ctx.reply(
          `✅ Post published successfully!\n\n` +
          `Deal #${deal.id} post has been published to the channel.\n\n` +
          `Waiting for advertiser confirmation...\n\n` +
          `After advertiser confirms, funds will be released to your wallet.\n\n` +
          `Use /deal ${deal.id} to view details.`,
          Markup.inlineKeyboard(ownerButtons)
        );
      }
    } catch (error: any) {
      console.error(`❌ Error publishing post for Deal #${deal.id}:`, error);
      await ctx.reply(`❌ Error publishing post: ${error.message}`);
    }
  }

  /**
   * Handle confirm publication (advertiser confirms post is published)
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

    if (deal.status !== 'posted') {
      return ctx.reply(`Deal is not in 'posted' status. Current status: ${deal.status}`);
    }

    if (!deal.escrow_address || !deal.channel_owner_wallet_address) {
      return ctx.reply('Escrow address or channel owner wallet address not set.');
    }

    try {
      // Release funds to channel owner
      const txHash = await TONService.releaseFunds(
        deal.escrow_address,
        deal.channel_owner_wallet_address,
        deal.price_ton.toString()
      );

      // Update deal status
      await DealModel.markVerified(deal.id);
      await DealModel.markCompleted(deal.id);

      console.log(`✅ Funds released for Deal #${deal.id}: ${txHash}`);

      // Notify channel owner
      const channelOwner = await UserModel.findById(deal.channel_owner_id);
      if (channelOwner) {
        await TelegramService.bot.sendMessage(
          channelOwner.telegram_id,
          `✅ Deal #${deal.id} Completed!\n\n` +
          `The advertiser has confirmed publication.\n` +
          `Funds (${deal.price_ton} TON) have been released to your wallet:\n` +
          `${deal.channel_owner_wallet_address}\n\n` +
          `Transaction: ${txHash}\n\n` +
          `Use /deal ${deal.id} to view details.`
        );
      }

      await ctx.reply(
        `✅ Publication Confirmed!\n\n` +
        `Deal #${deal.id} has been completed.\n` +
        `Funds (${deal.price_ton} TON) have been released to the channel owner.\n\n` +
        `Transaction: ${txHash}\n\n` +
        `Use /deal ${deal.id} to view details.`
      );
    } catch (error: any) {
      console.error(`❌ Error releasing funds for Deal #${deal.id}:`, error);
      await ctx.reply(`❌ Error releasing funds: ${error.message}\n\nPlease contact support.`);
    }
  }
}
