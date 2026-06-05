import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format øre to DKK display string
export function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `${kr.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`;
}

// Parse DKK string input to øre
export function parseDKKtoOre(kr: number): number {
  return Math.round(kr * 100);
}

// Format basis points to percentage string
export function formatCommission(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(0)}%`;
}

// Generate a random invitation token
export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
