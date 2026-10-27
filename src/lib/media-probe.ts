// Reads what we need straight from the file bytes, the same way in the
// browser (a File) and on the server (a downloaded Buffer):
//   - MP4 / MOV: duration, display size, video codec (H.264 = avc1/avc3)
//   - JPEG / PNG / WebP: pixel size, with JPEG EXIF rotation applied
// No dependencies. The browser's <video> element can tell duration and size
// but not the codec, so the codec always comes from here.

export type ByteReader = {
  size: number;
  read: (offset: number, length: number) => Promise<Uint8Array>;
};

export function bufferReader(bytes: Uint8Array): ByteReader {
  return { size: bytes.length, read: async (o, l) => bytes.subarray(o, Math.min(o + l, bytes.length)) };
}

export function fileReader(file: Blob): ByteReader {
  return {
    size: file.size,
    read: async (o, l) => new Uint8Array(await file.slice(o, Math.min(o + l, file.size)).arrayBuffer()),
  };
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const i32 = (b: Uint8Array, o: number) => u32(b, o) | 0;
const u16 = (b: Uint8Array, o: number) => (b[o] << 8) + b[o + 1];
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...Array.from(b.subarray(o, o + n)));

/* ── MP4 / MOV ─────────────────────────────────────────────────────── */

export type VideoInfo = { durationSeconds: number; width: number; height: number; codec: string | null };

type Box = { type: string; start: number; headerSize: number; size: number };

function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    let size = u32(b, o);
    const type = ascii(b, o + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      size = u64(b, o + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = to - o;
    }
    if (size < headerSize) break;
    out.push({ type, start: o, headerSize, size });
    o += size;
  }
  return out;
}

const child = (b: Uint8Array, parent: Box, type: string) => {
  return boxes(b, parent.start + parent.headerSize, parent.start + parent.size).find((c) => c.type === type) ?? null;
};

/** Finds the top-level moov box (it can be before or after the media data). */
async function readMoov(r: ByteReader): Promise<Uint8Array | null> {
  let o = 0;
  while (o + 8 <= r.size) {
    const head = await r.read(o, 16);
    let size = u32(head, 0);
    const type = ascii(head, 4, 4);
    if (size === 1) size = u64(head, 8);
    else if (size === 0) size = r.size - o;
    if (size < 8) return null;
    if (type === 'moov') return r.read(o, size);
    o += size;
  }
  return null;
}

export async function probeVideo(r: ByteReader): Promise<VideoInfo | null> {
  const head = await r.read(0, 12);
  if (head.length < 12 || ascii(head, 4, 4) !== 'ftyp') return null;
  const moov = await readMoov(r);
  if (!moov) return null;
  const root: Box = { type: 'moov', start: 0, headerSize: 8, size: moov.length };

  const mvhd = child(moov, root, 'mvhd');
  if (!mvhd) return null;
  const m = mvhd.start + mvhd.headerSize;
  const v1 = moov[m] === 1;
  const timescale = u32(moov, m + (v1 ? 20 : 12));
  const duration = v1 ? u64(moov, m + 24) : u32(moov, m + 16);

  for (const trak of boxes(moov, root.start + root.headerSize, root.size)) {
    if (trak.type !== 'trak') continue;
    const mdia = child(moov, trak, 'mdia');
    const hdlr = mdia && child(moov, mdia, 'hdlr');
    if (!mdia || !hdlr || ascii(moov, hdlr.start + hdlr.headerSize + 8, 4) !== 'vide') continue;

    const tkhd = child(moov, trak, 'tkhd');
    let width = 0;
    let height = 0;
    if (tkhd) {
      const t = tkhd.start + tkhd.headerSize;
      const tv1 = moov[t] === 1;
      const matrix = t + (tv1 ? 52 : 40);
      width = Math.round(u32(moov, matrix + 36) / 65536);
      height = Math.round(u32(moov, matrix + 40) / 65536);
      // A 90° / 270° rotation matrix (phones) swaps what the viewer sees.
      if (i32(moov, matrix) === 0 && Math.abs(i32(moov, matrix + 4)) === 65536) [width, height] = [height, width];
    }

    // stsd: version/flags, entry count, then the first entry's size and format (the codec).
    const minf = child(moov, mdia, 'minf');
    const stbl = minf && child(moov, minf, 'stbl');
    const stsd = stbl && child(moov, stbl, 'stsd');
    const codec = stsd && u32(moov, stsd.start + stsd.headerSize + 4) > 0 ? ascii(moov, stsd.start + stsd.headerSize + 12, 4) : null;

    return { durationSeconds: timescale ? duration / timescale : 0, width, height, codec };
  }
  return null;
}

export const isH264 = (codec: string | null) => codec === 'avc1' || codec === 'avc3';

export function codecName(codec: string | null): string {
  if (!codec) return 'an unknown codec';
  if (isH264(codec)) return 'H.264';
  if (codec === 'hvc1' || codec === 'hev1') return 'HEVC (H.265)';
  if (codec === 'av01') return 'AV1';
  if (codec === 'vp09') return 'VP9';
  if (codec === 'apcn' || codec === 'apch' || codec === 'apcs' || codec === 'apco' || codec === 'ap4h') return 'ProRes';
  return codec;
}

/* ── Images ────────────────────────────────────────────────────────── */

export type ImageInfo = { format: 'jpeg' | 'png' | 'webp'; width: number; height: number };

export async function probeImage(r: ByteReader): Promise<ImageInfo | null> {
  const b = await r.read(0, Math.min(r.size, 256 * 1024));
  if (b.length < 30) return null;

  // PNG: IHDR is always first.
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return { format: 'png', width: u32(b, 16), height: u32(b, 20) };

  // WebP: lossy (VP8 ), lossless (VP8L) or extended (VP8X).
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') return { format: 'webp', width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ') return { format: 'webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    return null;
  }

  // JPEG: walk the markers to the frame header; note EXIF orientation on the way.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    let rotated = false;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1];
      const len = u16(b, o + 2);
      if (marker === 0xe1 && ascii(b, o + 4, 4) === 'Exif') rotated = exifRotated(b, o + 10);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) {
        const height = u16(b, o + 5);
        const width = u16(b, o + 7);
        return rotated ? { format: 'jpeg', width: height, height: width } : { format: 'jpeg', width, height };
      }
      o += 2 + len;
    }
  }
  return null;
}

// EXIF orientation 5–8 means the photo is shown turned 90°.
function exifRotated(b: Uint8Array, tiff: number): boolean {
  const le = ascii(b, tiff, 2) === 'II';
  const r16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : u16(b, o));
  const r32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : u32(b, o));
  const ifd = tiff + r32(tiff + 4);
  if (ifd + 2 > b.length) return false;
  const entries = r16(ifd);
  for (let i = 0; i < entries; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > b.length) return false;
    if (r16(e) === 0x0112) return r16(e + 8) >= 5;
  }
  return false;
}
