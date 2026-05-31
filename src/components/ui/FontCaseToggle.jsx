import { CaseSensitive } from 'lucide-react';

/** Toggle tampilan huruf: UPPERCASE / normal (Aa) */
export default function FontCaseToggle({ value = 'uppercase', onChange, className = '' }) {
  return (
    <div
      className={`flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 ${className}`}
      title="Tampilan huruf — Uppercase / Normal"
    >
      <CaseSensitive className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" aria-hidden />
      {[
        { id: 'uppercase', label: 'AA', title: 'Uppercase — semua label huruf besar' },
        { id: 'normal', label: 'Aa', title: 'Normal — huruf sesuai asli' },
      ].map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          title={title}
          onClick={() => onChange(id)}
          className={`min-w-[2.25rem] px-2 py-1.5 text-[10px] font-black rounded-md transition-all ${
            value === id
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800 border border-transparent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const FONT_CASE_STORAGE_KEY = 'manufaktur-bom-font-case';

export function readStoredFontCase() {
  try {
    const v = localStorage.getItem(FONT_CASE_STORAGE_KEY);
    return v === 'normal' ? 'normal' : 'uppercase';
  } catch {
    return 'uppercase';
  }
}
