import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge doesn't know the Flaym tokens from tailwind.config.ts. Without
// this, `text-body` is treated as a text colour and dropped next to `text-primary`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'heading-xl', 'heading-lg', 'body', 'caption', 'label'] }],
      'bg-image': [{ bg: ['flaym-gradient'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
