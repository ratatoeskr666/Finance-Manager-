import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-400',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800 active:bg-slate-700 disabled:text-slate-500',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-slate-700 disabled:text-slate-400',
  subtle: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
        VARIANTS[variant],
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
