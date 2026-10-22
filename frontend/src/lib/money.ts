/**
 * Authoritative currency utilities for Sri Lankan Rupees (LKR / Rs.).
 * All monetary amounts are handled as INTEGER PAISE (1 LKR = 100 paise).
 * 
 * Rules:
 * - Never use floating-point math for money.
 * - Always display using formatLKR(paise).
 */

/**
 * Format integer paise into display string: "Rs. 1,500.00" or "Rs. 1,500"
 */
export function formatLKR(paise: number, showDecimals: boolean = true): string {
  if (isNaN(paise) || paise === null || paise === undefined) {
    return showDecimals ? "Rs. 0.00" : "Rs. 0";
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  const formattedRupees = rupees.toLocaleString("en-US");

  let result: string;
  if (showDecimals) {
    const formattedPaise = remainderPaise.toString().padStart(2, "0");
    result = `Rs. ${formattedRupees}.${formattedPaise}`;
  } else {
    result = `Rs. ${formattedRupees}`;
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Convert paise integer to standard decimal rupees number for display-only fields.
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Convert user-entered rupee string or number to integer paise.
 * Rounds to nearest integer paise to eliminate floating point artifacts.
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === "string") {
    const cleanStr = rupees.replace(/[^0-9.-]/g, "");
    const val = parseFloat(cleanStr);
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Calculate outstanding balance: finalCharge - paid.
 */
export function calculateOutstanding(finalChargePaise: number, paidPaise: number): number {
  return Math.max(0, finalChargePaise - paidPaise);
}
