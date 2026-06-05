---
name: День storage & SQLITE_FULL
description: Why «День» saves can throw SQLITE_FULL and how the storage layer actually works
---

# «День» storage is AsyncStorage, not relational SQLite

- The app persists each day as a single JSON blob under key `day_YYYY-MM-DD` via
  `@react-native-async-storage/async-storage`. There is **no** expo-sqlite, no
  CREATE TABLE, no columns. So "add a missing column via migration" is never the
  right framing for this app.

## SQLITE_FULL (code 13) on save
- On Android, AsyncStorage is backed by SQLite with a **~6MB cap** enforced by a
  PRAGMA, independent of device free space. Hitting it makes *every* write fail
  with SQLITE_FULL — so a user can have gigabytes free and still see it.
- The bloat source is **legacy inline base64 photos**: older versions stored
  captured images as `data:image/...;base64,...` strings inside the day blob
  (web still does — no filesystem). On native, current `savePhoto` copies to
  `documentDirectory/photos/` and stores only a short `file://` path, so new
  photos are cheap; the cap is reached by accumulated *old* base64.
- Adding tiny fields (the quick/standard/deep mode refactor: energy/sleep/habits)
  does NOT cause this — it only tips an already-near-full DB over the edge.

**Why:** misdiagnosing this as a schema/column problem wastes effort; the real
lever is reducing stored bytes (or raising the cap, which needs a native build
and does nothing in Expo Go).

**How to apply:** keep large blobs (images, anything big) OUT of AsyncStorage —
store on the filesystem and keep only the path. `compactPhotoStorage()` in
`src/storage/storage.ts` runs at root-layout startup and relocates any remaining
inline base64 photos to disk (mirrors `parseEntry` legacy normalization incl. the
singular `photo` field; optimistic re-read guards against clobbering a concurrent
save). If SQLITE_FULL recurs in a real native build, raise the cap via the
async-storage gradle property / expo-build-properties (no effect in Expo Go).
