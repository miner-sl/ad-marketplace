import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import { BotController } from './bot.controller';
import { ChannelModel } from '../repositories/channel-model.repository';
import db from '../db/connection';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN!;
export const bot = new Telegraf(botToken);

console.log(botToken)

const formatDealsList = (deals: any[], header: string): string => {
  return deals.reduce((message, d: any, index: number) => (
    `${message}\n---\n` +
      `${index + 1}. Deal #${d.id}\n` +
      `   Status: ${d.status}\n` +
      `   Price: ${d.price_ton} TON\n` +
      `   Format: ${d.ad_format}\n` +
      `   Use /deal ${d.id} for details\n\n`
  ), `${header}\n\n`);
};

bot.start((ctx) => BotController.handleStart(ctx));
bot.help((ctx) => BotController.handleHelp(ctx));

bot.command('mydeals', (ctx) => BotController.handleMyDeals(ctx));
bot.command('mychannels', (ctx) => BotController.handleMyChannels(ctx));
bot.command('mycampaigns', (ctx) => BotController.handleMyCampaigns(ctx));
bot.command('browse_channels', (ctx) => BotController.handleBrowseChannels(ctx));
bot.command('requests', (ctx) => BotController.handleIncomingRequests(ctx));
bot.command('register_channel', async (ctx) => {
  const args = ctx.message.text.split(' ');
  // Check if channel ID provided: /register_channel -1001234567890
  if (args.length > 1) {
    const channelId = parseInt(args[1]);
    if (channelId) {
      await BotController.checkBotAdmin(ctx, channelId);
      return;
    }
  }
  await BotController.handleRegisterChannel(ctx);
});

bot.command('verify_admins', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const channelId = args.length > 1 ? parseInt(args[1]) : undefined;
  await BotController.handleVerifyAdmins(ctx, channelId);
});

// Handle set price command: /set_price_<channel_id> <format> <amount>
bot.hears(/^\/set_price_(\d+)\s+(\w+)\s+([\d.]+)$/, async (ctx) => {
  const match = ctx.message.text.match(/^\/set_price_(\d+)\s+(\w+)\s+([\d.]+)$/);
  if (match) {
    const channelId = parseInt(match[1]);
    const format = match[2];
    const amount = parseFloat(match[3]);
    await BotController.handleSetPriceCommand(ctx, channelId, format, amount);
  }
});

