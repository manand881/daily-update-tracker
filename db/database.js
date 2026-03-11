const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('crypto');

const dbPath = path.join(app.getPath('userData'), 'updates.db');
const db = new Database(dbPath);

// Create tables first (safe for both fresh installs and existing DBs)
db.exec(`
  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'Holiday',
    sync_id TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    sync_id TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    sync_id TEXT
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
    ticket_link TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    sync_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_updates_date ON updates(date);
`);

// Migrate existing databases (no-ops on fresh installs where columns already exist)
try { db.exec(`ALTER TABLE updates ADD COLUMN impediments TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE updates ADD COLUMN updated_at TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE updates ADD COLUMN ticket_link TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE updates ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE people ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE repos ADD COLUMN sync_id TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE holidays ADD COLUMN sync_id TEXT`); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS deleted_records (
    sync_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    deleted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (sync_id, table_name)
  );
`);

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

  searchUpdates({ keyword = '', people = [], repos = [] }) {
    const conditions = [];
    const params = [];

    if (keyword.trim()) {
      const kw = `%${keyword.trim()}%`;
      conditions.push('(what LIKE ? OR why LIKE ? OR impact LIKE ? OR impediments LIKE ? OR ticket_link LIKE ?)');
      params.push(kw, kw, kw, kw, kw);
    }
    for (const name of people) {
      conditions.push('who LIKE ?');
      params.push(`%${name}%`);
    }
    for (const name of repos) {
      conditions.push('repos LIKE ?');
      params.push(`%${name}%`);
    }

    if (!conditions.length) return { dates: [], total: 0 };

    const where = conditions.join(' AND ');
    const dates = db.prepare(`SELECT DISTINCT date FROM updates WHERE ${where} ORDER BY date ASC`).all(...params).map(r => r.date);
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM updates WHERE ${where}`).get(...params);
    return { dates, total };
  },

  searchByDate(date, { keyword = '', people = [], repos = [] }) {
    const conditions = ['date = ?'];
    const params = [date];

    if (keyword.trim()) {
      const kw = `%${keyword.trim()}%`;
      conditions.push('(what LIKE ? OR why LIKE ? OR impact LIKE ? OR impediments LIKE ? OR ticket_link LIKE ?)');
      params.push(kw, kw, kw, kw, kw);
    }
    for (const name of people) {
      conditions.push('who LIKE ?');
      params.push(`%${name}%`);
    }
    for (const name of repos) {
      conditions.push('repos LIKE ?');
      params.push(`%${name}%`);
    }

    return db.prepare(`SELECT * FROM updates WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`).all(...params);
  },

  createUpdate({ date, what, repos = '', why = '', impact = '', who = '', impediments = '', ticket_link = '' }) {
    const result = db.prepare(`
      INSERT INTO updates (sync_id, date, what, repos, why, impact, who, impediments, ticket_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), date, what, repos, why, impact, who, impediments, ticket_link);
    return db.prepare('SELECT * FROM updates WHERE id = ?').get(result.lastInsertRowid);
  },

  editUpdate(id, { what, repos = '', why = '', impact = '', who = '', impediments = '', ticket_link = '' }) {
    db.prepare(`
      UPDATE updates SET what = ?, repos = ?, why = ?, impact = ?, who = ?, impediments = ?, ticket_link = ?, updated_at = datetime('now') WHERE id = ?
    `).run(what, repos, why, impact, who, impediments, ticket_link, id);
    return db.prepare('SELECT * FROM updates WHERE id = ?').get(id);
  },

  deleteUpdate(id) {
    const row = db.prepare('SELECT sync_id FROM updates WHERE id = ?').get(id);
    if (row && row.sync_id) {
      db.prepare(`INSERT OR REPLACE INTO deleted_records (sync_id, table_name, deleted_at) VALUES (?, 'updates', datetime('now'))`).run(row.sync_id);
    }
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
    const row = db.prepare('SELECT sync_id FROM people WHERE id = ?').get(id);
    if (row && row.sync_id) {
      db.prepare(`INSERT OR REPLACE INTO deleted_records (sync_id, table_name, deleted_at) VALUES (?, 'people', datetime('now'))`).run(row.sync_id);
    }
    db.prepare('DELETE FROM people WHERE id = ?').run(id);
    return { success: true };
  },

  getAllRepos() {
    return db.prepare('SELECT * FROM repos ORDER BY name ASC').all();
  },

  createRepo(name) {
    const normalized = name.trim().replace(/^@+/, '');
    const result = db.prepare('INSERT INTO repos (sync_id, name) VALUES (?, ?)').run(randomUUID(), normalized);
    return db.prepare('SELECT * FROM repos WHERE id = ?').get(result.lastInsertRowid);
  },

  deleteRepo(id) {
    const row = db.prepare('SELECT sync_id FROM repos WHERE id = ?').get(id);
    if (row && row.sync_id) {
      db.prepare(`INSERT OR REPLACE INTO deleted_records (sync_id, table_name, deleted_at) VALUES (?, 'repos', datetime('now'))`).run(row.sync_id);
    }
    db.prepare('DELETE FROM repos WHERE id = ?').run(id);
    return { success: true };
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
      updates:        db.prepare('SELECT * FROM updates').all(),
      people:         db.prepare('SELECT * FROM people').all(),
      repos:          db.prepare('SELECT * FROM repos').all(),
      holidays:       db.prepare('SELECT * FROM holidays').all(),
      deleted_records: db.prepare('SELECT * FROM deleted_records').all(),
    };
  },

  mergeFromPeer({ updates = [], people = [], repos = [], holidays = [], deleted_records = [] }) {
    let changed = 0;

    // Apply tombstones first — delete locally and record tombstone so we don't re-insert
    const applyTombstones = db.transaction(() => {
      const saveTombstone = db.prepare(`INSERT OR REPLACE INTO deleted_records (sync_id, table_name, deleted_at) VALUES (@sync_id, @table_name, @deleted_at)`);
      const deleteStmts = {
        updates:  db.prepare('DELETE FROM updates WHERE sync_id = ?'),
        people:   db.prepare('DELETE FROM people WHERE sync_id = ?'),
        repos:    db.prepare('DELETE FROM repos WHERE sync_id = ?'),
        holidays: db.prepare('DELETE FROM holidays WHERE sync_id = ?'),
      };
      for (const t of deleted_records) {
        if (!t.sync_id || !deleteStmts[t.table_name]) continue;
        const { changes } = deleteStmts[t.table_name].run(t.sync_id);
        if (changes) changed++;
        saveTombstone.run(t);
      }
    });

    const mergeUpdates = db.transaction(() => {
      const isTombstoned = db.prepare(`SELECT 1 FROM deleted_records WHERE sync_id = ? AND table_name = 'updates'`);
      const find   = db.prepare('SELECT updated_at, created_at FROM updates WHERE sync_id = ?');
      const insert = db.prepare(`
        INSERT INTO updates (sync_id, date, what, repos, why, impact, who, impediments, ticket_link, created_at, updated_at)
        VALUES (@sync_id, @date, @what, @repos, @why, @impact, @who, @impediments, @ticket_link, @created_at, @updated_at)
      `);
      const update = db.prepare(`
        UPDATE updates SET date=@date, what=@what, repos=@repos, why=@why, impact=@impact,
          who=@who, impediments=@impediments, ticket_link=@ticket_link, updated_at=@updated_at
        WHERE sync_id=@sync_id
      `);
      for (const u of updates) {
        if (!u.sync_id) continue;
        if (isTombstoned.get(u.sync_id)) continue;
        const existing = find.get(u.sync_id);
        if (!existing) {
          insert.run(u); changed++;
        } else {
          const existingTs = existing.updated_at || existing.created_at;
          const incomingTs = u.updated_at || u.created_at;
          if (incomingTs > existingTs) { update.run(u); changed++; }
        }
      }
    });

    const mergePeople = db.transaction(() => {
      const isTombstoned = db.prepare(`SELECT 1 FROM deleted_records WHERE sync_id = ? AND table_name = 'people'`);
      const find   = db.prepare('SELECT created_at FROM people WHERE sync_id = ?');
      const insert = db.prepare('INSERT OR IGNORE INTO people (sync_id, name, created_at) VALUES (@sync_id, @name, @created_at)');
      const update = db.prepare('UPDATE people SET name=@name WHERE sync_id=@sync_id');
      for (const p of people) {
        if (!p.sync_id) continue;
        if (isTombstoned.get(p.sync_id)) continue;
        const existing = find.get(p.sync_id);
        if (!existing) {
          insert.run(p); changed++;
        } else if (p.created_at > existing.created_at) {
          update.run(p); changed++;
        }
      }
    });

    const mergeRepos = db.transaction(() => {
      const isTombstoned = db.prepare(`SELECT 1 FROM deleted_records WHERE sync_id = ? AND table_name = 'repos'`);
      const insert = db.prepare('INSERT OR IGNORE INTO repos (sync_id, name, created_at) VALUES (@sync_id, @name, @created_at)');
      for (const r of repos) {
        if (!r.sync_id) continue;
        if (isTombstoned.get(r.sync_id)) continue;
        const { changes } = insert.run(r);
        changed += changes;
      }
    });

    const mergeHolidays = db.transaction(() => {
      const isTombstoned = db.prepare(`SELECT 1 FROM deleted_records WHERE sync_id = ? AND table_name = 'holidays'`);
      const find   = db.prepare('SELECT sync_id FROM holidays WHERE date = ?');
      const insert = db.prepare('INSERT OR IGNORE INTO holidays (sync_id, date, name) VALUES (@sync_id, @date, @name)');
      const update = db.prepare('UPDATE holidays SET name=@name, sync_id=@sync_id WHERE date=@date');
      for (const h of holidays) {
        if (!h.sync_id) continue;
        if (isTombstoned.get(h.sync_id)) continue;
        const existing = find.get(h.date);
        if (!existing) { insert.run(h); changed++; }
        else update.run(h);
      }
    });

    applyTombstones();
    mergeUpdates();
    mergePeople();
    mergeRepos();
    mergeHolidays();

    return changed;
  },

  removeHoliday(date) {
    const row = db.prepare('SELECT sync_id FROM holidays WHERE date = ?').get(date);
    if (row && row.sync_id) {
      db.prepare(`INSERT OR REPLACE INTO deleted_records (sync_id, table_name, deleted_at) VALUES (?, 'holidays', datetime('now'))`).run(row.sync_id);
    }
    db.prepare('DELETE FROM holidays WHERE date = ?').run(date);
    return { success: true };
  },

  // Call after running migrations to ensure peers will accept the latest data on next sync.
  touchAllUpdatedAt() {
    db.prepare(`UPDATE updates SET updated_at = datetime('now')`).run();
  },
};
