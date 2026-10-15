'use client';

import { useState } from 'react';
import { cn } from './cn';

export type TabItem = { value: string; label: React.ReactNode; count?: number };

type TabsProps = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `segmented` = Figma segmented control (Day / Week / Month); `underline` = page-level tabs. */
  variant?: 'segmented' | 'underline';
  className?: string;
};

export function Tabs({ items, value, defaultValue, onValueChange, variant = 'segmented', className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  if (variant === 'segmented') {
    return (
      <div role="tablist" className={cn('inline-flex border border-line bg-surface font-brand', className)}>
        {items.map((item) => {
          const on = item.value === active;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(item.value)}
              className={cn(
                'h-[31px] px-3.5 text-caption transition-colors',
                on ? 'bg-primary text-on-primary' : 'text-muted hover:text-primary'
              )}
            >
              {item.label}
              {item.count !== undefined && <span className="ml-1.5 opacity-70">{item.count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" className={cn('flex gap-6 overflow-x-auto border-b border-line font-brand', className)}>
      {items.map((item) => {
        const on = item.value === active;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => select(item.value)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 pb-2.5 text-label uppercase transition-colors',
              on ? 'border-accent text-primary' : 'border-transparent text-muted hover:text-primary'
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 text-muted">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
