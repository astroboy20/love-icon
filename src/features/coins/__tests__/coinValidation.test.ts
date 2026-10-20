// Feature: supabase-backend-integration, Property 5: Minimum purchase size is enforced

/**
 * Property-based tests for coin purchase validation utilities.
 *
 * **Validates: Requirements 11.2, 11.3, 11.4**
 *
 * Property 5: For any checkout attempt, the number of selected coin spots
 * SHALL be at least 10, and the total amount SHALL equal
 * `coin_count * 100` kobo (₦100 per coin). No checkout SHALL proceed
 * with fewer than 10 spots.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  MIN_SPOTS,
  COIN_PRICE_KOBO,
  validateMinSpots,
  calculateTotalKobo,
} from "../utils/coinValidation.js";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Any spot count that meets the minimum (10 … 10 000). */
const validSpotCount = fc.integer({ min: MIN_SPOTS, max: 10_000 });

/** Any spot count that falls below the minimum (0 … 9). */
const invalidSpotCount = fc.integer({ min: 0, max: MIN_SPOTS - 1 });

/** An arbitrary non-negative spot count (covers both sides of the boundary). */
const anySpotCount = fc.integer({ min: 0, max: 10_000 });

// ---------------------------------------------------------------------------
// validateMinSpots
// ---------------------------------------------------------------------------

describe("validateMinSpots — Property 5: Minimum purchase size is enforced", () => {
  it("returns true for any count >= MIN_SPOTS (checkout may proceed)", () => {
    fc.assert(
      fc.property(validSpotCount, (count) => {
        expect(validateMinSpots(count)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("returns false for any count < MIN_SPOTS (checkout is blocked)", () => {
    fc.assert(
      fc.property(invalidSpotCount, (count) => {
        expect(validateMinSpots(count)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("is exactly true at the boundary value MIN_SPOTS (=10)", () => {
    expect(validateMinSpots(MIN_SPOTS)).toBe(true);
  });

  it("is exactly false one below the boundary (MIN_SPOTS - 1 = 9)", () => {
    expect(validateMinSpots(MIN_SPOTS - 1)).toBe(false);
  });

  it("is a pure function — same input always yields the same result", () => {
    fc.assert(
      fc.property(anySpotCount, (count) => {
        expect(validateMinSpots(count)).toBe(validateMinSpots(count));
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// calculateTotalKobo
// ---------------------------------------------------------------------------

describe("calculateTotalKobo — Property 5: Minimum purchase size is enforced", () => {
  it("total always equals spotCount * COIN_PRICE_KOBO for any valid spot count", () => {
    fc.assert(
      fc.property(validSpotCount, (count) => {
        expect(calculateTotalKobo(count)).toBe(count * COIN_PRICE_KOBO);
      }),
      { numRuns: 100 },
    );
  });

  it("total is always an integer (no floating-point artifacts)", () => {
    fc.assert(
      fc.property(validSpotCount, (count) => {
        const total = calculateTotalKobo(count);
        expect(Number.isInteger(total)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("minimum valid purchase total is MIN_SPOTS * COIN_PRICE_KOBO", () => {
    expect(calculateTotalKobo(MIN_SPOTS)).toBe(MIN_SPOTS * COIN_PRICE_KOBO);
  });

  it("total is monotonically increasing with spot count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_SPOTS + 1, max: 10_000 }),
        fc.integer({ min: MIN_SPOTS, max: 9_999 }),
        (larger, smaller) => {
          fc.pre(larger > smaller);
          expect(calculateTotalKobo(larger)).toBeGreaterThan(
            calculateTotalKobo(smaller),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("total for an invalid count is less than the minimum required total", () => {
    fc.assert(
      fc.property(invalidSpotCount, (count) => {
        const total = calculateTotalKobo(count);
        const minRequired = calculateTotalKobo(MIN_SPOTS);
        expect(total).toBeLessThan(minRequired);
      }),
      { numRuns: 100 },
    );
  });

  it("adding one more spot always increases the total by exactly COIN_PRICE_KOBO", () => {
    fc.assert(
      fc.property(anySpotCount, (count) => {
        const diff = calculateTotalKobo(count + 1) - calculateTotalKobo(count);
        expect(diff).toBe(COIN_PRICE_KOBO);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-property: gate + calculate must agree
// ---------------------------------------------------------------------------

describe("validateMinSpots + calculateTotalKobo — cross-property consistency", () => {
  it("a spot count that passes validation always produces a total >= the minimum required total", () => {
    fc.assert(
      fc.property(validSpotCount, (count) => {
        expect(validateMinSpots(count)).toBe(true);
        expect(calculateTotalKobo(count)).toBeGreaterThanOrEqual(
          calculateTotalKobo(MIN_SPOTS),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("a spot count that fails validation always produces a total < the minimum required total", () => {
    fc.assert(
      fc.property(invalidSpotCount, (count) => {
        expect(validateMinSpots(count)).toBe(false);
        expect(calculateTotalKobo(count)).toBeLessThan(
          calculateTotalKobo(MIN_SPOTS),
        );
      }),
      { numRuns: 100 },
    );
  });
});
