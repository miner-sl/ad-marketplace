import {goTo} from './goTo';

export const getBotToChannelLink = (botUsername: string): string => {
  return `https://t.me/${botUsername}?startchannel=&admin=post_stories+post_messages`
}

export const addBotToChannelLink = (botUsername: string) => {
  const addBotLink = getBotToChannelLink(botUsername)
  console.log({ addBotLink });
  goTo(addBotLink);
};

