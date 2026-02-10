/**
 * Build Telegram bot admin link for adding bot to channel
 * @param botUsername - Bot username (without @)
 * @param channelUsername - Channel username (with or without @)
 * @returns Telegram deep link URL for adding bot as admin
 */
export function buildBotAdminLink(botUsername: string, channelUsername?: string | null): string {
  // Format: https://t.me/botusername?startchannel=channelusername&admin=post_stories+post_messages
  const channelParam = channelUsername ? channelUsername.replace('@', '') : '';
  return channelParam
    ? `https://t.me/${botUsername}?startchannel=${channelParam}&admin=post_stories+post_messages`
    : `https://t.me/${botUsername}?startchannel=&admin=post_stories+post_messages`;
}
