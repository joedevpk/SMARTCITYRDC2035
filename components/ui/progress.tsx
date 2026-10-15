'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  HTMLDivElement,
  { className?: string; value?: number }
>(({ className, value = 0 }, ref) => (
  <div
    ref={ref}
    className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}
  >
    <div
      className="h-full flex-1 rounded-full bg-primary transition-all duration-500"
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    />
  </div>
));
Progress.displayName = 'Progress';

export { Progress };
