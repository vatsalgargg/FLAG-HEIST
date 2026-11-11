/**
 * Challenge 07 — Invoices API Routes
 *
 * SPECIFICATION CONTRACT:
 * ==============================================================================
 * - GET /api/my-invoices: returns invoices belonging to the authenticated account
 *   (customer_id: 1042). Contains 5 samples allowing participants to infer the
 *   keyed invoice ID transform.
 * - GET /api/invoices/:invoiceId: THE VULNERABLE ENDPOINT. Checks that a valid
 *   session exists, but deliberately skips checking invoice ownership.
 * ==============================================================================
 */

import { Router, Request, Response } from 'express';
import { requirePortalAuth } from '../auth';
import { getDatabase } from '../db';

const router = Router();

/**
 * Legitimate, correctly-scoped endpoint for Priya's own invoices.
 * Returns Priya's 5 invoices with encoded invoice_ids, amounts, dates, and status.
 */
router.get('/api/my-invoices', requirePortalAuth, (req: Request, res: Response) => {
  const db = getDatabase();
  const customerId = req.portalUser!.customerId;

  const invoices = db.prepare(`
    SELECT invoice_id, customer_id, invoice_num, amount, issued_at, description, status
    FROM invoices
    WHERE customer_id = ?
    ORDER BY invoice_num ASC
  `).all(customerId);

  res.status(200).json({
    status: 'success',
    account: {
      customerId,
      username: req.portalUser!.username,
      name: req.portalUser!.name,
    },
    count: invoices.length,
    invoices,
  });
});

/**
 * THE VULNERABLE ENDPOINT FOR CHALLENGE 7.
 *
 * Per the challenge design, this endpoint checks session validity only,
 * never ownership — this is the entire point of challenge 7. Do not 'fix' this.
 */
router.get('/api/invoices/:invoiceId', requirePortalAuth, (req: Request, res: Response) => {
  const db = getDatabase();
  const rawInvoiceId = req.params.invoiceId;
  const invoiceId = Array.isArray(rawInvoiceId) ? rawInvoiceId[0] : rawInvoiceId;

  if (!invoiceId || typeof invoiceId !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Invoice ID is required' });
    return;
  }

  // Look up the requested invoice by its obfuscated primary key
  const invoice = db.prepare(`
    SELECT i.invoice_id, i.customer_id, i.invoice_num, i.amount, i.issued_at,
           i.description, i.status, i.flag, c.name as customer_name, c.company as customer_company
    FROM invoices i
    JOIN customers c ON i.customer_id = c.customer_id
    WHERE i.invoice_id = ?
  `).get(invoiceId.trim()) as any;

  if (!invoice) {
    res.status(404).json({
      error: 'Not Found',
      message: `Invoice '${invoiceId}' was not found in the billing ledger.`,
    });
    return;
  }

  // Return the invoice record. If this is the target customer's invoice (Apex Sovereign Holdings),
  // the flag is included in the invoice description and flag payload.
  res.status(200).json({
    status: 'success',
    invoice: {
      invoiceId: invoice.invoice_id,
      customerId: invoice.customer_id,
      customerName: invoice.customer_name,
      company: invoice.customer_company,
      invoiceNum: invoice.invoice_num,
      amount: invoice.amount,
      issuedAt: invoice.issued_at,
      description: invoice.description,
      status: invoice.status,
      flag: invoice.flag || undefined,
    },
  });
});

export default router;
