/**
 * Challenge 08 — Internal Dashboard Service Runner
 *
 * ARCHITECTURAL SPECIFICATION:
 * ==============================================================================
 * Challenge 07 (The Invoice Trail) and Challenge 08 (The Internal Dashboard)
 * share ONE unified application and dataset behind employee Priya's login
 * (priya.nair / Veyra#Audit26).
 *
 * This runner delegates directly to the shared Express app, allowing Challenge 08
 * to run either on the unified port (3007) or on its own container port (3008).
 * ==============================================================================
 */

import { createApp } from '../../07-invoice-trail/src/app';

const port = parseInt(process.env.CHALLENGE_08_PORT || process.env.PORT || '3008', 10);
const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(JSON.stringify({
      service: 'challenge-08-internal-dashboard',
      port,
      status: 'running',
      health: `http://localhost:${port}/healthz`,
      account: 'priya.nair',
    }));
  });
}

export { app };
export default app;
