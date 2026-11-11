import { DatabaseSync, backup } from 'node:sqlite';
import { copyFileSync, constants, existsSync, mkdirSync, realpathSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** SQLite's online backup includes committed WAL pages. The destination must be new. */
export async function copySnapshot(source, destination) {
  const sourcePath = realpathSync(resolve(source));
  const destinationPath = resolve(destination);
  if (sourcePath === destinationPath || existsSync(destinationPath))
    throw new Error('Destination must be a new file; active databases are never overwritten.');
  mkdirSync(dirname(destinationPath), { recursive: true });
  const temporary = join(
    dirname(destinationPath),
    `.${basename(destinationPath)}.${randomBytes(10).toString('hex')}.partial`,
  );
  const sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
  let snapshotDb;
  try {
    sourceDb.exec('PRAGMA busy_timeout=5000');
    await backup(sourceDb, temporary);
    snapshotDb = new DatabaseSync(temporary);
    const integrity = snapshotDb.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok')
      throw new Error('SQLite integrity check failed.');
    if (snapshotDb.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('SQLite foreign key check failed.');
    snapshotDb.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');
    snapshotDb.close();
    snapshotDb = undefined;
    // This copies a closed, verified backup, never a live database file.
    copyFileSync(temporary, destinationPath, constants.COPYFILE_EXCL);
    return destinationPath;
  } finally {
    snapshotDb?.close();
    sourceDb.close();
    if (existsSync(temporary)) unlinkSync(temporary);
    for (const suffix of ['-wal', '-shm'])
      if (existsSync(temporary + suffix)) unlinkSync(temporary + suffix);
  }
}

async function runCli() {
  const [mode, source, destination, ...extra] = process.argv.slice(2);
  if (!['backup', 'restore'].includes(mode) || !source || !destination || extra.length) {
    console.error(
      'Usage: node scripts/backup-db.mjs backup <live.sqlite> <new-backup.sqlite>\n       node scripts/backup-db.mjs restore <backup.sqlite> <new-restored.sqlite>\nRestore creates a separate verified database. Stop the app before switching DB_PATH to it.',
    );
    process.exitCode = 1;
  } else {
    try {
      console.log(
        `${mode === 'backup' ? 'Consistent backup' : 'Verified restore'}: ${await copySnapshot(source, destination)}`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  void runCli();
