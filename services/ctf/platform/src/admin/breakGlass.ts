/**
 * ROOT CTF — Break-Glass Emergency Administrator Recovery Tool
 *
 * Implements Phase N Requirement:
 * "Document a manual break-glass procedure for recovering admin access if ever locked out."
 *
 * This utility operates directly against the SQLite database, completely bypassing
 * the web platform, Redis, session tokens, and rate limiters. It allows event organisers
 * to regain access to the Admin Console in emergency lockout scenarios.
 *
 * Usage:
 *   npx tsx src/admin/breakGlass.ts [username] [new_password]
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import { db, closeDatabase, adminUsers } from '../db';

async function breakGlass(): Promise<void> {
  const line = '='.repeat(80);
  console.log(`\n${line}`);
  console.log('🚨 ROOT CTF — EMERGENCY BREAK-GLASS ADMIN RECOVERY');
  console.log(line);

  const username = process.argv[2]?.trim() || 'emergency_admin';
  const customPassword = process.argv[3]?.trim();
  const password = customPassword || crypto.randomBytes(12).toString('base64url');

  console.log(`[RECOVERY] Target Admin Username: "${username}"`);
  console.log(`[RECOVERY] Hashing new administrative credential with bcrypt...`);

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const [existing] = await db
      .select({ id: adminUsers.id, username: adminUsers.username })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (existing) {
      console.log(`[RECOVERY] Existing admin account "${username}" located. Updating password hash...`);
      await db
        .update(adminUsers)
        .set({
          passwordHash,
          role: 'admin',
        })
        .where(eq(adminUsers.id, existing.id));
      console.log(`  ✓ Password hash updated successfully.`);
    } else {
      console.log(`[RECOVERY] Account "${username}" does not exist. Creating new emergency administrator...`);
      await db.insert(adminUsers).values({
        username,
        passwordHash,
        role: 'admin',
      });
      console.log(`  ✓ Emergency administrator account provisioned.`);
    }

    // Sanity test: Verify that bcrypt.compare succeeds
    const [verified] = await db
      .select({ passwordHash: adminUsers.passwordHash })
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    const match = await bcrypt.compare(password, verified.passwordHash);
    if (!match) {
      throw new Error('Fatal integrity failure: bcrypt.compare did not match stored hash!');
    }

    console.log(`  ✓ Cryptographic credential verification test passed.`);

    console.log(`\n${line}`);
    console.log('EMERGENCY CREDENTIALS RECOVERED SUCCESSFULLY');
    console.log(line);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log(`  Admin URL: http://localhost:8080/admin (or /api/admin)`);
    console.log(`\n⚠️  IMPORTANT SECURITY NOTICE:`);
    console.log(`  Log in immediately, execute required administrative interventions,`);
    console.log(`  and rotate this temporary emergency password once operations normalize.`);
    console.log(`${line}\n`);
  } catch (err: any) {
    console.error('\n❌ Break-glass emergency recovery failed:', err.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

if (process.argv[1]?.includes('breakGlass')) {
  breakGlass();
}

export default breakGlass;
