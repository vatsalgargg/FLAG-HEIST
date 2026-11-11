/**
 * Challenge 07 — Deterministic Keyed Invoice-ID Transform
 *
 * ARCHITECTURAL SPECIFICATION:
 * ==============================================================================
 * Each invoice has an obfuscated primary key string (`invoice_id`) rather than
 * a raw sequential database ID. The invoice ID is generated deterministically
 * by combining the customer's numeric identifier (`customer_id`) and the
 * invoice sequence number (`invoice_num`) with a fixed numeric key via bitwise XOR,
 * and encoding the result in uppercase hexadecimal prefixed with "INV-":
 *
 *   combined = (customer_id * 1000) + invoice_num
 *   xor_val  = combined ^ INVOICE_TRANSFORM_KEY
 *   hex_val  = xor_val.toString(16).toUpperCase().padStart(6, '0')
 *   return "INV-" + hex_val
 *
 * WHY THIS SPEC MATTERS:
 * Priya Nair has 5 invoices in her own account (customer_id: 1042). When inspecting
 * her own invoices via GET /api/my-invoices, participants observe:
 *   - Invoice #1: INV-55DACE (5626574 ^ 1042001 = 5913759)
 *   - Invoice #2: INV-55DACD (5626573 ^ 1042002 = 5913759)
 *   - Invoice #3: INV-55DACC (5626572 ^ 1042003 = 5913759)
 *   - Invoice #4: INV-55DACB (5626571 ^ 1042004 = 5913759)
 *   - Invoice #5: INV-55DACA (5626570 ^ 1042005 = 5913759)
 *
 * Because XOR is self-inverse, computing (hexToInt(id) ^ (1042000 + num)) across
 * Priya's invoices yields the constant key 5913759 (0x5A3C9F) on every sample.
 *
 * When participants discover the in-app escalation memo regarding target customer
 * Apex Sovereign Holdings (customer_id: 9104, invoice_num: 1), they compute:
 *   combined = (9104 * 1000) + 1 = 9104001
 *   xor_val  = 9104001 ^ 5913759 = 13686302 = 0xD0D61E
 *   target   = "INV-D0D61E"
 *
 * Requesting GET /api/invoices/INV-D0D61E reaches the target invoice and surfaces
 * the Challenge 7 flag.
 * ==============================================================================
 */

/** Fixed 24-bit key from environment or fallback default */
export const DEFAULT_INVOICE_KEY = 5913759; // 0x5A3C9F

export function getInvoiceKey(): number {
  if (process.env.INVOICE_TRANSFORM_KEY) {
    const parsed = parseInt(process.env.INVOICE_TRANSFORM_KEY, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_INVOICE_KEY;
}

/**
 * Derives the deterministic invoice ID for a given customer and invoice sequence.
 * @param customerId Numeric customer ID (e.g. 1042 or 9104)
 * @param invoiceNum 1-based invoice sequence number (default 1)
 */
export function deriveInvoiceId(customerId: number, invoiceNum: number = 1): string {
  const key = getInvoiceKey();
  const combined = (customerId * 1000) + invoiceNum;
  const xorVal = (combined ^ key) >>> 0;
  return 'INV-' + xorVal.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Reverses an invoice ID given the known key to extract customerId and invoiceNum.
 * Returns null if format is invalid.
 */
export function reverseInvoiceId(invoiceId: string): { customerId: number; invoiceNum: number } | null {
  if (!invoiceId.startsWith('INV-')) {
    return null;
  }
  const hex = invoiceId.slice(4);
  const xorVal = parseInt(hex, 16);
  if (isNaN(xorVal)) {
    return null;
  }
  const key = getInvoiceKey();
  const combined = (xorVal ^ key) >>> 0;
  const customerId = Math.floor(combined / 1000);
  const invoiceNum = combined % 1000;
  return { customerId, invoiceNum };
}
