/**
 * Challenge 08 — Internal Corporate Dashboard & Operational Routes
 *
 * SPECIFICATION CONTRACT:
 * ==============================================================================
 * Several realistic, unrelated route groups exist behind the shared login:
 *   - GET /api/billing/summary: correctly protected (checks billing_admin role)
 *   - GET /api/reporting/exports: correctly protected (checks analytics_admin role)
 *   - GET /api/users/directory: correctly protected (checks user_admin role)
 *
 * Exactly one secondary route uses a realistic non-descriptive operational name:
 *   - GET /api/ops/legacy-sync-status
 * This route omits the server-side permission check, allowing any authenticated
 * session (including Priya Nair) to retrieve internal sync diagnostics and the flag.
 * ==============================================================================
 */

import { Router, Request, Response } from 'express';
import { requirePortalAuth, requirePortalPermission } from '../auth';
import { CHALLENGE_08_FLAG } from '../db';

const router = Router();

/**
 * Route 1: Billing Summary (Correctly Protected)
 * Requires billing_admin role. Priya (role: auditor) will receive 403 Forbidden.
 */
router.get(
  '/api/billing/summary',
  requirePortalAuth,
  requirePortalPermission('billing_admin'),
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      department: 'Corporate Billing & Treasury',
      monthly_recurring_revenue: 1482900.0,
      active_enterprise_contracts: 142,
      pending_reconciliation: 14,
    });
  }
);

/**
 * Route 2: Reporting Exports (Correctly Protected)
 * Requires analytics_admin role. Priya (role: auditor) will receive 403 Forbidden.
 */
router.get(
  '/api/reporting/exports',
  requirePortalAuth,
  requirePortalPermission('analytics_admin'),
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      reports: [
        { id: 'rep-2026-q3', title: 'Q3 Enterprise Churn Analysis', format: 'parquet', size_bytes: 4194304 },
        { id: 'rep-2026-audit', title: 'Fiscal Year Regulatory Tax Export', format: 'csv', size_bytes: 1048576 },
      ],
    });
  }
);

/**
 * Route 3: Users Directory (Correctly Protected)
 * Requires user_admin role. Priya (role: auditor) will receive 403 Forbidden.
 */
router.get(
  '/api/users/directory',
  requirePortalAuth,
  requirePortalPermission('user_admin'),
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      total_employees: 480,
      departments: ['Engineering', 'Security Operations', 'Internal Audit', 'Executive Leadership'],
    });
  }
);

/**
 * Route 4: THE VULNERABLE ROUTE FOR CHALLENGE 8
 *
 * Per spec, exactly one secondary route omits the check — this is it.
 * Keep the other routes correctly protected; do not add a second vulnerable route.
 *
 * Note: This route is never linked in the frontend UI or navigation. It is only
 * discoverable by searching the bundled client source artifact.
 */
router.get(
  '/api/ops/legacy-sync-status',
  requirePortalAuth,
  // INTENTIONALLY OMITS requirePortalPermission!
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'degraded',
      service: 'legacy-sync-worker-v1',
      last_sync_timestamp: '2026-11-06T23:59:00Z',
      upstream_endpoint: 'https://internal-sync.core.veyra.cloud/v1',
      cluster_region: 'us-east-1a',
      diagnostics: {
        pending_mutations: 0,
        sync_lock_held: false,
        worker_threads: 4,
        vault_token_backup: CHALLENGE_08_FLAG,
        environment: 'production-internal',
      },
    });
  }
);

export default router;
