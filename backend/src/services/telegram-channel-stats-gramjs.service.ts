import { Api } from 'telegram';
import logger from '../utils/logger';
import { getAnyGramJsClient, isGramJsAvailable } from '../utils/gramjs-client';

export interface ChannelStatsWithStatistic {
  subscribers_count?: number;
  average_views?: number;
  average_reach?: number;
  language_distribution?: Record<string, number>;
  premium_subscribers_count?: number;
  /** Full Telegram stats response for channel_stats.statistic */
  statistic: Record<string, unknown>;
}

/**
 * Convert a GramJS stats result to a plain object suitable for JSON storage.
 * Handles class instances by copying enumerable properties.
 */
function toPlainObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toPlainObject);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    try {
      out[k] = toPlainObject(v);
    } catch {
      out[k] = v instanceof Object && typeof (v as any).toJSON === 'function' ? (v as any).toJSON() : v;
    }
  }
  return out;
}

/**
 * Fetch full channel/group stats via GramJS (MTProto) and return data for channel_stats including statistic JSON.
 * Returns null if GramJS is not available or the channel cannot be fetched.
 */
export async function fetchChannelStatsGramJs(
  telegramChannelId: number,
  username?: string | null
): Promise<ChannelStatsWithStatistic | null> {
  if (!isGramJsAvailable()) {
    return null;
  }

  const client = await getAnyGramJsClient();
  if (!client) return null;

  try {
    const peer = username
      ? await client.getEntity(username)
      : await client.getInputEntity(telegramChannelId);
    if (!peer) return null;

    const entity = await client.getEntity(peer);
    const isBroadcast = (entity as any).broadcast === true;
    const isMegagroup = (entity as any).megagroup === true;

    let result: any;

    if (isBroadcast) {
      result = await client.invoke(
        new Api.stats.GetBroadcastStats({
          channel: await client.getInputEntity(peer),
          dark: true,
        })
      );
    } else if (isMegagroup) {
      result = await client.invoke(
        new Api.stats.GetMegagroupStats({
          channel: await client.getInputEntity(peer),
          dark: true,
        })
      );
    } else {
      logger.debug(`Channel ${telegramChannelId} is not broadcast or megagroup, skipping GramJS stats`);
      return null;
    }

    const boosts = await client.invoke(
      new Api.premium.GetBoostsStatus({
        peer: await client.getInputEntity(peer),
      })
    );
    if (boosts) {
      result.boosts = boosts;
    }

    if (result) {
      for (const [key, value] of Object.entries(result)) {
        if (value && typeof value === 'object' && (value as any).className === 'StatsGraphAsync') {
          const graph = await client.invoke(
            new Api.stats.LoadAsyncGraph({
              token: (value as any).token,
            })
          );
          if (graph) {
            result[key] = graph;
          }
        }
      }
    }

    const plain = toPlainObject(result) as Record<string, unknown>;

    const stats: ChannelStatsWithStatistic = {
      statistic: plain,
    };

    if (typeof (result as any).followers?.current === 'number') {
      stats.subscribers_count = (result as any).followers.current;
    }
    if (typeof (result as any).views?.current === 'number') {
      stats.average_views = (result as any).views?.current;
    }
    if (typeof (result as any).reach?.current === 'number') {
      stats.average_reach = (result as any).reach?.current;
    }
    if (result?.boosts && typeof (result.boosts as any).premiumAudience?.count === 'number') {
      stats.premium_subscribers_count = (result.boosts as any).premiumAudience?.count;
    }

    return stats;
  } catch (err: any) {
    logger.error(`GramJS stats fetch failed for channel ${telegramChannelId}`, {
      error: err?.message,
      stack: err?.stack,
    });
    return null;
  }
}
