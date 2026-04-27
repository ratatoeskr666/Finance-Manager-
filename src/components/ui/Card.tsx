import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...rest}
      className={['rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-lg shadow-slate-950/30', className ?? ''].join(' ')}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['border-b border-slate-800 px-4 py-3', className ?? ''].join(' ')}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['p-4', className ?? ''].join(' ')}>{children}</div>;
}
