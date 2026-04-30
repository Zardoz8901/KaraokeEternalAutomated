import path from 'path'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite' // eslint-disable-line n/no-unsupported-features/node-builtins
import getLogger from './Log.js'

const log = getLogger('db')

type SqlParam = null | number | bigint | string | NodeJS.ArrayBufferView
// Compatibility with the previous `sqlite` package: untyped get/all callers
// historically received row objects as `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedRow = any

interface NormalizedParams {
  named?: Record<string, SqlParam>
  anonymous: SqlParam[]
}

interface Migration {
  id: number
  name: string
  filename: string
  up: string
  down: string
}

interface NodeSqliteError extends Error {
  code?: string
  errcode?: number
  errstr?: string
}

function toSqlParam (value: unknown): SqlParam {
  if (
    value === null
    || typeof value === 'number'
    || typeof value === 'bigint'
    || typeof value === 'string'
    || ArrayBuffer.isView(value)
  ) {
    return value as SqlParam
  }

  throw new TypeError(`Unsupported SQLite parameter type: ${typeof value}`)
}

function isNamedParams (value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && !ArrayBuffer.isView(value)
  )
}

function normalizeParams (params: unknown[]): NormalizedParams {
  if (params.length === 0) {
    return { anonymous: [] }
  }

  if (params.length === 1) {
    const first = params[0]

    if (Array.isArray(first)) {
      return { anonymous: first.map(toSqlParam) }
    }

    if (isNamedParams(first)) {
      return {
        named: Object.fromEntries(
          Object.entries(first).map(([key, value]) => [key, toSqlParam(value)]),
        ),
        anonymous: [],
      }
    }
  }

  return { anonymous: params.map(toSqlParam) }
}

function throwCompatibleSqliteError (err: unknown): never {
  if (err instanceof Error) {
    const sqliteErr = err as NodeSqliteError

    if (
      sqliteErr.code === 'ERR_SQLITE_ERROR'
      && /constraint/i.test(sqliteErr.errstr ?? sqliteErr.message)
    ) {
      Object.defineProperty(sqliteErr, 'code', {
        value: 'SQLITE_CONSTRAINT',
        configurable: true,
        enumerable: true,
        writable: true,
      })
    }
  }

  throw err
}

