'use client';

import { useEffect, useRef, useState } from 'react';
import { PROJECT_COLORS, projectColorName, projectColorVar, type ProjectColor } from '@/lib/projectColors';

interface Props {
  color: ProjectColor | null;
  /** The project's name, for the button's label. */
  label: string;
  onChange: (color: ProjectColor | null) => void;
}

/** A swatch button that opens the project palette. Closes on choice, Escape or a click outside. */
export function ColorPicker({ color, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    // Focus the current choice so the palette is usable from the keyboard straight away.
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next: ProjectColor | null) => {
    setOpen(false);
    trigger.current?.focus();
    if (next !== color) onChange(next);
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Farge for ${label}: ${projectColorName(color)}`}
        title={projectColorName(color)}
        className="flex size-6 items-center justify-center rounded-full border border-border"
      >
        <span
          className="size-4 rounded-full"
          style={color ? { background: projectColorVar(color) } : undefined}
          data-testid="color-swatch"
          data-color={color ?? ''}
        />
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Velg farge for ${label}`}
          className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <div className="grid grid-cols-5 gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => choose(c.key)}
                aria-label={c.name}
                aria-pressed={c.key === color}
                title={c.name}
                className="size-7 rounded-full outline-offset-2 aria-pressed:outline-2 aria-pressed:outline-foreground"
                style={{ background: projectColorVar(c.key) }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose(null)}
            aria-pressed={color === null}
            className="mt-2 w-full rounded px-2 py-1 text-left text-sm text-muted hover:bg-accent-soft hover:text-foreground aria-pressed:font-medium"
          >
            Ingen farge
          </button>
        </div>
      )}
    </div>
  );
}
