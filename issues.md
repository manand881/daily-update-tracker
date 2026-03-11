# Known Issues

## Migrations do not bump `updated_at` — can cause stale sync across peers

**File:** `db/database.js`

When a migration backfills a new column (e.g. `sync_id`), the `updated_at` field on existing rows is not touched. Sync conflict resolution in `mergeFromPeer` uses `updated_at || created_at` to decide which version wins. This means:

- Node A runs a migration and gains new data (e.g. `sync_id` values, new columns).
- Node B already has those rows with older or equal `created_at` timestamps.
- On sync, Node B sees no reason to update the rows (incoming timestamp is not strictly greater) and silently skips them.
- Result: migrated/backfilled data may never propagate to peers.

**Workaround:** Call `db.touchAllUpdatedAt()` after running migrations to bump `updated_at = datetime('now')` on all rows in `updates`, forcing peers to accept the latest version on next sync.

**Long-term fix:** Introduce a versioned migration system that tracks which migrations have run, and explicitly bumps `updated_at` only for rows affected by a data-altering migration.
