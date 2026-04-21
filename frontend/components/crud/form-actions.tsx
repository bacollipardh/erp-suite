export function FormActions({
  submitLabel = 'Save',
  busy,
}: {
  submitLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Duke ruajtur...' : submitLabel}
      </button>
    </div>
  );
}
