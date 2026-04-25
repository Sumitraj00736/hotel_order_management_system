/**
 * Utility functions for precise financial calculations handling JavaScript floating-point issues.
 */
class MathUtils {
  /**
   * Safely rounds a number to exactly two decimal places, mitigating float precision errors.
   * Assumes basic input is a Number or parseable String.
   */
  static roundAmount(amount) {
    if (amount == null || isNaN(amount)) return 0;
    const num = Number(amount);
    // Move decimal 2 places to the right, round to nearest integer, then move back
    return Math.round(num * 100) / 100;
  }

  /**
   * Adds multiple amounts safely.
   */
  static add(...amounts) {
    let sumInCents = 0;
    for (const amt of amounts) {
      if (amt != null && !isNaN(amt)) {
        sumInCents += Math.round(Number(amt) * 100);
      }
    }
    return sumInCents / 100;
  }

  /**
   * Subtracts amountB from amountA safely.
   */
  static subtract(amountA, amountB) {
    const aCents = Math.round(Number(amountA || 0) * 100);
    const bCents = Math.round(Number(amountB || 0) * 100);
    return (aCents - bCents) / 100;
  }
}

module.exports = MathUtils;
