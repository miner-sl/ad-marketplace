export const formatUsername = (username: string): string => {
  return username.startsWith('@') ? username : `@${username}`;
}
