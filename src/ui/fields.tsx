import { useEffect, useState, type ReactNode } from 'react';

const fmt = (v: number) => String(Math.round(v * 10) / 10);

/** Evaluate simple arithmetic like "1200+2*300" so sizes can be typed as sums. */
function evalNum(t: string): number {
  const s = t.replace(/,/g, '.').replace(/\s+/g, '');
  if (!s) return NaN;
  if (!/^[\d+\-*/.()]+$/.test(s)) return NaN;
  try {
    const v = Function(`"use strict";return (${s})`)();
    return typeof v === 'number' && isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function NumberField({ value, onChange, unit, min, max, step = 1, disabled, title }: {
  value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number; disabled?: boolean; title?: string;
}) {
  const [text, setText] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(fmt(value));
  }, [value, focus]);
  const clampV = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = () => {
    const v = evalNum(text);
    if (isNaN(v)) return setText(fmt(value));
    const c = clampV(Math.round(v * 10) / 10);
    if (c !== value) onChange(c);
    setText(fmt(c));
  };
  return (
    <div className={`num ${disabled ? 'disabled' : ''}`} title={title}>
      <input
        value={text}
        disabled={disabled}
        inputMode="decimal"
        onFocus={(e) => {
          setFocus(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocus(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') {
            setText(fmt(value));
            setTimeout(() => (e.target as HTMLInputElement).blur());
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const cur = evalNum(text);
            const base = isNaN(cur) ? value : cur;
            const v = clampV(base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
            setText(fmt(v));
            onChange(v);
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <label className="row" title={hint}>
      <span className="row-label">{label}</span>
      <span className="row-ctl">{children}</span>
    </label>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="section">
      <header>
        <h4>{title}</h4>
        {right}
      </header>
      {children}
    </section>
  );
}

export function TextField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className={className}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onChange(text.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
