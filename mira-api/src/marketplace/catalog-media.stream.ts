import type { Readable } from 'stream';
import { sliceMediaRange } from './catalog-media.http';

export type CatalogMediaStreamResult =
  | {
      status: 200 | 206;
      start: number;
      end: number;
      total: number;
      contentLength: number;
      contentRange?: string;
      body: Readable | Buffer;
    }
  | {
      status: 416;
      total: number;
      contentRange: string;
      body: Buffer;
    };

/** Map an HTTP Range header onto object size without loading the object. */
export function planMediaStream(total: number, rangeHeader: string | undefined): CatalogMediaStreamResult {
  const sliced = sliceMediaRange(total, rangeHeader);
  if (sliced.status === 416) {
    return {
      status: 416,
      total,
      contentRange: `bytes */${total}`,
      body: Buffer.alloc(0),
    };
  }
  const contentLength = sliced.end - sliced.start + 1;
  if (sliced.status === 206) {
    return {
      status: 206,
      start: sliced.start,
      end: sliced.end,
      total,
      contentLength,
      contentRange: `bytes ${sliced.start}-${sliced.end}/${total}`,
      body: Buffer.alloc(0),
    };
  }
  return {
    status: 200,
    start: 0,
    end: total - 1,
    total,
    contentLength: total,
    body: Buffer.alloc(0),
  };
}
