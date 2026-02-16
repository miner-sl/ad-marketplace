import * as dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';

  // Telegram
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_URL?: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;

  // Database
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: number;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;

  // TON
  TON_NETWORK: 'mainnet' | 'testnet';
  TON_API_KEY?: string;

  // Deal Settings
  DEAL_TIMEOUT_HOURS: number;
  MIN_POST_DURATION_HOURS: number;
  VERIFIED_TIMEOUT_HOURS: number;
  VERIFIED_TIMEOUT_DAYS: number;

  // Logging
  LOG_LEVEL?: string;
  LOG_DIR?: string;
}

function getEnvVar(name: string, required: boolean = true, defaultValue?: any): any {
  const env1 = process.env;
  const value = env1[name];

  if (!value && required && defaultValue === undefined) {
    logger.error(`Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value || defaultValue;
}

function getNumberEnvVar(name: string, required: boolean = true, defaultValue?: number): number {
  const value = getEnvVar(name, required, defaultValue);
  if (value === undefined) return defaultValue!;

  const num = parseInt(value, 10);
  if (isNaN(num)) {
    logger.error(`Invalid number for environment variable ${name}: ${value}`);
    throw new Error(`Invalid number for environment variable ${name}: ${value}`);
  }
  return num;
}

const verificationDelays = getNumberEnvVar('VERIFIED_TIMEOUT_HOURS', false, 168) / 7;
export const env: EnvConfig = {
  PORT: getNumberEnvVar('PORT', false, 3000),
  NODE_ENV: (getEnvVar('NODE_ENV', false, 'development') as any) || 'development',

  TELEGRAM_BOT_USERNAME: getEnvVar('TELEGRAM_BOT_USERNAME', true),
  TELEGRAM_BOT_TOKEN: getEnvVar('TELEGRAM_BOT_TOKEN', true),
  TELEGRAM_WEBHOOK_URL: getEnvVar('TELEGRAM_WEBHOOK_URL', false),

  JWT_SECRET: getEnvVar('JWT_SECRET', true),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', false, '7D'),

  DATABASE_URL: getEnvVar('DATABASE_URL', false),
  DB_HOST: getEnvVar('DB_HOST', false, 'localhost'),
  DB_PORT: getNumberEnvVar('DB_PORT', false, 5432),
  DB_NAME: getEnvVar('DB_NAME', false, 'ad_marketplace'),
  DB_USER: getEnvVar('DB_USER', false, 'admarketplace'),
  DB_PASSWORD: getEnvVar('DB_PASSWORD', false, 'admarketplace123'),

  TON_NETWORK: (getEnvVar('TON_NETWORK', false, 'testnet') as any) || 'testnet',
  TON_API_KEY: getEnvVar('TON_API_KEY', false),

  DEAL_TIMEOUT_HOURS: getNumberEnvVar('DEAL_TIMEOUT_HOURS', false, 240), // 10 days default (240 hours)
  MIN_POST_DURATION_HOURS: getNumberEnvVar('MIN_POST_DURATION_HOURS', false, 24),
  VERIFIED_TIMEOUT_HOURS: verificationDelays, // 7 days default
  VERIFIED_TIMEOUT_DAYS: verificationDelays / 24, // 7 days default

  LOG_LEVEL: getEnvVar('LOG_LEVEL', false),
  LOG_DIR: getEnvVar('LOG_DIR', false, 'logs'),
};

if (env.NODE_ENV === 'production') {
  if (!env.TELEGRAM_WEBHOOK_URL) {
    logger.warn('TELEGRAM_WEBHOOK_URL is not set in production. Bot will use polling.');
  }

  if (!env.DATABASE_URL && (!env.DB_HOST || !env.DB_NAME || !env.DB_USER || !env.DB_PASSWORD)) {
    logger.error('Database configuration is incomplete in production');
    throw new Error('Database configuration is incomplete in production');
  }

  if (env.TON_NETWORK === 'mainnet' && !env.TON_API_KEY) {
    logger.warn('TON_API_KEY is not set but TON_NETWORK is mainnet');
  }
}

logger.info('Environment configuration loaded', {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  TON_NETWORK: env.TON_NETWORK,
  DATABASE_CONFIGURED: !!(env.DATABASE_URL || env.DB_HOST),
});

export default env;
