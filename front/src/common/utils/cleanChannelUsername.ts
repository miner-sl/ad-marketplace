
export const cleanChannelUsername = (username: string): string=> {
  if (username.startsWith('t.me/')) {
    return username.substring('t.me/'.length);
  } else if (username.startsWith('https://t.me/')) {
    return username.substring('https://t.me/'.length);
  } else {
    return username.startsWith('@') ? username.substring(1) : `${username}`;
  }
}
