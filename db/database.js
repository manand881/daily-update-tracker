const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('crypto');

const dbPath = path.join(app.getPath('userData'), 'updates.db');
const db = new Database(dbPath);

// Migrate existing databases
try { db.exec(`ALTER TABLE updates ADD COLUMN impediments TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE updates ADD COLUMN updated_at TEXT`); } catch (_) {}

// Sync migrations: add sync_id to all tables
try { db.exec(`ALTER TABLE updates ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE people ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE repos ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE holidays ADD COLUMN sync_id TEXT`); } catch (_) {}

// Unique indexes for sync_id lookups
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_updates_sync_id ON updates(sync_id) WHERE sync_id IS NOT NULL`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_people_sync_id ON people(sync_id) WHERE sync_id IS NOT NULL`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_repos_sync_id ON repos(sync_id) WHERE sync_id IS NOT NULL`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_sync_id ON holidays(sync_id) WHERE sync_id IS NOT NULL`);

// Backfill sync_id for existing records that don't have one
const backfill = (table) => {
  const rows = db.prepare(`SELECT id FROM ${table} WHERE sync_id IS NULL`).all();
  const stmt = db.prepare(`UPDATE ${table} SET sync_id = ? WHERE id = ?`);
  for (const row of rows) stmt.run(randomUUID(), row.id);
};
backfill('updates');
backfill('people');
backfill('repos');
backfill('holidays');

db.exec(`
  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'Holiday'
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    what TEXT NOT NULL,
    repos TEXT DEFAULT '',
    why TEXT DEFAULT '',
    impact TEXT DEFAULT '',
    who TEXT DEFAULT '',
    impediments TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_updates_date ON updates(date);
`);

module.exports = {
  getAllUpdates() {
    return db.prepare('SELECT * FROM updates ORDER BY date DESC, created_at DESC').all();
  },

  getUpdatesByDate(date) {
    return db.prepare('SELECT * FROM updates WHERE date = ? ORDER BY created_at ASC').all(date);
  },

  getDatesWithUpdates() {
    return db.prepare('SELECT DISTINCT date FROM updates').all().map(r => r.date);
  },

  createUpdate({ date, what, repos = '', why = '', impact = '', who = '', impediments = '' }) {
    const result = db.prepare(`
      INSERT INTO updates (sync_id, date, what, repos, why, impact, who, impediments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), date, what, repos, why, impact, who, impediments);
    return db.prepare('SELECT * FROM updates WHERE id = ?').get(result.lastInsertRowid);
  },

  editUpdate(id, { what, repos = '', why = '', impact = '', who = '', impediments = '' }) {
    db.prepare(`
      UPDATE updates SET what = ?, repos = ?, why = ?, impact = ?, who = ?, impediments = ?, updated_at = datetime('now') WHERE id = ?
    `).run(what, repos, why, impact, who, impediments, id);
    return db.prepare('SELECT * FROM updates WHERE id = ?').get(id);
  },

  deleteUpdate(id) {
    db.prepare('DELETE FROM updates WHERE id = ?').run(id);
    return { success: true };
  },

  getAllPeople() {
    return db.prepare('SELECT * FROM people ORDER BY name ASC').all();
  },

  createPerson(name) {
    const result = db.prepare('INSERT INTO people (sync_id, name) VALUES (?, ?)').run(randomUUID(), name.trim());
    return db.prepare('SELECT * FROM people WHERE id = ?').get(result.lastInsertRowid);
  },

  updatePerson(id, name) {
    db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name.trim(), id);
    return db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  },

  deletePerson(id) {
    db.prepare('DELETE FROM people WHERE id = ?').run(id);
    return { success: true };
  },

  getAllRepos() {
    return db.prepare('SELECT * FROM repos ORDER BY name ASC').all();
  },

  createRepo(name) {
    const result = db.prepare('INSERT INTO repos (sync_id, name) VALUES (?, ?)').run(randomUUID(), name.trim());
    return db.prepare('SELECT * FROM repos WHERE id = ?').get(result.lastInsertRowid);
  },

  getHoliday(date) {
    return db.prepare('SELECT * FROM holidays WHERE date = ?').get(date) || null;
  },

  getAllHolidays() {
    return db.prepare('SELECT * FROM holidays ORDER BY date ASC').all();
  },

  getAllHolidayDates() {
    return db.prepare('SELECT date FROM holidays').all().map(r => r.date);
  },

  setHoliday(date, name) {
    db.prepare(`
      INSERT INTO holidays (sync_id, date, name) VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET name = excluded.name
    `).run(randomUUID(), date, name);
    return db.prepare('SELECT * FROM holidays WHERE date = ?').get(date);
  },

  getAllForSync() {
    return {
      updates:  db.prepare('SELECT * FROM updates').all(),
      people:   db.prepare('SELECT * FROM people').all(),
      repos:    db.prepare('SELECT * FROM repos').all(),
      holidays: db.prepare('SELECT * FROM holidays').all(),
    };
  },

  mergeFromPeer({ updates = [], people = [], repos = [], holidays = [] }) {
    const mergeUpdates = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO updates (sync_id, date, what, repos, why, impact, who, impediments, created_at, updated_at)
        VALUES (@sync_id, @date, @what, @repos, @why, @impact, @who, @impediments, @created_at, @updated_at)
        ON CONFLICT(sync_id) DO UPDATE SET
          date        = excluded.date,
          what        = excluded.what,
          repos       = excluded.repos,
          why         = excluded.why,
          impact      = excluded.impact,
          who         = excluded.who,
          impediments = excluded.impediments,
          updated_at  = excluded.updated_at
        WHERE COALESCE(excluded.updated_at, excluded.created_at) >
              COALESCE(updates.updated_at,  updates.created_at)
      `);
      for (const u of updates) if (u.sync_id) stmt.run(u);
    });

    const mergePeople = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO people (sync_id, name, created_at)
        VALUES (@sync_id, @name, @created_at)
        ON CONFLICT(sync_id) DO UPDATE SET name = excluded.name
        WHERE excluded.created_at > people.created_at
      `);
      for (const p of people) if (p.sync_id) stmt.run(p);
    });

    const mergeRepos = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO repos (sync_id, name, created_at)
        VALUES (@sync_id, @name, @created_at)
      `);
      for (const r of repos) if (r.sync_id) stmt.run(r);
    });

    const mergeHolidays = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO holidays (sync_id, date, name)
        VALUES (@sync_id, @date, @name)
        ON CONFLICT(date) DO UPDATE SET name = excluded.name, sync_id = excluded.sync_id
      `);
      for (const h of holidays) if (h.sync_id) stmt.run(h);
    });

    mergeUpdates();
    mergePeople();
    mergeRepos();
    mergeHolidays();
  },

  removeHoliday(date) {
    db.prepare('DELETE FROM holidays WHERE date = ?').run(date);
    return { success: true };
  },
};
