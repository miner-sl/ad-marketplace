import logger from "./logger";
import {TonClient} from "@ton/ton";

const isMainnet = process.env.TON_NETWORK === 'mainnet';

// Use proper RPC endpoints
const endpoint = isMainnet
  ? process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC'
  : process.env.TON_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';

logger.info(`Connecting to TON ${isMainnet ? 'mainnet' : 'testnet'}`, { endpoint });

export const tonClient = new TonClient({
  endpoint,
  apiKey: process.env.TON_API_KEY,
});
