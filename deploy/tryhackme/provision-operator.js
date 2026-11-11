// Runs inside the platform container (cwd /app). Creates the single player account
// for a TryHackMe machine if it does not exist yet. Idempotent.
const { db, teams, closeDatabase } = require('./dist/db');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcryptjs');

const name = process.env.OPERATOR_TEAM || 'Operator';
const email = process.env.OPERATOR_EMAIL || 'operator@veyra.thm';
const password = process.env.OPERATOR_PASSWORD || 'HeistOperator2026';

(async () => {
  try {
    const existing = db.select({ id: teams.id }).from(teams).where(eq(teams.teamName, name)).get();
    if (existing) {
      console.log('operator account present');
      return;
    }
    db.insert(teams)
      .values({ teamName: name, memberEmails: [email], teamSize: 1, passwordHash: await bcrypt.hash(password, 10) })
      .run();
    console.log('operator account created');
  } finally {
    closeDatabase();
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