function readMigrations (migrationsPath: string): Migration[] {
  const location = path.resolve(migrationsPath)
  const migrationFiles = fs.readdirSync(location)
    .map(file => file.match(/^(\d+).(.*?)\.sql$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => ({
      id: Number(match[1]),
      name: match[2],
      filename: match[0],
    }))
    .sort((a, b) => Math.sign(a.id - b.id))

  if (!migrationFiles.length) {
    throw new Error(`No migration files found in '${location}'.`)
  }

  return migrationFiles.map((migration) => {
    const data = fs.readFileSync(path.join(location, migration.filename), 'utf-8')
    const [up, down] = data.split(/^--\s+?down\b/im)

    return {
      ...migration,
      up: up.replace(/^-- .*?$/gm, '').trim(),
      down: down ? down.trim() : '',
    }
  })
}

export class DatabaseWrapper {
  private db: DatabaseSync
  public config: { filename: string }

  constructor (file: string, ro: boolean) {
    this.config = { filename: file }
    this.db = new DatabaseSync(file, {
      readOnly: ro,
      enableForeignKeyConstraints: false,
      enableDoubleQuotedStringLiterals: true,
    })
  }

  close () {
    this.db.close()
  }

  all<T = UntypedRow> (sql: string, ...params: unknown[]) {
    try {
      const stmt = this.db.prepare(sql)
      const normalized = normalizeParams(params)

      if (normalized.named) {
        return stmt.all(normalized.named, ...normalized.anonymous) as T[]
      }

      return stmt.all(...normalized.anonymous) as T[]
    } catch (err) {
      throwCompatibleSqliteError(err)
    }
  }

  run (sql: string, ...params: unknown[]) {
    try {
      const stmt = this.db.prepare(sql)
      const normalized = normalizeParams(params)
      const res = normalized.named
        ? stmt.run(normalized.named, ...normalized.anonymous)
        : stmt.run(...normalized.anonymous)

      return {
        lastID: Number(res.lastInsertRowid),
        changes: Number(res.changes),
      }
    } catch (err) {
      throwCompatibleSqliteError(err)
    }
  }

  get<T = UntypedRow> (sql: string, ...params: unknown[]) {
    try {
      const stmt = this.db.prepare(sql)
      const normalized = normalizeParams(params)
      const res = normalized.named
        ? stmt.get(normalized.named, ...normalized.anonymous)
        : stmt.get(...normalized.anonymous)

      return res as T | undefined
    } catch (err) {
      throwCompatibleSqliteError(err)
    }
  }

  exec (sql: string) {
    try {
      this.db.exec(sql)
    } catch (err) {
      throwCompatibleSqliteError(err)
    }
  }

  migrate ({ migrationsPath, force = false, table = 'migrations' }: { migrationsPath: string, force?: boolean, table?: string }) {
    const migrations = readMigrations(migrationsPath)

    this.run(`CREATE TABLE IF NOT EXISTS "${table}" (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL,
  up   TEXT    NOT NULL,
  down TEXT    NOT NULL
)`)

    let dbMigrations = this.all<{ id: number, name: string, up: string, down: string }>(
      `SELECT id, name, up, down FROM "${table}" ORDER BY id ASC`,
    )
    const lastMigration = migrations[migrations.length - 1]

    for (const migration of dbMigrations.slice().sort((a, b) => Math.sign(b.id - a.id))) {
      if (!migrations.some(x => x.id === migration.id) || (force && migration.id === lastMigration.id)) {
        this.exec('BEGIN')
        try {
          this.exec(migration.down)
          this.run(`DELETE FROM "${table}" WHERE id = ?`, migration.id)
          this.exec('COMMIT')
          dbMigrations = dbMigrations.filter(x => x.id !== migration.id)
        } catch (err) {
          this.exec('ROLLBACK')
          throw err
        }
      } else {
        break
      }
    }

    const lastMigrationId = dbMigrations.length
      ? dbMigrations[dbMigrations.length - 1].id
      : 0

    for (const migration of migrations) {
      if (migration.id > lastMigrationId) {
        this.exec('BEGIN')
        try {
          this.exec(migration.up)
          this.run(
            `INSERT INTO "${table}" (id, name, up, down) VALUES (?, ?, ?, ?)`,
            migration.id,
            migration.name,
            migration.up,
            migration.down,
          )
          this.exec('COMMIT')
        } catch (err) {
          this.exec('ROLLBACK')
          throw err
        }
      }
    }
  }
}

class Database {
  static refs: { db?: DatabaseWrapper } = {}

  static async close () {
    if (Database.refs.db) {
      log.info('Closing database file %s', Database.refs.db.config.filename)
      Database.refs.db.close()
      delete Database.refs.db
    }
  }

  static async open ({ file, ro = true }: { file: string, ro?: boolean } = { file: '', ro: true }) {
    if (Database.refs.db) throw new Error('Database already open')
    log.info('Opening database file %s %s', ro ? '(read-only)' : '(writeable)', file)

    // create path if it doesn't exist
    fs.mkdirSync(path.dirname(file), { recursive: true })

    const db = new DatabaseWrapper(file, ro)

    if (!ro) {
      db.migrate({
        migrationsPath: path.join(import.meta.dirname, 'schemas'),
      })

      db.exec('PRAGMA journal_mode = WAL;')
      db.exec('PRAGMA foreign_keys = ON;')
      db.exec('PRAGMA busy_timeout = 5000;')
    }

    Database.refs.db = db
    return db
  }
}

export const open = Database.open
export const close = Database.close

export default Database.refs
