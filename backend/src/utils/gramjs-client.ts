import env from './env';
import logger from './logger';
import {TelegramClient} from 'telegram';
import {StringSession} from 'telegram/sessions';
import {Logger, LogLevel} from 'telegram/extensions/Logger';
import {createInterface} from 'readline/promises';
import {stdin, stdout} from 'process';

// ... inside your function
const rl = createInterface({ input: stdin, output: stdout });


const clientPool = new Map<number, TelegramClient>();

/**
 * Initialize GramJS Telegram clients from session files.
 * Requires TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_HELPER_IDS, and session files in TELEGRAM_SESSIONS_DIR.
 */
export async function initializeGramJsClients(): Promise<void> {
  const apiId = env.TELEGRAM_API_ID;
  const apiHash = env.TELEGRAM_API_HASH;
  // const helperIds = env.TELEGRAM_HELPER_IDS;
  const tgSession = env.TELEGRAM_SESSION ?? '';

  if (!apiId || !apiHash) {
    logger.debug('GramJS clients not initialized: TELEGRAM_API_ID, TELEGRAM_API_HASH or TELEGRAM_HELPER_IDS not set');
    return;
  }

  try {
    try {
      const session = new StringSession(tgSession);

      const client = new TelegramClient(session, apiId, apiHash, {
        baseLogger: new (Logger as any)(LogLevel.NONE),
      });
      clientPool.set(Number(1), client);
      await client.start({
        phoneNumber: async () => '',
        phoneCode: async () => {
          return await rl.question('Enter verification code: ');
        },
        password: async () => 'SimplePassword123.',
        onError: () => {
          clientPool.delete(Number(1));
          client.disconnect();
        },
      });
      console.log(client.session.save());
    } catch (err: any) {
      console.log(err);
      logger.warn(`GramJS session failed to load`, {error: err?.message});
    }
  } catch (err: any) {
    logger.debug('GramJS package not available or init failed', {error: err?.message});
  }
}

/**
 * Get a GramJS client by helper user id. Returns undefined if GramJS is not configured or client not found.
 */
export async function getGramJsClient(helperUserId: number): Promise<TelegramClient | undefined> {
  return clientPool.get(helperUserId);
}

/**
 * Get the first available GramJS client, or undefined if none.
 */
export async function getAnyGramJsClient(): Promise<TelegramClient | undefined> {
  const first = clientPool.keys().next();
  return first.done ? undefined : clientPool.get(first.value);
}

/**
 * Whether GramJS clients are configured and at least one is available.
 */
export function isGramJsAvailable(): boolean {
  return clientPool.size > 0;
}
