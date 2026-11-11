/**
 * Cache Module (Redis Client & Caching Helpers)
 *
 * Provides a high-performance Redis client using ioredis.
 * Critical for absorbing high-concurrency read spikes on the leaderboard,
 * rate limiting counters, and dashboard snapshots.
 */

import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 5000,
  lazyConnect: true,
  retryStrategy(times) {
    // Exponential backoff capped at 2 seconds
    return Math.min(times * 100, 2000);
  },
});

redis.on('error', (err) => {
  console.error('[Redis] Cache error:', err.message);
});

/**
 * Health check query for Redis connectivity.
 * Executes a lightweight `PING` command to verify cache responsiveness.
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await redis.ping();
    const latencyMs = Date.now() - start;
    if (res === 'PONG') {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: `Unexpected Redis response: ${res}` };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: err.message || 'Redis connection error' };
  }
}

/**
 * Startup assertion: Verifies Redis connectivity before starting the HTTP server.
 * Fails fast and visibly if Redis is unreachable.
 */
export async function assertRedisConnection(): Promise<void> {
  const line = '='.repeat(80);
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const health = await checkRedisHealth();
    if (!health.ok) {
      throw new Error(health.error);
    }
    console.log(`[Redis] Successfully connected to Redis (${health.latencyMs}ms)`);
  } catch (err: any) {
    console.error(`\n${line}`);
    console.error('FATAL STARTUP ERROR: Redis Cache is Unreachable');
    console.error(line);
    console.error(`\nTarget URL: ${config.redisUrl.replace(/:[^:@]+@/, ':****@')}`);
    console.error(`Error details: ${err.message}\n`);
    console.error('The platform API refused to start because the cache dependency failed.');
    console.error('Verify that:');
    console.error('  1. Redis container is running (`docker compose ps`)');
    console.error('  2. Hostname and credentials in REDIS_URL are correct.');
    console.error(`\n${line}\n`);
    process.exit(1);
  }
}

/**
 * Retrieves and deserializes a JSON object from Redis.
 * Returns null if the key does not exist or Redis is temporarily down.
 */
export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.error(`[Redis] Error getting cache for key "${key}":`, err.message);
    return null;
  }
}

/**
 * Serializes and stores a JSON object in Redis with a TTL in seconds.
 */
export async function setCachedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, 'EX', ttlSeconds);
  } catch (err: any) {
    console.error(`[Redis] Error setting cache for key "${key}":`, err.message);
  }
}

/**
 * Deletes a single key from Redis.
 */
export async function deleteCacheKey(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err: any) {
    console.error(`[Redis] Error deleting cache key "${key}":`, err.message);
  }
}
