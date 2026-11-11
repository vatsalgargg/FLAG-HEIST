/**
 * Platform Configuration Module
 *
 * Reads configuration strictly from environment variables as documented in .env.example.
 * Fails fast with loud, actionable error messages if genuinely required connection strings
 * (Redis) are missing.
 */

import dotenv from 'dotenv';
import path from 'path';

// Attempt to load .env from the platform directory or repo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databasePath: string;
  redisUrl: string;
  jwtSecret: string | null;
  adminJwtSecret: string | null;
  resetToken: string | null;
  sentryDsn: string | null;
  collabBaseDomain: string | null;
  flagPepper: string;
  adminSeedUsername: string;
  adminSeedPassword: string;
}

function printFatalError(title: string, message: string, resolution: string[]): void {
  const line = '='.repeat(80);
  console.error(`\n${line}`);
  console.error(`FATAL STARTUP CONFIGURATION ERROR: ${title}`);
  console.error(line);
  console.error(`\nProblem:\n  ${message}\n`);
  console.error('How to resolve:');
  for (const step of resolution) {
    console.error(`  - ${step}`);
  }
  console.error(`\n${line}\n`);
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  const port = parseInt(process.env.PORT?.trim() || '8080', 10);

  const databasePath = path.resolve(process.env.SQLITE_PATH?.trim() || './data/flagheist.db');

  const redisUrl = process.env.REDIS_URL?.trim() || '';

  // Optional secrets for later phases (JWT auth, admin token, Sentry, Collab)
  const jwtSecret = process.env.JWT_SECRET?.trim() || null;
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET?.trim() || null;
  const resetToken = process.env.RESET_TOKEN?.trim() || null;
  const sentryDsn = process.env.SENTRY_DSN?.trim() || null;
  const collabBaseDomain = process.env.COLLAB_BASE_DOMAIN?.trim() || null;

  // Salt pepper for flag hashing
  const flagPepper = process.env.FLAG_PEPPER?.trim() || 'default-ctf-pepper';

  // Seed credentials (development defaults)
  const adminSeedUsername = process.env.ADMIN_SEED_USERNAME?.trim() || 'admin';
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD?.trim() || 'admin123';

  // Validation: Fail fast if essential connection strings are missing
  const missingConfigs: string[] = [];

  if (!redisUrl) {
    missingConfigs.push('REDIS_URL');
  }

  if (nodeEnv === 'production') {
    for (const [name, value] of Object.entries({ JWT_SECRET: jwtSecret, ADMIN_JWT_SECRET: adminJwtSecret, RESET_TOKEN: resetToken, FLAG_PEPPER: process.env.FLAG_PEPPER })) {
      if (!value || value.length < 32 || /^(local-|dev-|default-)/.test(value)) missingConfigs.push(`${name} (at least 32 characters)`);
    }
    if (jwtSecret === adminJwtSecret) missingConfigs.push('distinct team and admin JWT secrets');
  }

  if (missingConfigs.length > 0) {
    printFatalError(
      'Missing Required Cache Configuration',
      `The platform cannot start without valid database and cache connection parameters.\n  Missing: ${missingConfigs.join(', ')}`,
      [
        'For LOCAL DEVELOPMENT: run `docker compose up` from the repo root (services are automatically wired).',
        'Or create a `.env` file from `.env.example` with valid connection strings.',
        'SQLite uses SQLITE_PATH, defaulting to ./data/flagheist.db.',
        'Local Redis format: redis://localhost:6379',
        'For PRODUCTION: configure secrets via Cloud Run / Secret Manager.'
      ]
    );
    process.exit(1);
  }

  return {
    nodeEnv,
    port,
    databasePath,
    redisUrl,
    jwtSecret,
    adminJwtSecret,
    resetToken,
    sentryDsn,
    collabBaseDomain,
    flagPepper,
    adminSeedUsername,
    adminSeedPassword,
  };
}

export const config = loadConfig();
