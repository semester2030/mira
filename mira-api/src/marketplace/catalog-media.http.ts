export type MediaSlice =
  | { status: 200; start: number; end: number; total: number }
  | { status: 206; start: number; end: number; total: number }
  | { status: 416; total: number };

/** AVPlayer asks for a byte range. A full 200 response makes the phone show a playback failure. */
export function sliceMediaRange(total: number, header: string | undefined): MediaSlice {
  if (!header || !header.trim() || total <= 0) {
    return total > 0
      ? { status: 200, start: 0, end: total - 1, total }
      : { status: 416, total };
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return { status: 416, total };
  const startRaw = match[1];
  const endRaw = match[2];
  let start: number;
  let end: number;
  if (startRaw === '' && endRaw !== '') {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return { status: 416, total };
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else if (startRaw !== '') {
    start = Number(startRaw);
    end = endRaw === '' ? total - 1 : Number(endRaw);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return { status: 416, total };
  } else {
    return { status: 416, total };
  }
  if (start < 0 || start >= total || end < start) return { status: 416, total };
  end = Math.min(end, total - 1);
  return { status: 206, start, end, total };
}

/** iPhone clips stay QuickTime. Serving them as MP4 makes the player reject the file. */
export function playbackContentType(bytes: Buffer, stored: string | null | undefined): string {
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  return stored && stored.length > 0 ? stored : 'application/octet-stream';
}
