/**
 * @qrypto/shared-types — Decimal Utility
 *
 * ALL financial arithmetic in this codebase goes through this module.
 * Native JS float arithmetic (0.1 + 0.2 === 0.30000000000000004) is
 * a bug in a financial context, not a quirk. This module makes that
 * impossible to accidentally do.
 *
 * Backed by decimal.js with precision set to 36 significant figures —
 * sufficient for sub-satoshi BTC amounts and USD at any realistic scale.
 *
 * Last updated: 2024-01-01
 */

import { Decimal } from 'decimal.js';

// Configure globally — these settings apply for the lifetime of the process.
Decimal.set({
  precision: 36,
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding — standard for financial systems
  toExpPos: 30,
  toExpNeg: -7,
});

// ─── Core Operations ─────────────────────────────────────────────────────────

export function add(a: string, b: string): string {
  return new Decimal(a).plus(new Decimal(b)).toFixed();
}

export function subtract(a: string, b: string): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed();
}

export function multiply(a: string, b: string): string {
  return new Decimal(a).times(new Decimal(b)).toFixed();
}

export function divide(a: string, b: string): string {
  if (new Decimal(b).isZero()) {
    throw new Error(`Division by zero: ${a} / ${b}`);
  }
  return new Decimal(a).dividedBy(new Decimal(b)).toFixed();
}

// ─── Comparisons ─────────────────────────────────────────────────────────────

export function isGreaterThan(a: string, b: string): boolean {
  return new Decimal(a).greaterThan(new Decimal(b));
}

export function isLessThan(a: string, b: string): boolean {
  return new Decimal(a).lessThan(new Decimal(b));
}

export function isGreaterThanOrEqual(a: string, b: string): boolean {
  return new Decimal(a).greaterThanOrEqualTo(new Decimal(b));
}

export function isLessThanOrEqual(a: string, b: string): boolean {
  return new Decimal(a).lessThanOrEqualTo(new Decimal(b));
}

export function isEqual(a: string, b: string): boolean {
  return new Decimal(a).equals(new Decimal(b));
}

export function isZero(a: string): boolean {
  return new Decimal(a).isZero();
}

export function isNegative(a: string): boolean {
  return new Decimal(a).isNegative();
}

export function isPositive(a: string): boolean {
  return new Decimal(a).isPositive() && !new Decimal(a).isZero();
}

// ─── Rounding & Precision ────────────────────────────────────────────────────

/**
 * Round to a fixed number of decimal places using banker's rounding.
 * Use this when you need to display or store a value with specific precision.
 */
export function toFixed(value: string, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed();
}

/**
 * Round down (floor) to a fixed number of decimal places.
 * Use this for fee calculations where you always round in the user's favour.
 */
export function toFixedFloor(value: string, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_FLOOR).toFixed();
}

/**
 * Round up (ceil) to a fixed number of decimal places.
 * Use this when rounding in the exchange's favour (e.g. fee collection).
 */
export function toFixedCeil(value: string, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_CEIL).toFixed();
}

// ─── Financial Domain Operations ─────────────────────────────────────────────

/**
 * Calculate fee amount from a notional value and fee rate.
 * Fee rate is expressed as a decimal fraction (e.g. 0.001 = 0.1%).
 * Rounds up — the exchange always collects at least the stated fee.
 */
export function calculateFee(notional: string, feeRate: string): string {
  return toFixedCeil(multiply(notional, feeRate), 8);
}

/**
 * Calculate P&L for a position.
 * Returns a signed value: positive = profit, negative = loss.
 */
export function calculatePnl(
  entryPrice: string,
  currentPrice: string,
  quantity: string,
  side: 'long' | 'short',
): string {
  const priceDiff = subtract(currentPrice, entryPrice);
  const rawPnl = multiply(priceDiff, quantity);
  return side === 'long' ? rawPnl : multiply(rawPnl, '-1');
}

/**
 * Calculate liquidation price for a leveraged position.
 * Simplified model: liq price is reached when losses exhaust initial margin.
 */
export function calculateLiquidationPrice(
  entryPrice: string,
  leverage: number,
  side: 'long' | 'short',
): string {
  const maintenanceMarginRate = '0.005'; // 0.5% — typical exchange rate
  const leverageStr = String(leverage);

  if (side === 'long') {
    // Long liq price = entryPrice * (1 - 1/leverage + maintenanceMarginRate)
    const factor = subtract(subtract('1', divide('1', leverageStr)), maintenanceMarginRate);
    return multiply(entryPrice, factor);
  } else {
    // Short liq price = entryPrice * (1 + 1/leverage - maintenanceMarginRate)
    const factor = add(add('1', divide('1', leverageStr)), maintenanceMarginRate);
    return multiply(entryPrice, factor);
  }
}

/**
 * Calculate notional value of a position.
 */
export function calculateNotional(price: string, quantity: string): string {
  return multiply(price, quantity);
}

/**
 * Apply slippage to a price (used in market order simulation).
 * Slippage rate is a decimal fraction (e.g. 0.001 = 0.1%).
 */
export function applySlippage(price: string, slippageRate: string, side: 'buy' | 'sell'): string {
  const slippageAmount = multiply(price, slippageRate);
  return side === 'buy' ? add(price, slippageAmount) : subtract(price, slippageAmount);
}

// ─── Satoshi-Precision Helpers ───────────────────────────────────────────────

/** BTC amounts are expressed to 8 decimal places (satoshis). */
export const BTC_DECIMALS = 8;

/** ETH amounts are expressed to 18 decimal places (wei). */
export const ETH_DECIMALS = 18;

/** Stablecoin amounts expressed to 6 decimal places. */
export const STABLE_DECIMALS = 6;

/**
 * Round a BTC amount to satoshi precision (8 decimal places), rounding down.
 * Never round up a user's BTC balance.
 */
export function toSatoshiPrecision(amount: string): string {
  return toFixedFloor(amount, BTC_DECIMALS);
}

/**
 * Assert two amounts are equal within a given tolerance.
 * Use this in tests when comparing computed amounts that may have
 * accumulated rounding differences across multiple operations.
 */
export function isWithinTolerance(a: string, b: string, toleranceDecimals: number): boolean {
  const tolerance = new Decimal(10).toPower(-toleranceDecimals).toFixed();
  const diff = new Decimal(a).minus(new Decimal(b)).abs().toFixed();
  return isLessThan(diff, tolerance);
}

// ─── Parse Helpers ────────────────────────────────────────────────────────────

/**
 * Safely parse a string to a Decimal.
 * Throws a typed error if the input is not a valid number.
 * Never use this to do raw arithmetic — use the functions above.
 */
export function parseAmount(value: string): Decimal {
  try {
    const d = new Decimal(value);
    if (!d.isFinite()) {
      throw new Error(`Non-finite value: ${value}`);
    }
    return d;
  } catch {
    throw new Error(`Invalid financial amount: "${value}". Must be a numeric string.`);
  }
}
