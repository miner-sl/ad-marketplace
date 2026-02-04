import {goTo} from './goTo';

export const addBotToChannelLink = (botUsername: string) => {
  const addBotLink = `https://t.me/${botUsername}?startchannel=&admin=post_stories+post_messages`
  console.log({ addBotLink });
  goTo(addBotLink);
};

