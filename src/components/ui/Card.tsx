import type { ElementType, HTMLAttributes } from 'react';

const paddingClasses = {
  default: 'p-4 sm:p-6',
  compact: 'p-4',
  none: '',
};

type CardPadding = keyof typeof paddingClasses;

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  padding?: CardPadding;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ as: Component = 'div', padding = 'default', className, ...props }: CardProps) {
  return (
    <Component
      className={cn(
        'rounded-xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        paddingClasses[padding],
        className,
      )}
      {...props}
    />
  );
}
