import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join, dirname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

export function containedPath(root, key) {
  if (typeof key !== 'string' || !key || key.includes('\0') || key.includes('\\'))
    throw Error('Invalid storage key');
  const target = resolve(root, key);
  if (!target.startsWith(resolve(root) + sep)) throw Error('Storage path escapes its root');
  return target;
}

/** Adapt SQLite and a private file directory to the service's DB/BUCKET interfaces. */
export async function openStorage(dataDir) {
  const root = resolve(dataDir),
    files = join(root, 'files');
  await mkdir(files, { recursive: true, mode: 0o700 });
  const sql = new DatabaseSync(join(root, 'paperloom.sqlite'));
  try {
    sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    sql.exec(
      'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS _instance (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
    );
    const migrations = fileURLToPath(new URL('../drizzle/', import.meta.url));
    for (const name of (await readdir(migrations)).filter((n) => n.endsWith('.sql')).sort()) {
      if (sql.prepare('SELECT name FROM _migrations WHERE name=?').get(name)) continue;
      sql.exec('BEGIN IMMEDIATE');
      try {
        sql.exec(await readFile(join(migrations, name), 'utf8'));
        sql.prepare('INSERT INTO _migrations VALUES (?,?)').run(name, new Date().toISOString());
        sql.exec('COMMIT');
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    }
    sql
      .prepare('INSERT OR IGNORE INTO _instance VALUES (?,?)')
      .run('owner_id', 'local-' + randomUUID());
    const user = {
      userId: sql.prepare('SELECT value FROM _instance WHERE key=?').get('owner_id').value,
      email: '',
      displayName: '本机论文库',
    };
    const DB = {
      prepare(query) {
        const statement = sql.prepare(query);
        return {
          bind(...args) {
            return {
              async first() {
                return statement.get(...args) || null;
              },
              async all() {
                return { results: statement.all(...args) };
              },
              async run() {
                return { meta: { changes: Number(statement.run(...args).changes) } };
              },
            };
          },
        };
      },
    };
    const BUCKET = {
      async put(key, bytes) {
        const target = containedPath(files, key);
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        const temporary = target + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
          await rename(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
      },
      async get(key) {
        const target = containedPath(files, key);
        try {
          const handle = await import('node:fs/promises').then((m) => m.stat(target));
          if (!handle.isFile()) return null;
          return { body: Readable.toWeb(createReadStream(target)) };
        } catch (error) {
          if (error.code === 'ENOENT') return null;
          throw error;
        }
      },
    };
    return { DB, BUCKET, user, root, close: () => sql.close() };
  } catch (error) {
    sql.close();
    throw error;
  }
}
