/**
 * Platform Service Entrypoint
 *
 * Bootstraps the platform API server.
 * Ensures SQLite and Redis connections are verified BEFORE binding to the port.
 * Wires the background leaderboard cache self-healing refresher.
 * Implements graceful shutdown on SIGTERM/SIGINT.
 */

import http from 'http';
import { config } from './config';
import { assertDatabaseConnection, closeDatabase } from './db';
import { assertRedisConnection, redis } from './cache';
import { startLeaderboardBackgroundRefresher, stopLeaderboardBackgroundRefresher, rebuildLeaderboardCache } from './cache/leaderboard';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  console.log(`[Platform] Initializing ROOT CTF Platform API (Environment: ${config.nodeEnv})...`);

  // Step 1: Fail-fast verification of core infrastructure dependencies
  await assertDatabaseConnection();
  await assertRedisConnection();

  // Step 2: Warm the leaderboard cache and start the 30-second self-healing refresher
  try {
    await rebuildLeaderboardCache();
    console.log('[LeaderboardCache] Initial leaderboard cache warmed successfully.');
  } catch (err: any) {
    console.warn('[LeaderboardCache] Initial cache warming warning:', err.message);
  }
  startLeaderboardBackgroundRefresher(30000);

  // Step 3: Create and start the HTTP server
  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Platform API server running',
        port: config.port,
        environment: config.nodeEnv,
        healthEndpoint: `http://localhost:${config.port}/healthz`,
      })
    );
  });

  // Step 4: Graceful shutdown handling for container termination
  const shutdown = async (signal: string) => {
    console.log(`\n[Platform] Received ${signal}. Initiating graceful shutdown...`);

    stopLeaderboardBackgroundRefresher();

    server.close(async () => {
      console.log('[Platform] HTTP server closed to new connections.');

      try {
        await closeDatabase();
        console.log('[Platform] SQLite connection closed.');
      } catch (err: any) {
        console.error('[Platform] Error closing SQLite:', err.message);
      }

      try {
        await redis.quit();
        console.log('[Platform] Redis connection closed.');
      } catch (err: any) {
        console.error('[Platform] Error disconnecting Redis:', err.message);
      }

      console.log('[Platform] Graceful shutdown complete. Exiting.');
      process.exit(0);
    });

    // Force shutdown if cleanup takes longer than 10 seconds
    setTimeout(() => {
      console.error('[Platform] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Platform] Unhandled fatal bootstrap error:', err);
  process.exit(1);
});
