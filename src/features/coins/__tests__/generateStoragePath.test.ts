// Feature: supabase-backend-integration, Property 6: Storage paths are user-prefixed

/**
 * Property-based tests for storage path generation.
 *
 * **Validates: Requirements 2.5, 3.5, 19.1, 19.2, 21.13**
 *
 * Property 6: For any file uploaded to the `coin-photos` or `note-photos`
 * bucket by an authenticated user, the file path SHALL begin with that user's
 * `auth.uid()` as the first path segment. No user SHALL be able to upload to
 * a path prefixed with another user's ID.
 *
 * File path convention: `{user_id}/{timestamp}-{random_id}.{extension}`
 * Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890/1719876543210-abc123.jpg`
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateStoragePath } from "../utils/generateStoragePath.js";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** UUID-style user IDs, matching auth.uid() format from Supabase. */
const userId = fc.uuid();

/** A pair of distinct user IDs for cross-user tests. */
const twoDistinctUserIds = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([a, b]) => a !== b);

/** Common image filename extensions. */
const imageExt = fc.constantFrom("jpg", "jpeg", "png", "webp", "gif", "JPEG", "PNG");

/** Filenames with a variety of names and extensions. */
const filename = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z0-9_\-]{1,30}$/),
    imageExt,
  )
  .map(([name, ext]) => `${name}.${ext}`);

/** Filenames without an extension (edge case). */
const filenameNoExt = fc.stringMatching(/^[a-zA-Z0-9_\-]{1,30}$/);

// ---------------------------------------------------------------------------
// Property 6a — User prefix invariant
// ---------------------------------------------------------------------------

describe(
  "generateStoragePath — Property 6: Storage paths are user-prefixed",
  () => {
    it("user prefix invariant: path always starts with userId + '/'", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          expect(path.startsWith(`${uid}/`)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("first path segment is exactly the userId (no extra characters)", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const firstSegment = path.split("/")[0];
          expect(firstSegment).toBe(uid);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 6b — Different users get different prefixes
    // ---------------------------------------------------------------------------

    it("different users get different first path segments", () => {
      fc.assert(
        fc.property(twoDistinctUserIds, filename, ([uid1, uid2], fname) => {
          const path1 = generateStoragePath(uid1, fname);
          const path2 = generateStoragePath(uid2, fname);
          const prefix1 = path1.split("/")[0];
          const prefix2 = path2.split("/")[0];
          expect(prefix1).not.toBe(prefix2);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 6c — Path structure
    // ---------------------------------------------------------------------------

    it("path structure: exactly one '/' separating userId from the rest", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const slashCount = (path.match(/\//g) ?? []).length;
          expect(slashCount).toBe(1);
        }),
        { numRuns: 100 },
      );
    });

    it("filename part contains a '-' separator between timestamp and randomId", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const filenamePart = path.split("/")[1];
          expect(filenamePart).toContain("-");
        }),
        { numRuns: 100 },
      );
    });

    it("filename part matches pattern {timestamp}-{randomId}.{ext}", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const filenamePart = path.split("/")[1];
          // Must be: digits, hyphen, alphanumeric randomId, dot, extension
          expect(filenamePart).toMatch(/^\d+-[a-z0-9]+\.[a-z]+$/);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 6d — Extension preservation
    // ---------------------------------------------------------------------------

    it("extension preservation: original file extension is preserved (lowercased)", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const dotIndex = fname.lastIndexOf(".");
          const originalExt = fname.slice(dotIndex + 1).toLowerCase();
          expect(path.endsWith(`.${originalExt}`)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("extension is always lowercase regardless of input casing", () => {
      fc.assert(
        fc.property(userId, filename, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          const generatedExt = path.split(".").pop() ?? "";
          expect(generatedExt).toBe(generatedExt.toLowerCase());
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Property 6e — No cross-user prefix forgery
    // ---------------------------------------------------------------------------

    it("no cross-user prefix forgery: path for userId A never starts with userId B's prefix", () => {
      fc.assert(
        fc.property(twoDistinctUserIds, filename, ([uid1, uid2], fname) => {
          const pathForA = generateStoragePath(uid1, fname);
          // Path generated for user A must not start with user B's prefix
          expect(pathForA.startsWith(`${uid2}/`)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("path for userId A contains userId A and does not contain userId B", () => {
      fc.assert(
        fc.property(twoDistinctUserIds, filename, ([uid1, uid2], fname) => {
          const pathForA = generateStoragePath(uid1, fname);
          // First segment must be uid1, not uid2
          const firstSegment = pathForA.split("/")[0];
          expect(firstSegment).toBe(uid1);
          expect(firstSegment).not.toBe(uid2);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Edge case — filename without extension
    // ---------------------------------------------------------------------------

    it("handles filenames without an extension (no trailing dot in path)", () => {
      fc.assert(
        fc.property(userId, filenameNoExt, (uid, fname) => {
          const path = generateStoragePath(uid, fname);
          // Must still start with userId prefix
          expect(path.startsWith(`${uid}/`)).toBe(true);
          // No trailing dot (extension-less files should not end with '.')
          expect(path.endsWith(".")).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    // ---------------------------------------------------------------------------
    // Purity
    // ---------------------------------------------------------------------------

    it("is deterministic in structure: two calls for the same user always produce the same prefix", () => {
      fc.assert(
        fc.property(userId, filename, filename, (uid, fname1, fname2) => {
          const path1 = generateStoragePath(uid, fname1);
          const path2 = generateStoragePath(uid, fname2);
          const prefix1 = path1.split("/")[0];
          const prefix2 = path2.split("/")[0];
          // Both paths' first segment must equal the userId
          expect(prefix1).toBe(uid);
          expect(prefix2).toBe(uid);
        }),
        { numRuns: 100 },
      );
    });
  },
);
