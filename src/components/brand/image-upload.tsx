'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Upload, X, Loader2 } from 'lucide-react';

type ImageUploadProps = {
  bucket: string;
  folder: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  /** `flaym` = redesigned look (Flaym tokens, remove button always visible). Default keeps the old look for unredesigned portals. */
  appearance?: 'default' | 'flaym';
  /** Flaym only: show the first image as a wide cover slot (Figma "Store profile" cover image). */
  cover?: boolean;
};

export function ImageUpload({
  bucket,
  folder,
  value,
  onChange,
  max = 1,
  label = 'Upload image',
  appearance = 'default',
  cover = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');
    const supabase = createClient();
    const newUrls: string[] = [];

    try {
      // Only upload as many files as there are free slots, so nothing is uploaded and then dropped.
      const freeSlots = Math.max(0, max - value.length);
      for (const file of Array.from(files).slice(0, freeSlots)) {
        const ext = file.name.split('.').pop();
        const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, { upsert: false });

        if (uploadError) {
          setError(uploadError.message);
          continue;
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      if (newUrls.length > 0) onChange([...value, ...newUrls].slice(0, max));
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeImage(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple={max > 1}
      onChange={handleUpload}
      className="hidden"
    />
  );

  if (appearance === 'flaym') {
    const canAdd = value.length < max;
    const coverUrl = cover ? value[0] : undefined;
    const thumbs = cover ? value.slice(1) : value;
    const thumbOffset = cover ? 1 : 0;
    const removeClasses =
      'absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center bg-primary/70 text-on-primary transition-colors hover:bg-primary';

    return (
      <div className="space-y-3 font-brand">
        {cover &&
          (coverUrl ? (
            <div className="relative h-[120px] w-full overflow-hidden border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 left-2 text-label uppercase text-on-primary [text-shadow:0_0_6px_rgb(0_0_0/0.5)]">
                Cover
              </span>
              <button type="button" onClick={() => removeImage(0)} aria-label="Remove cover image" className={removeClasses}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="relative flex h-[120px] w-full items-end bg-flaym-gradient p-2 text-left disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5 text-label uppercase text-on-primary">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? 'Uploading…' : label}
              </span>
            </button>
          ))}

        {(thumbs.length > 0 || (canAdd && (!cover || coverUrl))) && (
          <div className="flex flex-wrap gap-3">
            {thumbs.map((url, i) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeImage(i + thumbOffset)} aria-label="Remove image" className={removeClasses}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {canAdd && (!cover || coverUrl) && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-20 min-w-20 flex-col items-center justify-center gap-1.5 border border-dashed border-line bg-surface px-3 text-caption text-primary transition-colors hover:border-primary disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Uploading…' : label}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-caption text-accent-strong">{error}</p>}

        {fileInput}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div key={url} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label="Remove image"
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploading…' : label}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {fileInput}
    </div>
  );
}
