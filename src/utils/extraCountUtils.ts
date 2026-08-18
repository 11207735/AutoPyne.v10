/**
 * AGM Travel & Fleet Extras and Activities Count Helpers
 * Ensures that if there are extra units (e.g. 5 Quads + 1 Extra Quad = 6 Quads total),
 * the counters across all views, tables, profiles, and export sheets accurately include the extras.
 */

export function parseExtraCount(val?: string | number | null): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).trim();
  if (!s || s === 'None' || s === 'none' || s === '0' || s === '-' || s === '0 DH') return 0;

  // If string starts with a number (e.g. "1", "2 Extras", "3 Quads", "1 P")
  const match = s.match(/^(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    // If entered "100 DH" or "200 DH" in count field, treat as 1 unit
    if (s.toLowerCase().includes('dh') && n >= 50) return 1;
    return isNaN(n) ? 0 : n;
  }

  const digitsOnly = s.replace(/[^0-9]/g, '');
  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    if (s.toLowerCase().includes('dh') && num >= 50) return 1;
    return isNaN(num) ? 0 : num;
  }

  return s !== 'None' && s !== 'none' ? 1 : 0;
}

export function parseExtraPay(payStr?: string, fallbackPayment?: string, hasCount?: boolean): number {
  if (payStr && payStr !== 'None' && payStr !== '0 DH' && payStr !== '0' && payStr !== '-') {
    const num = parseInt(payStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) return num;
  }
  if (hasCount && fallbackPayment && fallbackPayment !== 'None' && fallbackPayment !== '0 DH' && fallbackPayment !== '0') {
    const num = parseInt(fallbackPayment.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) return num;
  }
  return 0;
}
