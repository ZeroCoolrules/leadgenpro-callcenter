// Small shared building blocks for the dialer screens.
import React from 'react';

export const Card: React.FC<{ title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  actions,
  children,
  className = '',
}) => (
  <section className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 ${className}`}>
    {(title || actions) && (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {title && <h3 className="text-sm font-black uppercase tracking-wider text-white">{title}</h3>}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

type BtnKind = 'primary' | 'secondary' | 'danger' | 'success';
const BTN: Record<BtnKind, string> = {
  primary: 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400/40',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
  danger: 'bg-rose-700 hover:bg-rose-600 text-white border-rose-500/40',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean }> = ({
  kind = 'secondary',
  small,
  className = '',
  ...rest
}) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      small ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3.5 py-2'
    } ${BTN[kind]} ${className}`}
  />
);

export const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  children,
  className = '',
}) => (
  <label className={`block ${className}`}>
    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
  </label>
);

export const inputCls =
  'w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input {...rest} className={`${inputCls} ${className}`} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...rest }) => (
  <textarea {...rest} className={`${inputCls} font-mono text-[13px] leading-relaxed ${className}`} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...rest }) => (
  <select {...rest} className={`${inputCls} ${className}`} />
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }> = ({ checked, onChange, label }) => (
  <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 accent-cyan-500" />
    <span>{label}</span>
  </label>
);

const BADGE: Record<string, string> = {
  running: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  paused: 'bg-amber-950 text-amber-300 border-amber-800',
  draft: 'bg-slate-800 text-slate-300 border-slate-700',
  completed: 'bg-indigo-950 text-indigo-300 border-indigo-800',
  booked: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  confirmed: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  ai: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  human: 'bg-rose-950 text-rose-300 border-rose-800',
  ringing: 'bg-amber-950 text-amber-300 border-amber-800',
  dnc: 'bg-rose-950 text-rose-300 border-rose-800',
  cancelled: 'bg-rose-950 text-rose-300 border-rose-800',
  failed: 'bg-rose-950 text-rose-300 border-rose-800',
  reschedule_requested: 'bg-amber-950 text-amber-300 border-amber-800',
};

export const Badge: React.FC<{ value: string; label?: string }> = ({ value, label }) => (
  <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${BADGE[value] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
    {label || value.replace(/_/g, ' ')}
  </span>
);

export const Notice: React.FC<{ kind?: 'error' | 'success' | 'info' | 'warn'; children: React.ReactNode; onClose?: () => void }> = ({
  kind = 'info',
  children,
  onClose,
}) => {
  const cls = {
    error: 'bg-rose-950/80 border-rose-800 text-rose-200',
    success: 'bg-emerald-950/80 border-emerald-800 text-emerald-200',
    info: 'bg-cyan-950/60 border-cyan-900 text-cyan-100',
    warn: 'bg-amber-950/70 border-amber-800 text-amber-100',
  }[kind];
  return (
    <div className={`p-3 border rounded-xl text-xs flex items-start justify-between gap-3 ${cls}`}>
      <div className="leading-relaxed">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
};

// Runs an async action and reports errors/success through a shared message slot.
export function useAction(setMsg: (m: { kind: 'error' | 'success'; text: string } | null) => void) {
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string | ((r: any) => string)) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (success) setMsg({ kind: 'success', text: typeof success === 'function' ? success(r) : success });
      return r;
    } catch (err: any) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}
