/**
 * Challenge 07 & 08 — Shared Service Entry Point
 *
 * Runs the unified Veyra internal enterprise application on port 3007
 * (or CHALLENGE_07_PORT / PORT).
 */

import { createApp } from './app';
import { getDatabase } from './db';

const port = parseInt(process.env.CHALLENGE_07_PORT || process.env.PORT || '3007', 10);
const app = createApp();

// Initialize the SQLite database on startup
getDatabase();

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(JSON.stringify({
      service: 'challenge-07-08-shared-portal',
      port,
      status: 'running',
      challenges: [7, 8],
      health: `http://localhost:${port}/healthz`,
      account: 'priya.nair',
    }));
  });
}

export { app };
export default app;
