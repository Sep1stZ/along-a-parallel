import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copySnapshot } from '../scripts/backup-db.mjs';

test('online backup and restore include committed WAL data and refuse to overwrite an active database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'parallel-backup-'));
  const live = join(directory, 'live.sqlite');
  const destination = join(directory, 'backup.sqlite');
  const restored = join(directory, 'restored.sqlite');
  const db = new DatabaseSync(live);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE proof(id INTEGER PRIMARY KEY,value TEXT NOT NULL); INSERT INTO proof VALUES(1,'committed in WAL');",
  );
  try {
    await copySnapshot(live, destination);
    db.exec("INSERT INTO proof VALUES(2,'after snapshot')");
    await copySnapshot(destination, restored);
    const check = new DatabaseSync(restored, { readOnly: true });
    try {
      assert.deepEqual(
        check
          .prepare('SELECT value FROM proof')
          .all()
          .map((row) => row.value),
        ['committed in WAL'],
      );
    } finally {
      check.close();
    }
    await assert.rejects(copySnapshot(restored, live), /Destination must be a new file/);
    await assert.rejects(copySnapshot(live, destination), /Destination must be a new file/);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
