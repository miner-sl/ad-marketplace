import {goTo} from './goTo';

export const getBotToChannelLink = (botUsername: string): string => {
  return `https://t.me/${botUsername}?startchannel=&admin=post_stories+post_messages`
}

export const addBotToChannelLink = (botUsername: string) => {
  const link = getBotToChannelLink(botUsername);
  goTo(link);
};

