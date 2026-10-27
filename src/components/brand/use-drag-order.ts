'use client';

import { useState } from 'react';

// Drag to reorder (native HTML drag and drop, no library). Touch screens and
// keyboards don't get HTML drag events, so lists also show move buttons that
// call `move` directly.

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function useDragOrder<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => onReorder(moveItem(items, from, to));

  const itemProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== index) setOver(index);
    },
    onDragLeave: () => setOver((o) => (o === index ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragging ?? Number(e.dataTransfer.getData('text/plain'));
      setDragging(null);
      setOver(null);
      if (Number.isFinite(from)) move(from, index);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  return { itemProps, move, dragging, over };
}
