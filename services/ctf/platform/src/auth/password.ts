/**
 * Password Hashing & Verification Utilities
 *
 * Provides cryptographic password hashing using bcryptjs.
 *
 * DESIGN CHOICES & TRADEOFFS:
 * 1. Why Hash Team Passwords in a "Just a CTF" Event?
 *    Even though CTF accounts are temporary, participants frequently reuse passwords
 *    across personal accounts, emails, and corporate systems. A database breach or leak
 *    must NEVER expose plaintext credentials. All passwords are encrypted with salted hashes.
 *
 * 2. Cost Factor Selection (Rounds = 10):
 *    A bcrypt cost factor of 10 takes approximately 70–100ms per hash on standard cloud compute.
 *    - Higher (e.g., 14): Takes >1000ms per attempt. Under event kickoff conditions with thousands
 *      of concurrent login requests, this would saturate Node.js thread pool and cause self-inflicted DoS.
 *    - Lower (e.g., 6): Takes <5ms, making offline GPU-based dictionary cracking trivial.
 *    - Rounds = 10 represents the optimal balance of interactive performance and brute-force resistance.
 */

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with salt rounds = 10.
 *
 * @param plaintext The raw user-supplied password string.
 * @returns The salted bcrypt hash string.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Securely verifies a plaintext password against a stored bcrypt hash.
 * Resistant to timing attacks.
 *
 * @param plaintext The raw candidate password from login request.
 * @param hash The stored bcrypt hash from database.
 * @returns True if password matches hash, false otherwise.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!plaintext || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch (err) {
    // If hash format is corrupt or invalid, fail closed
    return false;
  }
}
