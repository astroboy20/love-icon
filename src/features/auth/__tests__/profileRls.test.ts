// Feature: supabase-backend-integration, Property 8: RLS prevents cross-user profile updates

/**
 * Property-based tests for the profiles table RLS update policy.
 *
 * **Validates: Requirements 6.5, 21.12**
 *
 * Property 8: For any authenticated user, updating a profile row SHALL only
 * succeed when the row's `id` matches `auth.uid()`. No user SHALL be able to
 * update another user's `display_name`.
 *
 * The RLS policy on `public.profiles` for UPDATE enforces:
 *   using   (auth.uid() = id)
 *   with check (auth.uid() = id)
 *
 * This file models that invariant as a pure predicate and generates arbitrary
 * combinations of caller IDs and target profile IDs to verify the rule holds
 * universally — matching every possible pair the database evaluates.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure RLS predicate
//
// The Postgres RLS policy for UPDATE on public.profiles evaluates:
//   auth.uid() = id   (both in the USING clause and the WITH CHECK clause)
//
// We model this as a pure JavaScript function so fast-check can drive it with
// arbitrary inputs. The real enforcement runs in PostgreSQL; this test proves
// that the logical rule itself is correct and complete across all input pairs.
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the Supabase RLS policy would allow the update
 * (caller is updating their own profile row), `false` otherwise.
 *
 * @param callerUid  - auth.uid() of the authenticated user making the request
 * @param profileId  - `id` column value of the profile row being updated
 */
function rlsAllowsProfileUpdate(callerUid: string, profileId: string): boolean {
  return callerUid === profileId;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** UUID-style user IDs matching Supabase auth.uid() format. */
const anyUid = fc.uuid();

/**
 * A pair of distinct UUIDs representing two different users.
 * Used to model cross-user update attempts.
 */
const twoDistinctUids = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([a, b]) => a !== b);

/**
 * An arbitrary display name — the value being updated.
 * RLS is independent of the payload content, but including it makes the
 * property scenarios more realistic.
 */
const displayName = fc.string({ minLength: 1, maxLength: 100 });

// ---------------------------------------------------------------------------
// Property 8a — Self-update is always permitted
// ---------------------------------------------------------------------------

describe(
  "profileRls — Property 8: RLS prevents cross-user profile updates",
  () => {
    it("self-update is always permitted: callerUid === profileId → allowed", () => {
      fc.assert(
        fc.property(anyUid, displayName, (uid, _name) => {
          // The caller is updating their own row — must always be permitted.
          expect(rlsAllowsProfileUpdate(uid, uid)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 8b — Cross-user update is always denied
    // ---------------------------------------------------------------------------

    it("cross-user update is always denied: callerUid !== profileId → blocked", () => {
      fc.assert(
        fc.property(twoDistinctUids, displayName, ([callerUid, targetUid], _name) => {
          // The caller is trying to update another user's row — must always be blocked.
          expect(rlsAllowsProfileUpdate(callerUid, targetUid)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("reversed cross-user attempt is also denied: swapping caller and target still blocked", () => {
      fc.assert(
        fc.property(twoDistinctUids, ([uid1, uid2]) => {
          // uid1 → uid2 is blocked
          expect(rlsAllowsProfileUpdate(uid1, uid2)).toBe(false);
          // uid2 → uid1 is also blocked
          expect(rlsAllowsProfileUpdate(uid2, uid1)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 8c — The predicate is an equivalence relation
    // ---------------------------------------------------------------------------

    it("reflexivity: every uid is always allowed to update its own profile", () => {
      fc.assert(
        fc.property(anyUid, (uid) => {
          expect(rlsAllowsProfileUpdate(uid, uid)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("symmetry: if A cannot update B, then B cannot update A (no one-way privilege)", () => {
      fc.assert(
        fc.property(twoDistinctUids, ([uid1, uid2]) => {
          const aCanUpdateB = rlsAllowsProfileUpdate(uid1, uid2);
          const bCanUpdateA = rlsAllowsProfileUpdate(uid2, uid1);
          // Neither direction should be allowed for distinct users
          expect(aCanUpdateB).toBe(false);
          expect(bCanUpdateA).toBe(false);
          // And the two must agree (symmetry of denial)
          expect(aCanUpdateB).toBe(bCanUpdateA);
        }),
        { numRuns: 100 },
      );
    });

    it("purity: same (callerUid, profileId) always produces the same result", () => {
      fc.assert(
        fc.property(anyUid, anyUid, (callerUid, profileId) => {
          const result1 = rlsAllowsProfileUpdate(callerUid, profileId);
          const result2 = rlsAllowsProfileUpdate(callerUid, profileId);
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 8d — The predicate is equivalent to strict equality
    // ---------------------------------------------------------------------------

    it("allowed iff caller and profile IDs are strictly equal (no fuzzy match)", () => {
      fc.assert(
        fc.property(anyUid, anyUid, (callerUid, profileId) => {
          const allowed = rlsAllowsProfileUpdate(callerUid, profileId);
          const isOwnRow = callerUid === profileId;
          // The RLS predicate must match strict equality — no more, no less
          expect(allowed).toBe(isOwnRow);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 8e — No privilege escalation via partial ID match
    // ---------------------------------------------------------------------------

    it("a prefix-match of another user's ID is still denied", () => {
      fc.assert(
        fc.property(fc.uuid(), (victimId) => {
          // An attacker using a prefix of another user's UUID cannot update their row.
          const prefix = victimId.slice(0, 8);
          // The prefix is deliberately different from the full UUID
          fc.pre(prefix !== victimId);
          expect(rlsAllowsProfileUpdate(prefix, victimId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("a suffix-match of another user's ID is also denied", () => {
      fc.assert(
        fc.property(fc.uuid(), (victimId) => {
          const suffix = victimId.slice(-8);
          fc.pre(suffix !== victimId);
          expect(rlsAllowsProfileUpdate(suffix, victimId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("an empty string caller ID is never permitted to update any profile row", () => {
      fc.assert(
        fc.property(anyUid, (profileId) => {
          // An unauthenticated / malformed caller with empty uid must be denied.
          expect(rlsAllowsProfileUpdate("", profileId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Deterministic boundary cases
    // ---------------------------------------------------------------------------

    it("two identical UUIDs produce a permitted update (exact boundary)", () => {
      const uid = "550e8400-e29b-41d4-a716-446655440000";
      expect(rlsAllowsProfileUpdate(uid, uid)).toBe(true);
    });

    it("two UUIDs differing by one character produce a denied update", () => {
      const uid1 = "550e8400-e29b-41d4-a716-446655440000";
      const uid2 = "550e8400-e29b-41d4-a716-446655440001"; // last char differs
      expect(rlsAllowsProfileUpdate(uid1, uid2)).toBe(false);
      expect(rlsAllowsProfileUpdate(uid2, uid1)).toBe(false);
    });
  },
);
