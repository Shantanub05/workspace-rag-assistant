import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'green' | 'blue' | 'orange' | 'purple' | 'red';
}): React.JSX.Element {
  const tones = {
    neutral: 'bg-ink/7 text-ink',
    green: 'bg-moss/10 text-moss',
    blue: 'bg-lagoon/10 text-lagoon',
    orange: 'bg-ember/10 text-ember',
    purple: 'bg-plum/10 text-plum',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
