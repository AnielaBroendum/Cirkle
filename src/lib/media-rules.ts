import { codecName, isH264, probeImage, probeVideo, type ByteReader } from './media-probe';

// Upload rules from Figma (Brand Portal 08 "File requirements" and 04 "Images").
// The same checks run in the browser before upload and on the server after it.

const MB = 1024 * 1024;

export const STORY_RULES = {
  maxStories: 10,
  video: { types: ['video/mp4', 'video/quicktime'], maxBytes: 50 * MB, maxSeconds: 20 },
  image: { types: ['image/jpeg', 'image/png'], maxBytes: 10 * MB, showSeconds: 6 },
  width: 1080,
  height: 1920,
} as const;

export const PRODUCT_IMAGE_RULES = {
  max: 8,
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 10 * MB,
  minWidth: 1200,
  minHeight: 1600,
} as const;

export const STORY_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov,image/jpeg,image/png';
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const mb = (bytes: number) => `${Math.ceil(bytes / MB)} MB`;
const seconds = (s: number) => `${Math.round(s * 10) / 10} s`.replace('.0 s', ' s');

// Aspect ratio within 1% (encoders round odd sizes, e.g. 1080 × 1918).
const ratioIs = (w: number, h: number, rw: number, rh: number) => Math.abs(w / h - rw / rh) / (rw / rh) <= 0.01;

export type StoryCheck =
  | { ok: true; kind: 'video' | 'image'; width: number; height: number; durationSeconds: number | null }
  | { ok: false; error: string };

/** type: the file's MIME type (browser) or the stored content type (server). */
export async function checkStory(r: ByteReader, type: string): Promise<StoryCheck> {
  const isVideo = (STORY_RULES.video.types as readonly string[]).includes(type);
  const isImage = (STORY_RULES.image.types as readonly string[]).includes(type);
  if (!isVideo && !isImage) return { ok: false, error: 'Use an MP4 or MOV video, or a JPG or PNG image.' };

  if (isVideo) {
    if (r.size > STORY_RULES.video.maxBytes) return { ok: false, error: `Video is ${mb(r.size)}. Max is 50 MB.` };
    const v = await probeVideo(r);
    if (!v) return { ok: false, error: "Couldn't read this video. Export it again as MP4 (H.264)." };
    if (!isH264(v.codec)) return { ok: false, error: `Video uses ${codecName(v.codec)}. Export it as H.264.` };
    if (v.durationSeconds > STORY_RULES.video.maxSeconds + 0.05)
      return { ok: false, error: `Video is ${seconds(v.durationSeconds)}. Max is 20 s.` };
    const size = checkStorySize(v.width, v.height, 'Video');
    if (size) return { ok: false, error: size };
    return { ok: true, kind: 'video', width: v.width, height: v.height, durationSeconds: v.durationSeconds };
  }

  if (r.size > STORY_RULES.image.maxBytes) return { ok: false, error: `Image is ${mb(r.size)}. Max is 10 MB.` };
  const img = await probeImage(r);
  if (!img || img.format === 'webp') return { ok: false, error: "Couldn't read this image. Use a JPG or PNG." };
  const size = checkStorySize(img.width, img.height, 'Image');
  if (size) return { ok: false, error: size };
  return { ok: true, kind: 'image', width: img.width, height: img.height, durationSeconds: null };
}

function checkStorySize(w: number, h: number, what: string): string | null {
  if (!ratioIs(w, h, 9, 16)) return `${what} is ${w} × ${h} px. Use portrait 9:16, 1080 × 1920 px.`;
  if (w < STORY_RULES.width || h < STORY_RULES.height) return `${what} is ${w} × ${h} px. Use 1080 × 1920 px.`;
  return null;
}

export type ImageCheck = { ok: true; width: number; height: number } | { ok: false; error: string };

export async function checkProductImage(r: ByteReader, type: string): Promise<ImageCheck> {
  if (!(PRODUCT_IMAGE_RULES.types as readonly string[]).includes(type)) return { ok: false, error: 'Use a JPG, PNG or WebP image.' };
  if (r.size > PRODUCT_IMAGE_RULES.maxBytes) return { ok: false, error: `Image is ${mb(r.size)}. Max is 10 MB.` };
  const img = await probeImage(r);
  if (!img) return { ok: false, error: "Couldn't read this image. Use a JPG, PNG or WebP." };
  const { width: w, height: h } = img;
  if (!ratioIs(w, h, 3, 4)) return { ok: false, error: `Image is ${w} × ${h} px. Use portrait 3:4, e.g. 1200 × 1600 px.` };
  if (w < PRODUCT_IMAGE_RULES.minWidth || h < PRODUCT_IMAGE_RULES.minHeight)
    return { ok: false, error: `Image is ${w} × ${h} px. Min is 1200 × 1600 px.` };
  return { ok: true, width: w, height: h };
}

/** Some systems leave File.type empty for .mov / .mp4: fall back to the extension. */
export function fileType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return (
    { mp4: 'video/mp4', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>
  )[ext ?? ''] ?? '';
}
