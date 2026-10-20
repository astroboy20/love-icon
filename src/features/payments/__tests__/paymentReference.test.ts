// Feature: supabase-backend-integration, Property 1: Payment reference uniqueness

/**
 * Property-based tests for payment reference generation.
 *
 * **Validates: Requirements 4.8, 12.8, 13.1**
 *
 * Property 1: For any checkout attempt, the generated payment reference
 * `lovecoin-{userId}-{timestamp}` SHALL be unique across all purchase orders,
 * ensuring that duplicate checkout session creations or webhook deliveries for
 * the same reference do not result in duplicate coin claims.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generatePaymentReference } from "../utils/paymentReference.js";

// Generator: UUID-like user IDs (non-empty strings without hyphens conflicts)
const userId = fc.uuid();

// Generator: positive integer timestamps (milliseconds since epoch)
const timestamp = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER });

describe(
  "generatePaymentReference — Property 1: Payment reference uniqueness",
  () => {
    it("always begins with the 'lovecoin-' prefix", () => {
      fc.assert(
        fc.property(userId, timestamp, (uid, ts) => {
          const ref = generatePaymentReference(uid, ts);
          expect(ref.startsWith("lovecoin-")).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("always embeds the userId in the reference", () => {
      fc.assert(
        fc.property(userId, timestamp, (uid, ts) => {
          const ref = generatePaymentReference(uid, ts);
          expect(ref).toContain(uid);
        }),
        { numRuns: 100 },
      );
    });

    it("always embeds the timestamp in the reference", () => {
      fc.assert(
        fc.property(userId, timestamp, (uid, ts) => {
          const ref = generatePaymentReference(uid, ts);
          expect(ref).toContain(String(ts));
        }),
        { numRuns: 100 },
      );
    });

    it("distinct timestamps for the same user produce distinct references", () => {
      fc.assert(
        fc.property(
          userId,
          // Two distinct timestamps
          fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER - 1 }),
          fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER - 1 }),
          (uid, ts1, ts2) => {
            fc.pre(ts1 !== ts2);
            const ref1 = generatePaymentReference(uid, ts1);
            const ref2 = generatePaymentReference(uid, ts2);
            expect(ref1).not.toBe(ref2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("distinct users at the same timestamp produce distinct references", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          timestamp,
          (uid1, uid2, ts) => {
            fc.pre(uid1 !== uid2);
            const ref1 = generatePaymentReference(uid1, ts);
            const ref2 = generatePaymentReference(uid2, ts);
            expect(ref1).not.toBe(ref2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("references in a batch of distinct (userId, timestamp) pairs are all unique", () => {
      fc.assert(
        fc.property(
          // Generate an array of up to 50 distinct (userId, timestamp) tuples
          fc.uniqueArray(
            fc.tuple(fc.uuid(), fc.integer({ min: 1, max: 2_000_000_000 })),
            {
              minLength: 2,
              maxLength: 50,
              // Two tuples are considered equal when both elements match
              comparator: ([uid1, ts1], [uid2, ts2]) =>
                uid1 === uid2 && ts1 === ts2,
            },
          ),
          (pairs) => {
            const refs = pairs.map(([uid, ts]) =>
              generatePaymentReference(uid, ts),
            );
            const uniqueRefs = new Set(refs);
            expect(uniqueRefs.size).toBe(refs.length);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("produces a non-empty string for any valid inputs", () => {
      fc.assert(
        fc.property(userId, timestamp, (uid, ts) => {
          const ref = generatePaymentReference(uid, ts);
          expect(typeof ref).toBe("string");
          expect(ref.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it("is a pure function — same inputs always yield the same reference", () => {
      fc.assert(
        fc.property(userId, timestamp, (uid, ts) => {
          const ref1 = generatePaymentReference(uid, ts);
          const ref2 = generatePaymentReference(uid, ts);
          expect(ref1).toBe(ref2);
        }),
        { numRuns: 100 },
      );
    });
  },
);
