import { InputHTMLAttributes } from 'react';

export function NumberInput(
  props: InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="number" step="any" {...rest} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 text-right focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors tabular-nums" />
    </label>
  );
}
