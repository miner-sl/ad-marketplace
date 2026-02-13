import config from "@config";

export const isProd = process.env.NODE_ENV === 'production';

export const getTONScanUrl = (address: string): string => {
  const baseUrl = config.isDev
    ? 'https://testnet.tonscan.org'
    : 'https://tonscan.org';
  return `${baseUrl}/address/${address}`;
}


