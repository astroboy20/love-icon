// Feature: supabase-backend-integration, Property 7: Naira-to-kobo conversion is exact

/**
 * Property-based tests for naira/kobo conversion utilities.
 *
 * **Validates: Requirements 4.1, 11.2**
 *
 * Property 7: For any Naira amount, converting to kobo by multiplying by 100
 * and back by dividing by 100 SHALL preserve the original value exactly. No
 * floating-point arithmetic SHALL be used for monetary calculations.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  nairaToKobo,
  koboToNaira,
  koboToNairaString,
} from "../utils/kobo.js";

// Generator: non-negative integer naira amounts within safe integer range
const nairaAmount = fc.integer({ min: 0, max: 1_000_000 });

describe("kobo conversion utilities — Property 7: Naira-to-kobo conversion is exact", () => {
  it("round-trip: koboToNaira(nairaToKobo(n)) === n for any non-negative integer naira amount", () => {
    fc.assert(
      fc.property(nairaAmount, (n) => {
        const kobo = nairaToKobo(n);
        const back = koboToNaira(kobo);
        expect(back).toBe(n);
      }),
      { numRuns: 25 },
    );
  });

  it("exactness: nairaToKobo(n) is always an integer (no floating-point artifacts)", () => {
    fc.assert(
      fc.property(nairaAmount, (n) => {
        const kobo = nairaToKobo(n);
        expect(Number.isInteger(kobo)).toBe(true);
      }),
      { numRuns: 25 },
    );
  });

  it("string representation: koboToNairaString(nairaToKobo(n)) ends in '.00' for integer naira inputs", () => {
    fc.assert(
      fc.property(nairaAmount, (n) => {
        const kobo = nairaToKobo(n);
        const str = koboToNairaString(kobo);
        // Must be a valid decimal string
        expect(str).toMatch(/^\d+\.\d{2}$/);
        // For whole-naira inputs the cents part must be "00"
        expect(str.endsWith(".00")).toBe(true);
      }),
      { numRuns: 25 },
    );
  });

  it("monotonicity: if a > b then nairaToKobo(a) > nairaToKobo(b)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 999_999 }),
        (a, b) => {
          fc.pre(a > b);
          expect(nairaToKobo(a)).toBeGreaterThan(nairaToKobo(b));
        },
      ),
      { numRuns: 25 },
    );
  });
});