bot.command('deal', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Usage: /deal <deal_id>');
  }
  await BotController.handleDeal(ctx, args[1]);
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (ctx) => {
  if (!('data' in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;
  if (!data) return;

  // Handle deal actions
  if (data.startsWith('deal_action_')) {
    const parts = data.split('_');
    const dealId = parseInt(parts[2]);
    const action = parts[3];
    const userId = parseInt(parts[4]);
    await BotController.handleDealAction(ctx, dealId, action, userId);
    return;
  }

  // Handle check bot admin button
  if (data.startsWith('check_bot_admin_')) {
    const channelIdStr = data.split('_').pop();
    const channelId = channelIdStr === 'new' ? undefined : parseInt(channelIdStr || '0');
    await BotController.checkBotAdmin(ctx, channelId);
    return;
  }

  // Handle set pricing buttons: set_price_<channelId>_<format>
  if (data.startsWith('set_price_')) {
    const parts = data.split('_');
    // Format: set_price_<channelId>_<format>
    if (parts.length >= 4 && parts[0] === 'set' && parts[1] === 'price') {
      const channelId = parseInt(parts[2]);
      const format = parts.slice(3).join('_'); // Handle formats with underscores
      if (channelId && format) {
        await BotController.handleSetPricing(ctx, channelId, format);
        return;
      }
    }
  }

  // Handle view pricing
  if (data.startsWith('view_pricing_')) {
    const channelId = parseInt(data.split('_')[2]);
    await BotController.handleViewPricing(ctx, channelId);
    try {
      await ctx.answerCbQuery('Loading pricing');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle pricing done
  if (data.startsWith('pricing_done_')) {
    // const channelId = parseInt(data.split('_')[2]);
    await ctx.reply(
      `✅ Pricing setup complete!\n\n` +
      `Your channel is ready to receive deals.\n\n` +
      `Use /mychannels to manage your channels.\n` +
      `Use /mydeals to view your deals.`
    );
    try {
      await ctx.answerCbQuery('Setup complete');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle deal message button
  if (data.startsWith('deal_message_')) {
    const dealId = parseInt(data.split('_')[2]);
    await ctx.reply(
      `To send a message in Deal #${dealId}, use:\n\n` +
      `/msg_deal ${dealId} your message here\n\n` +
      `Example:\n` +
      `/msg_deal ${dealId} Hello, I have a question about the creative`
    );
    try {
      await ctx.answerCbQuery('Use command format');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle deal details
  if (data.startsWith('deal_details_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleDeal(ctx, dealId.toString());
    try {
      await ctx.answerCbQuery('Loading deal details');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle channel details
  if (data.startsWith('channel_details_')) {
    const channelId = parseInt(data.split('_')[2]);
    const channel = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
    if (channel.rows.length === 0) {
      await ctx.reply('Channel not found');
      return;
    }

    const stats = await ChannelModel.getLatestStats(channelId);
    const pricing = await ChannelModel.getPricing(channelId);
    const channelData = channel.rows[0];

    let message = `📺 Channel Details\n\n`;
    message += `Name: ${channelData.title || channelData.username || 'Unnamed'}\n`;
    message += `ID: ${channelData.id}\n`;
    message += `Telegram: @${channelData.username || `channel_${channelData.telegram_channel_id}`}\n\n`;

    if (stats) {
      message += `📊 Statistics:\n`;
      if (stats.subscribers_count) {
        message += `• Subscribers: ${stats.subscribers_count.toLocaleString()}\n`;
      }
      if (stats.average_views) {
        message += `• Avg Views: ${stats.average_views.toLocaleString()}\n`;
      }
      if (stats.average_reach) {
        message += `• Avg Reach: ${stats.average_reach.toLocaleString()}\n`;
      }
      message += '\n';
    }

    if (pricing.length > 0) {
      message += `💰 Pricing:\n`;
      pricing.forEach((p) => {
        message += `• ${p.ad_format}: ${p.price_ton} TON\n`;
      });
    }

    const buttons: any[] = [];
    pricing.forEach((p) => {
      buttons.push([
        Markup.button.callback(
          `Request ${p.ad_format} (${p.price_ton} TON)`,
          `create_deal_${channelId}_${p.ad_format}_${p.price_ton}`
        )
      ]);
    });

    await ctx.reply(message, buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined);
    try {
      await ctx.answerCbQuery('Channel details');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle create deal request
  if (data.startsWith('create_deal_')) {
    const parts = data.split('_');
    if (parts.length >= 5) {
      const channelId = parseInt(parts[2]);
      const adFormat = parts[3];
      const priceTon = parseFloat(parts[4]);
      if (channelId && adFormat && priceTon) {
        await BotController.handleCreateDealRequest(ctx, channelId, adFormat, priceTon);
        return;
      }
    }
  }

  // Handle accept request
  if (data.startsWith('accept_request_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleAcceptRequest(ctx, dealId);
    return;
  }

  // Handle decline request
  if (data.startsWith('decline_request_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleDeclineRequest(ctx, dealId);
    return;
  }

  // Handle confirm payment button
  if (data.startsWith('confirm_payment_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleConfirmPaymentButton(ctx, dealId);
    return;
  }

  // Handle copy escrow address button
  if (data.startsWith('copy_escrow_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleCopyEscrowAddress(ctx, dealId);
    return;
  }

  // Handle draft creative button
  if (data.startsWith('draft_creative_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleDraftCreative(ctx, dealId);
    return;
  }

  // Handle submit creative button
  if (data.startsWith('submit_creative_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleSubmitCreative(ctx, dealId);
    return;
  }

  // Handle approve creative button
  if (data.startsWith('approve_creative_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleApproveCreative(ctx, dealId);
    return;
  }

  // Handle request revision button
  if (data.startsWith('request_revision_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleRequestRevision(ctx, dealId);
    return;
  }

  // Handle publish post button
  if (data.startsWith('publish_post_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handlePublishPost(ctx, dealId);
    return;
  }

  // Handle confirm publication button
  if (data.startsWith('confirm_publication_')) {
    const dealId = parseInt(data.split('_')[2]);
    await BotController.handleConfirmPublication(ctx, dealId);
    return;
  }

  // Handle send to draft button
  if (data.startsWith('send_to_draft_')) {
    const dealId = parseInt(data.split('_')[3]);
    await BotController.handleSendToDraft(ctx, dealId);
    return;
  }

  // Handle channel actions
  if (data.startsWith('refresh_stats_')) {
    const channelId = parseInt(data.split('_')[2]);
    await BotController.handleRefreshStats(ctx, channelId);
    return;
  }

  if (data.startsWith('set_pricing_menu_')) {
    const channelId = parseInt(data.split('_')[3]);
    await BotController.handleSetPricingMenu(ctx, channelId);
    try {
      await ctx.answerCbQuery('Pricing menu');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  if (data.startsWith('view_admins_')) {
    const channelId = parseInt(data.split('_')[2]);
    await BotController.handleVerifyAdmins(ctx, channelId);
    try {
      await ctx.answerCbQuery('Loading admins');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  if (data.startsWith('view_deals_channel_')) {
    const channelId = parseInt(data.split('_')[3]);
    const deals = await db.query(
      'SELECT * FROM deals WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 10',
      [channelId]
    );
    if (deals.rows.length === 0) {
      await ctx.reply(`No deals found for channel ${channelId}`);
    } else {
      const message = formatDealsList(deals.rows, `🤝 Deals for Channel #${channelId}:`);
      await ctx.reply(message);
    }
    try {
      await ctx.answerCbQuery('Deals loaded');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  if (data.startsWith('view_deals_campaign_')) {
    const campaignId = parseInt(data.split('_')[3]);
    const deals = await db.query(
      'SELECT * FROM deals WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 10',
      [campaignId]
    );
    if (deals.rows.length === 0) {
      await ctx.reply(`No deals found for campaign ${campaignId}`);
    } else {
      const message = formatDealsList(deals.rows, `🤝 Deals for Campaign #${campaignId}:`);
      await ctx.reply(message);
    }
    try {
      await ctx.answerCbQuery('Deals loaded');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  // Handle campaign actions
  if (data.startsWith('edit_campaign_')) {
    const campaignId = parseInt(data.split('_')[2]);
    await ctx.reply(
      `To edit campaign #${campaignId}, use:\n` +
      `PUT /api/campaigns/${campaignId}\n\n` +
      `Or contact support for assistance.`
    );
    try {
      await ctx.answerCbQuery('Use API endpoint');
    } catch {
      // Not a callback query, ignore
    }
    return;
  }

  if (data.startsWith('pause_campaign_')) {
    const campaignId = parseInt(data.split('_')[2]);
    await BotController.handlePauseCampaign(ctx, campaignId);
    return;
  }

  if (data.startsWith('close_campaign_')) {
    const campaignId = parseInt(data.split('_')[2]);
    await BotController.handleCloseCampaign(ctx, campaignId);
    return;
  }

  if (data.startsWith('reactivate_campaign_')) {
    const campaignId = parseInt(data.split('_')[2]);
    await BotController.handleReactivateCampaign(ctx, campaignId);
    return;
  }

  try {
    await ctx.answerCbQuery('Unknown action');
  } catch {
    // Not a callback query, ignore
  }
});

// Handle text messages for deal negotiations, pricing, and briefs
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Check if it's a deal message command
  if (text.startsWith('/msg_deal ')) {
    const parts = text.substring(10).split(' ');
    if (parts.length >= 2) {
      const dealId = parseInt(parts[0]);
      const messageText = parts.slice(1).join(' ');
      if (dealId && messageText) {
        await BotController.handleDealMessage(ctx, dealId, messageText);
        return;
      }
    } else {
      await ctx.reply('Usage: /msg_deal <deal_id> <your message>');
      return;
    }
  }

  // Handle cancel command
  if (text === '/cancel') {
    await BotController.handleCancelPendingRequest(ctx);
    return;
  }

  // Check if user is waiting to submit brief
  if (BotController.isWaitingForBrief(ctx.from!.id)) {
    await BotController.handleBriefSubmission(ctx, text);
    return;
  }

  // Check if user is waiting to submit creative draft
  if (BotController.isWaitingForCreativeDraft(ctx.from!.id)) {
    await BotController.handleCreativeDraftSubmission(ctx, text);
    return;
  }

  // Check if user is waiting to submit revision notes
  if (BotController.isWaitingForRevisionNotes(ctx.from!.id)) {
    await BotController.handleRevisionNotesSubmission(ctx, text);
    return;
  }

  // Check if user is waiting to submit draft comment
  if (BotController.isWaitingForDraftComment(ctx.from!.id)) {
    await BotController.handleDraftCommentSubmission(ctx, text);
    return;
  }

});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('An error occurred. Please try again.');
});

export default bot;
