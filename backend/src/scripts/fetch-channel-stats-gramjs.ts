#!/usr/bin/env tsx
/**
 * CLI to fetch Telegram channel stats via GramJS (MTProto) and optionally save to channel_stats.
 */

import * as dotenv from 'dotenv';
import db from '../db/connection';
import {initializeGramJsClients} from '../utils/gramjs-client';
import {fetchChannelStatsGramJs} from '../services/telegram-channel-stats-gramjs.service';

dotenv.config();

async function main(): Promise<void> {

  let telegramChannelId: number = 2336189587;
  let resolveUsername: string | null = 'mikejsx';

  await initializeGramJsClients();
  const result = await fetchChannelStatsGramJs(telegramChannelId, resolveUsername);

  if (!result) {
    console.error('Failed to fetch stats (GramJS not available or channel not found / not broadcast or megagroup)');
    process.exit(1);
  }
  const output = {
    subscribers_count: result.subscribers_count,
    average_views: result.average_views,
    average_reach: result.average_reach,
    premium_subscribers_count: result.premium_subscribers_count,
    statistic: result.statistic,
  };
  const pretty = true;
  console.log(pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.pool?.end());
