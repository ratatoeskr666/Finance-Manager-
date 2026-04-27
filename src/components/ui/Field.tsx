import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const FIELD_BASE =
  'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 ' +
  'focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30';

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[FIELD_BASE, props.className ?? ''].join(' ')} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" inputMode="decimal" {...props} className={[FIELD_BASE, props.className ?? ''].join(' ')} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[FIELD_BASE, 'pr-8', props.className ?? ''].join(' ')} />;
}
