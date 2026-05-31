'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

type HelpButtonProps = {
  title: string;
  children: ReactNode;
  buttonLabel?: string;
};

export default function HelpButton({ title, children, buttonLabel = 'Ayuda' }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openButtonRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:border-blue-700 dark:hover:bg-blue-900/60"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-bold">
          ?
        </span>
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xl font-semibold leading-none text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                aria-label="Cerrar ayuda"
              >
                ×
              </button>
            </div>
            <div className="mt-4 text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">
              {children}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
