/**
 * Flag Hashing and Verification Utility
 *
 * CRYPTOGRAPHIC INVARIANTS:
 * Flags are NEVER stored in plaintext in the database.
 * Every stored flag is hashed using SHA-256 with the competition-wide secret pepper:
 *   hash = SHA-256(rawFlag + ":" + FLAG_PEPPER)
 *
 * This ensures that a read-only database leak does not immediately reveal competition flags.
 */

import crypto from 'crypto';

/**
 * Computes a salted SHA-256 hash of a raw flag using the secret pepper.
 */
export function computeFlagHash(rawFlag: string, pepper: string): string {
  return crypto.createHash('sha256').update(`${rawFlag.trim()}:${pepper}`).digest('hex');
}
