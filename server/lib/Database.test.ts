import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import refs, { close, open } from './Database.js'

let tempDir: string
let dbPath: string

describe('Database wrapper', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-db-'))
    dbPath = path.join(tempDir, 'database.sqlite3')
  })

  afterEach(async () => {
    if (refs.db) {
      try {
        await close()
      } catch {
        // Tests assert close behavior directly; cleanup should not mask failures.
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('runs migrations and applies required pragmas for writable databases', async () => {
    const db = await open({ file: dbPath, ro: false })

    const migrations = await db.all<{ id: number, name: string }>(
      'SELECT id, name FROM migrations ORDER BY id ASC',
    )
    expect(migrations.map(migration => migration.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(migrations[0].name).toBe('initial-schema')

    const adminRole = await db.get<{ name: string }>('SELECT name FROM roles WHERE name = ?', ['admin'])
    expect(adminRole?.name).toBe('admin')

    const journalMode = await db.get<{ journal_mode: string }>('PRAGMA journal_mode')
    expect(journalMode?.journal_mode).toBe('wal')

    const foreignKeys = await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')
    expect(foreignKeys?.foreign_keys).toBe(1)

    const busyTimeout = await db.get<{ timeout: number }>('PRAGMA busy_timeout')
    expect(busyTimeout?.timeout).toBe(5000)
  })

  it('preserves sqlite-compatible run/get/all/exec behavior', async () => {
    const db = await open({ file: dbPath, ro: false })

    await db.exec('CREATE TABLE contract_test (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')

    const alpha = await db.run('INSERT INTO contract_test (name) VALUES (?)', ['alpha'])
    expect(alpha.lastID).toEqual(expect.any(Number))
    expect(alpha.changes).toBe(1)

    const beta = await db.run('INSERT INTO contract_test (name) VALUES (?)', 'beta')
    expect(beta.lastID).toEqual(expect.any(Number))
    expect(beta.changes).toBe(1)

    const alphaRow = await db.get<{ name: string }>('SELECT name FROM contract_test WHERE id = ?', alpha.lastID)
    expect(alphaRow?.name).toBe('alpha')

    const update = await db.run('UPDATE contract_test SET name = ? WHERE id = ?', 'ALPHA', alpha.lastID)
    expect(update.changes).toBe(1)

    const rows = await db.all<{ name: string }>('SELECT name FROM contract_test ORDER BY id ASC')
    expect(rows.map(row => row.name)).toEqual(['ALPHA', 'beta'])
  })

  it('preserves legacy SQLite double-quoted string literal behavior', async () => {
    const db = await open({ file: dbPath, ro: false })

    const row = await db.get<{ key: string }>('SELECT "jwtKey" AS key')

    expect(row?.key).toBe('jwtKey')
  })

  it('normalizes constraint errors to the sqlite3 error code contract', async () => {
    const db = await open({ file: dbPath, ro: false })

    await db.exec('CREATE TABLE unique_test (id INTEGER PRIMARY KEY, ownerId INTEGER UNIQUE)')
    await db.run('INSERT INTO unique_test (ownerId) VALUES (?)', [1])

    await expect(Promise.resolve().then(() => db.run('INSERT INTO unique_test (ownerId) VALUES (?)', [1])))
      .rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT' })
  })

  it('does not create a missing database when opened read-only', async () => {
    await expect(open({ file: dbPath, ro: true })).rejects.toThrow()
    expect(refs.db).toBeUndefined()
    expect(fs.existsSync(dbPath)).toBe(false)
  })

  it('clears references on close so the same process can reopen a database', async () => {
    let db = await open({ file: dbPath, ro: false })
    await db.exec('CREATE TABLE reopen_test (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    await db.run('INSERT INTO reopen_test (name) VALUES (?)', ['first'])

    await close()
    expect(refs.db).toBeUndefined()

    db = await open({ file: dbPath, ro: false })
    const row = await db.get<{ name: string }>('SELECT name FROM reopen_test WHERE id = ?', [1])
    expect(row?.name).toBe('first')
  })
})
