import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { S3CompatibleCatalogMediaStorage } from './catalog-media.s3';

/**
 * Regression: open() must keep the HTTP/S3 client alive until the Body stream
 * is fully consumed. Destroying the client when GetObject returns (old execute()
 * finally) truncates Range reads with ECONNRESET after a partial buffer.
 */
async function main() {
  const total = 65_536;
  const payload = Buffer.alloc(total, 0x5a);
  payload.write('ftyp', 4);
  payload.write('isom', 8);

  const writeSlow = (res: import('node:http').ServerResponse, buf: Buffer, status: number, headers: Record<string, string>) => {
    res.writeHead(status, headers);
    let offset = 0;
    const tick = () => {
      if (offset >= buf.length) {
        res.end();
        return;
      }
      const next = Math.min(offset + 512, buf.length);
      res.write(buf.subarray(offset, next));
      offset = next;
      setTimeout(tick, 5);
    };
    tick();
  };

  const server = createServer((req, res) => {
    // Path-style: /{bucket}/{key} — accept any key under the test bucket.
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Length': String(total),
        'Content-Type': 'video/mp4',
        ETag: '"test"',
      });
      res.end();
      return;
    }
    if (req.method === 'GET') {
      const range = String(req.headers.range || '');
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!match) {
        writeSlow(res, payload, 200, {
          'Content-Length': String(total),
          'Content-Type': 'video/mp4',
          ETag: '"test"',
        });
        return;
      }
      const start = Number(match[1]);
      const end = Number(match[2]);
      const slice = payload.subarray(start, end + 1);
      writeSlow(res, slice, 206, {
        'Content-Length': String(slice.length),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Type': 'video/mp4',
        ETag: '"test"',
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${port}`;

  const prev = process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK;
  process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK = 'true';
  process.env.NODE_ENV = 'test';

  try {
    const storage = new S3CompatibleCatalogMediaStorage(
      {
        bucket: 'test',
        region: 'auto',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        endpoint,
      },
      { timeoutMs: 30_000 },
    );

    const opened = await storage.open('clip', { rangeHeader: `bytes=0-${total - 1}` });
    assert.ok(opened && opened.status === 206, 'expected 206 open');
    assert.equal(opened!.contentLength, total);
    assert.ok(opened!.body && typeof (opened!.body as Readable).pipe === 'function');

    const body = opened!.body as Readable;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      body.on('data', (c) => chunks.push(Buffer.from(c)));
      body.on('end', () => resolve());
      body.on('error', reject);
    });
    const received = Buffer.concat(chunks);
    assert.equal(received.length, total, `expected full ${total} bytes, got ${received.length}`);
    assert.ok(received.equals(payload));

    opened!.abort?.();
    console.log('catalog-media-s3 open-lifetime tests: ok');
  } finally {
    if (prev === undefined) delete process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK;
    else process.env.MIRA_MEDIA_S3_ALLOW_INSECURE_LOOPBACK = prev;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
