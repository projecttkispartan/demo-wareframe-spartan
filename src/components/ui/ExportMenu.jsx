import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';

export default function ExportMenu({ onExportExcel, onExportPdf, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = async (type, fn) => {
    if (busy || disabled) return;
    setBusy(type);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      console.error('Export gagal:', err);
      alert('Export gagal. Silakan coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || !!busy}
        onClick={() => setOpen((v) => !v)}
        className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
        title="Export laporan BOM"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-[200] min-w-[11rem] rounded-xl border border-slate-200 bg-white shadow-xl py-1 overflow-hidden">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('xlsx', onExportExcel)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-50"
          >
            {busy === 'xlsx' ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            )}
            Export Excel (.xlsx)
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('pdf', onExportPdf)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-800 transition-colors disabled:opacity-50 border-t border-slate-100"
          >
            {busy === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
            ) : (
              <FileText className="w-4 h-4 text-red-600" />
            )}
            Export PDF (.pdf)
          </button>
        </div>
      )}
    </div>
  );
}
