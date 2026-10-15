'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';

// In-app QR scanner (Figma 03). It only reads Flaym codes and then opens the
// same /p/{sampleId} or /d/{productId}?ref= URL the phone camera would, so scan
// recording and attribution happen exactly as before, on the product page.

export type ScannerState = 'starting' | 'scanning' | 'denied' | 'unsupported' | 'error';

/** Returns the in-app path for a Flaym QR, or null for anything else. */
export function flaymPathFromQR(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text, window.location.origin);
  } catch {
    return null;
  }
  const known = new Set([window.location.host, 'cirkle.dk', 'www.cirkle.dk']);
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) known.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host);
  } catch {
    /* ignore a malformed env value */
  }
  if (!known.has(url.host)) return null;
  if (!/^\/(p|d)\/[A-Za-z0-9-]+\/?$/.test(url.pathname)) return null;
  const ref = url.searchParams.get('ref');
  return url.pathname + (ref ? `?ref=${encodeURIComponent(ref)}` : '');
}

export function useQRScanner(videoRef: React.RefObject<HTMLVideoElement>) {
  const router = useRouter();
  const [state, setState] = useState<ScannerState>('starting');
  const [notFlaym, setNotFlaym] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>();
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    doneRef.current = false;
    setState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setState('scanning');

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(!!caps.torch);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let lastMiss = 0;

      const tick = () => {
        if (doneRef.current) return;
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          // Decode a downscaled frame: plenty for a QR, and cheap on phones.
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const path = flaymPathFromQR(code.data);
            if (path) {
              doneRef.current = true;
              navigator.vibrate?.(30);
              stop();
              router.push(path);
              return;
            }
            const now = Date.now();
            if (now - lastMiss > 2500) {
              lastMiss = now;
              setNotFlaym(true);
              setTimeout(() => setNotFlaym(false), 2000);
            }
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unsupported' : 'error');
    }
  }, [router, stop, videoRef]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  useEffect(() => {
    start();
    // Pause the camera while the app is in the background.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [start, stop]);

  return { state, notFlaym, retry: start, torchAvailable, torchOn, toggleTorch };
}
