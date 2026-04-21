export function FormActions({
  submitLabel = 'Save',
  busy,
}: {
  submitLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
      >
        {busy ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Duke ruajtur...
          </>
        ) : submitLabel}
      </button>
    </div>
  );
}
