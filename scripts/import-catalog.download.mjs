/** Resumable bounded-concurrency download for the large GeoNames language table. */
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, open, rename, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function downloadCatalogFile(url, filename) {
  const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
  if (!head.ok) throw new Error(`GeoNames HEAD: HTTP ${head.status}`);
  const size = Number(head.headers.get('content-length'));
  const lastModified = head.headers.get('last-modified');
  const etag = head.headers.get('etag');
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new Error('GeoNames source size is unavailable');
  const temporary = `${filename}.partial`;
  if (size < 32 * 1024 * 1024 || head.headers.get('accept-ranges') !== 'bytes') {
    const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`GeoNames download: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  } else {
    // An interrupted direct download is a valid initial prefix of the ZIP.
    const existing = await stat(filename)
      .then((file) => file.size)
      .catch(() => 0);
    const prefix = existing < size ? existing : 0;
    const partSize = 16 * 1024 * 1024;
    const parts = [];
    for (let start = prefix, index = 0; start < size; start += partSize, index++) {
      parts.push({
        start,
        end: Math.min(size - 1, start + partSize - 1),
        filename: `${filename}.range-${index}`,
      });
    }
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, parts.length) }, async () => {
        for (;;) {
          const part = parts[cursor++];
          if (!part) return;
          const response = await fetch(url, {
            headers: {
              Range: `bytes=${part.start}-${part.end}`,
              ...(etag ? { 'If-Range': etag } : {}),
            },
            signal: AbortSignal.timeout(600_000),
          });
          if (response.status !== 206 || !response.body)
            throw new Error(`GeoNames range download: HTTP ${response.status}`);
          await pipeline(Readable.fromWeb(response.body), createWriteStream(part.filename));
          if ((await stat(part.filename)).size !== part.end - part.start + 1)
            throw new Error('Incomplete GeoNames range');
          console.log(`GeoNames range ${part.start}-${part.end} complete`);
        }
      }),
    );
    const output = await open(temporary, 'w');
    try {
      if (prefix)
        for await (const chunk of createReadStream(filename, { start: 0, end: prefix - 1 }))
          await output.write(chunk);
      for (const part of parts)
        for await (const chunk of createReadStream(part.filename)) await output.write(chunk);
    } finally {
      await output.close();
    }
    for (const part of parts) await unlink(part.filename);
  }
  if ((await stat(temporary)).size !== size)
    throw new Error('Downloaded GeoNames file has the wrong length');
  await rename(temporary, filename);
  return { lastModified, bytes: size };
}
