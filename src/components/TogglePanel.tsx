'use client';

import { useState, type ReactNode } from 'react';

interface TogglePanelProps {
  title: string;
  description?: string;
  showLabel: string;
  hideLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function TogglePanel({
  title,
  description,
  showLabel,
  hideLabel,
  children,
  className = '',
  contentClassName = '',
}: TogglePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonLabel = isOpen ? (hideLabel ?? 'Ocultar') : showLabel;

  return (
    <section className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
        >
          {buttonLabel}
        </button>
      </div>

      {isOpen && (
        <div className={`mt-5 ${contentClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
}
