import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calculator,
  FileText,
  Activity,
  DollarSign,
  CheckCircle2,
  Package,
  Wrench,
  TrendingUp,
} from 'lucide-react';
import { flattenTree } from '../../utils/treeHelpers';
import { formatIDR } from '../../utils/formatters';
import { EXCEL_FACTORY_OH_PCT } from '../../data/excelReference';
import { rollupTreeCosts, computePartsTotals, expandProsesList } from '../../utils/bomCostRollup';
import { flattenProsesLineItems, sumProsesLineItems } from '../../utils/prosesLineItems';
import OperasiDetailCell from '../ui/OperasiDetailCell';

const fmt = (val) => (val === 0 ? '—' : formatIDR(val));

function KpiCard({ label, value, sub, tone = 'slate' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/80 text-amber-800',
    indigo: 'border-indigo-200 bg-indigo-50/80 text-indigo-800',
    emerald: 'border-emerald-200 bg-emerald-50/80 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50/80 text-blue-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block">{label}</span>
      <p className="text-lg font-black mt-1 tabular-nums">Rp {fmt(value)}</p>
      {sub && <p className="text-[10px] font-medium mt-0.5 opacity-80">{sub}</p>}
    </div>
  );
}

export default function KalkulasiModal({
  isOpen,
  onClose,
  bomData,
  cogsData,
  cogsConfig,
  productInfo,
  packingCosts = {},
}) {
  const [activeTab, setActiveTab] = useState('breakdown');

  const enrichedBom = useMemo(() => {
    if (!bomData || !isOpen) return null;
    const clone = structuredClone(bomData);
    rollupTreeCosts(clone);
    return clone;
  }, [bomData, isOpen]);

  const flatNodes = useMemo(
    () => (enrichedBom ? flattenTree(enrichedBom) : []),
    [enrichedBom]
  );

  const partTotals = useMemo(
    () => (enrichedBom ? computePartsTotals(enrichedBom) : null),
    [enrichedBom]
  );

  const rootRollup = enrichedBom?._rollup;

  const stats = useMemo(
    () => ({
      modul: flatNodes.filter((n) => n.data.tipe === 'MODUL').length,
      subModul: flatNodes.filter((n) => n.data.tipe?.includes('SUBMODUL')).length,
      part: flatNodes.filter((n) => n.data.tipe === 'PART').length,
    }),
    [flatNodes]
  );

  const prosesLineItems = useMemo(() => {
    const entries = [];
    flatNodes.forEach((node) => {
      expandProsesList(node.data).forEach((p) => {
        entries.push({ ...p, nodeId: node.id, nodeNama: node.data.nama, nodeKode: node.data.kode });
      });
    });
    return flattenProsesLineItems(entries);
  }, [flatNodes]);

  const prosesLineTotals = useMemo(() => sumProsesLineItems(prosesLineItems), [prosesLineItems]);

  const packingJalur = cogsConfig?.packingJalur || 'BOX';
  const packingCost = cogsData?.packingCost ?? 0;
  const sellingFob = Math.floor((cogsData?.sellingPrice ?? 0) / 1000) * 1000;

  if (!isOpen || !enrichedBom) return null;

  const content = (
    <div className="viewport-shell viewport-shell-modal flex flex-col bg-page">
      <header className="shrink-0 bg-gradient-to-r from-brand-700 to-brand-600 text-white px-4 md:px-6 py-4 shadow-md">
        <div className="page-inner-full w-full flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-100">Kalkulasi Lengkap</p>
            <h2 className="text-lg md:text-xl font-black mt-0.5">
              {productInfo?.nama || 'Produk'} · {productInfo?.kode || '—'}
            </h2>
            <p className="text-xs text-brand-100 mt-1 opacity-90">
              Breakdown material (SF/WF), biaya proses, COGS & harga jual FOB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 flex gap-1 overflow-x-auto scroll-thin">
        {[
          { id: 'breakdown', label: 'Breakdown Biaya', icon: Calculator },
          { id: 'skenario', label: 'COGS & Rincian FOB', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 text-sm font-bold border-b-[3px] whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === id
                ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 md:p-6">
        <div className="page-inner-full w-full flex flex-col gap-5">
          {activeTab === 'breakdown' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Material (dasar)" value={partTotals?.matBase ?? 0} tone="amber" />
                <KpiCard label="Penyesuaian SF" value={partTotals?.sfAmt ?? 0} sub={`rata SF part`} tone="amber" />
                <KpiCard label="Penyesuaian WF" value={partTotals?.wfAmt ?? 0} sub="waste factor" tone="amber" />
                <KpiCard label="Material + SF/WF" value={partTotals?.matAdjusted ?? 0} tone="amber" />
                <KpiCard
                  label="Biaya Proses"
                  value={partTotals?.prosesTotal ?? 0}
                  sub={`Mesin Rp ${fmt(partTotals?.mesin)} · TK Rp ${fmt(partTotals?.pekerja)}`}
                  tone="indigo"
                />
                <KpiCard label="Biaya Produksi (Part)" value={partTotals?.biayaProduksi ?? 0} tone="blue" />
              </div>

              <div className="surface-card-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200">
                <div>
                  <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Total Rollup Hierarki</span>
                  <p className="text-xs text-slate-600 mt-0.5">Agregasi seluruh level modul → part</p>
                </div>
                <span className="text-2xl font-black text-brand-800 tabular-nums">Rp {fmt(rootRollup?.biayaProduksi ?? 0)}</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  <span className="font-black text-amber-800">Material (PART):</span> harga dasar × qty, lalu penyesuaian{' '}
                  <span className="text-amber-700 font-semibold">SF%</span> dan{' '}
                  <span className="text-red-600 font-semibold">WF%</span>.
                </p>
                <p className="mt-1">
                  <span className="font-black text-indigo-800">Proses:</span> biaya mesin (work center) + tenaga kerja dari
                  routing. Baris modul/submodul menampilkan agregasi anak.
                </p>
              </div>

              <div className="data-table-wrap max-h-[min(70vh,640px)] overflow-auto scroll-thin">
                <table className="table-compact min-w-[1280px]">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="text-center w-10 align-middle">
                        No
                      </th>
                      <th rowSpan={2} className="align-middle">
                        Kode
                      </th>
                      <th rowSpan={2} className="min-w-[180px] align-middle">
                        Nama / Hierarki
                      </th>
                      <th rowSpan={2} className="text-center align-middle">
                        Qty
                      </th>
                      <th colSpan={6} className="text-center kalkulasi-th-group--material border-b border-amber-200">
                        Material (PART)
                      </th>
                      <th colSpan={3} className="text-center kalkulasi-th-group--proses border-b border-indigo-200">
                        Biaya Proses
                      </th>
                      <th rowSpan={2} className="text-right align-middle bg-brand-50 text-brand-800">
                        Biaya Prod.
                      </th>
                    </tr>
                    <tr>
                      <th className="text-center text-amber-700">SF%</th>
                      <th className="text-center text-red-600">WF%</th>
                      <th className="text-right text-amber-800">Dasar</th>
                      <th className="text-right text-amber-600">+ SF</th>
                      <th className="text-right text-red-600">+ WF</th>
                      <th className="text-right text-amber-900">Adj.</th>
                      <th className="text-right text-indigo-700">Mesin</th>
                      <th className="text-right text-emerald-700">Pekerja</th>
                      <th className="text-right text-indigo-900">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatNodes.map((node, index) => {
                      const d = node.data;
                      const r = d._rollup || {};
                      const isPart = d.tipe === 'PART';
                      return (
                        <tr
                          key={node.id}
                          className={isPart ? 'kalkulasi-row-part' : 'kalkulasi-row-module'}
                        >
                          <td className="text-center text-slate-400 font-semibold tabular-nums">{index + 1}</td>
                          <td className="font-mono text-slate-500 text-[11px]">{d.kode || '—'}</td>
                          <td className="font-bold text-slate-800">
                            <div
                              className="flex items-center gap-2 min-w-[160px]"
                              style={{ paddingLeft: `${node.level * 12}px` }}
                            >
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                  isPart
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {d.tipe}
                              </span>
                              <span className="truncate" title={d.nama}>
                                {d.nama}
                              </span>
                            </div>
                          </td>
                          <td className="text-center tabular-nums">{d.qty ?? '—'}</td>
                          <td className="text-center text-amber-700 font-semibold">
                            {isPart ? `${r.sf ?? 0}%` : '—'}
                          </td>
                          <td className="text-center text-red-600 font-semibold">
                            {isPart ? `${r.wf ?? 0}%` : '—'}
                          </td>
                          <td className="text-right text-amber-800 tabular-nums">{fmt(r.matBase)}</td>
                          <td className="text-right text-amber-600 tabular-nums">{fmt(r.sfAmt)}</td>
                          <td className="text-right text-red-600 tabular-nums">{fmt(r.wfAmt)}</td>
                          <td className="text-right font-semibold text-amber-900 tabular-nums">{fmt(r.matAdjusted)}</td>
                          <td className="text-right text-indigo-700 tabular-nums">{fmt(r.mesin)}</td>
                          <td className="text-right text-emerald-700 tabular-nums">{fmt(r.pekerja)}</td>
                          <td className="text-right font-bold text-indigo-800 tabular-nums">{fmt(r.prosesTotal)}</td>
                          <td className="text-right font-black text-brand-800 tabular-nums bg-brand-50/50">
                            {fmt(r.biayaProduksi)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="text-right font-black uppercase text-[10px] text-slate-600 sticky bottom-0">
                        Total agregasi PART:
                      </td>
                      <td className="text-right font-black text-amber-800 tabular-nums">{fmt(partTotals?.matBase)}</td>
                      <td className="text-right font-black text-amber-600 tabular-nums">{fmt(partTotals?.sfAmt)}</td>
                      <td className="text-right font-black text-red-600 tabular-nums">{fmt(partTotals?.wfAmt)}</td>
                      <td className="text-right font-black text-amber-900 tabular-nums">{fmt(partTotals?.matAdjusted)}</td>
                      <td className="text-right font-black text-indigo-700 tabular-nums">{fmt(partTotals?.mesin)}</td>
                      <td className="text-right font-black text-emerald-700 tabular-nums">{fmt(partTotals?.pekerja)}</td>
                      <td className="text-right font-black text-indigo-900 tabular-nums">{fmt(partTotals?.prosesTotal)}</td>
                      <td className="text-right font-black text-brand-800 tabular-nums bg-brand-100">
                        {fmt(partTotals?.biayaProduksi)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="panel-card">
                <div className="panel-card-head">
                  <h3 className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-indigo-500" /> Detail Kebutuhan Proses
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 normal-case tracking-normal">
                    Satu tabel — work center tunggal atau langkah routing, biaya mesin & pekerja
                  </p>
                </div>
                <div className="data-table-wrap rounded-none border-0 border-t border-slate-100 shadow-none max-h-[min(50vh,480px)] overflow-auto scroll-thin">
                  <table className="table-compact min-w-[960px]">
                    <thead>
                      <tr>
                        <th className="text-center w-10">No</th>
                        <th className="text-left min-w-[120px]">Part / Komponen</th>
                        <th className="text-left">Operasi</th>
                        <th className="text-center w-20">Tipe</th>
                        <th className="text-left min-w-[120px]">WC / Langkah</th>
                        <th className="text-center">Durasi</th>
                        <th className="text-center">Pekerja</th>
                        <th className="text-right">Biaya WC</th>
                        <th className="text-right">Biaya TK</th>
                        <th className="text-right">Subtotal</th>
                        <th className="text-left min-w-[88px]">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prosesLineItems.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center text-slate-400 italic py-8 text-xs">
                            Belum ada operasi manufaktur terdaftar pada part BOM.
                          </td>
                        </tr>
                      ) : (
                        prosesLineItems.map((ln, i) => (
                          <tr key={ln.key} className="hover:bg-indigo-50/20">
                            <td className="text-center text-slate-400 font-semibold tabular-nums">{i + 1}</td>
                            <td>
                              <div className="font-bold text-slate-800 text-[11px] truncate max-w-[140px]" title={ln.nodeNama}>
                                {ln.nodeNama}
                              </div>
                              <div className="font-mono text-[10px] text-slate-500">{ln.nodeKode}</div>
                            </td>
                            <td className="font-bold text-slate-800 text-[11px]">{ln.opNama}</td>
                            <td className="text-center">
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  ln.inputMode === 'routing'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {ln.inputMode === 'routing' ? 'Routing' : 'WC'}
                              </span>
                            </td>
                            <td className="text-[11px] text-slate-700">
                              {ln.inputMode === 'routing' && ln.stepUrutan != null ? (
                                <span>
                                  <span className="font-bold text-indigo-600">#{ln.stepUrutan}</span> {ln.wcNama}
                                </span>
                              ) : (
                                ln.wcNama
                              )}
                            </td>
                            <td className="text-center font-bold text-blue-600 tabular-nums">{ln.waktu} mnt</td>
                            <td className="text-center font-bold text-amber-600 tabular-nums">{ln.person} org</td>
                            <td className="text-right tabular-nums text-indigo-700">Rp {fmt(ln.biayaMesin)}</td>
                            <td className="text-right tabular-nums text-emerald-700">Rp {fmt(ln.biayaPekerja)}</td>
                            <td className="text-right font-black tabular-nums text-indigo-800">Rp {fmt(ln.biayaTotal)}</td>
                            <td className="align-top">
                              {ln.inputMode === 'routing' && ln.stepUrutan === 1 ? (
                                <OperasiDetailCell operasi={ln.parentOp} operasiIndex={ln.opIndex} />
                              ) : ln.note?.trim() ? (
                                <span className="text-[10px] text-slate-500 line-clamp-2" title={ln.note}>{ln.note}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {prosesLineItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-indigo-50 font-bold">
                          <td colSpan={5} className="text-right uppercase text-[10px] text-slate-600">
                            Total kebutuhan proses:
                          </td>
                          <td className="text-center text-blue-700 tabular-nums">{prosesLineTotals.waktu} mnt</td>
                          <td className="text-center text-amber-700 tabular-nums text-[10px]">
                            {prosesLineTotals.personMinutes} org·mnt
                          </td>
                          <td className="text-right text-indigo-700 tabular-nums">Rp {fmt(prosesLineTotals.mesin)}</td>
                          <td className="text-right text-emerald-700 tabular-nums">Rp {fmt(prosesLineTotals.pekerja)}</td>
                          <td className="text-right font-black text-indigo-900 tabular-nums">Rp {fmt(prosesLineTotals.total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center pb-2">
                Modul: {stats.modul} · Submodul: {stats.subModul} · Part: {stats.part} · Baris tabel: {flatNodes.length}
              </p>
            </>
          )}

          {activeTab === 'skenario' && cogsData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Material (COGS)" value={cogsData.totalMaterial} tone="amber" />
                  <KpiCard label="Proses Pabrik" value={cogsData.totalProcess} tone="indigo" />
                  <KpiCard label={`Packing (${packingJalur})`} value={packingCost} tone="blue" />
                  <KpiCard label="Production Cost" value={cogsData.productionCost} tone="slate" />
                </div>
                <div className="surface-card-lg p-5 bg-emerald-50 border-emerald-200 flex flex-col justify-center items-center text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Harga Jual FOB</span>
                  <p className="text-2xl font-black text-emerald-800 mt-1 tabular-nums">Rp {fmt(sellingFob)}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Markup {cogsConfig?.markupPct ?? 0}% · dibulatkan ribuan</p>
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-card-head">
                  <h3 className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Pembentukan COGS (langkah demi langkah)
                  </h3>
                </div>
                <div className="data-table-wrap rounded-none border-0 shadow-none">
                  <table className="table-compact min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="w-12 text-center">#</th>
                        <th>Komponen</th>
                        <th className="text-right">Nilai (IDR)</th>
                        <th className="text-right">Running Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { step: '1', label: 'Bahan Baku & Material', desc: 'Part × Qty + SF% + WF%', val: cogsData.totalMaterial, run: cogsData.totalMaterial },
                        { step: '2', label: 'Proses Pabrik', desc: 'Mesin + tenaga kerja (routing/WC)', val: cogsData.totalProcess, run: cogsData.totalMaterial + cogsData.totalProcess },
                        {
                          step: '3',
                          label: `Packing (${packingJalur})`,
                          desc: `Mat Rp ${fmt(cogsData.packingMat)} + TK Rp ${fmt(cogsData.packingLab)}`,
                          val: packingCost,
                          run: cogsData.productionCost,
                          highlight: true,
                        },
                        { step: '—', label: 'RAW Production Cost', desc: 'Material + Proses + Packing', val: null, run: cogsData.productionCost, subtotal: true },
                        {
                          step: '4',
                          label: `Factory OH (${cogsConfig?.factoryOhPct ?? EXCEL_FACTORY_OH_PCT}%)`,
                          desc: 'Production Cost × %',
                          val: cogsData.factoryOh,
                          run: cogsData.productionCost + cogsData.factoryOh,
                        },
                        {
                          step: '5',
                          label: `Management OH (${cogsConfig?.managementOhPct ?? 0}%)`,
                          desc: 'Production Cost × %',
                          val: cogsData.managementOh,
                          run: cogsData.totalCogs,
                        },
                        { step: 'Σ', label: 'TOTAL COGS', desc: 'Sebelum markup jual', val: null, run: cogsData.totalCogs, total: true },
                      ].map((row) => (
                        <tr
                          key={row.step}
                          className={
                            row.total
                              ? 'bg-indigo-50 font-bold'
                              : row.subtotal
                                ? 'bg-slate-100 font-bold'
                                : row.highlight
                                  ? 'bg-blue-50/50'
                                  : ''
                          }
                        >
                          <td className="text-center font-black text-slate-400">{row.step}</td>
                          <td>
                            <div className="font-bold text-slate-800">{row.label}</div>
                            <div className="text-[10px] text-slate-500">{row.desc}</div>
                          </td>
                          <td className="text-right font-bold tabular-nums">
                            {row.val != null ? (row.val > 0 ? `+ Rp ${fmt(row.val)}` : 'Rp 0') : '—'}
                          </td>
                          <td className="text-right font-black text-indigo-700 tabular-nums">Rp {fmt(row.run)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="panel-card p-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" /> Rincian Packing
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-600">BOX — Material</span>
                      <span className="font-bold tabular-nums">Rp {fmt(packingCosts.boxMat ?? 0)}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-600">BOX — Tenaga</span>
                      <span className="font-bold tabular-nums">Rp {fmt(packingCosts.boxLab ?? 0)}</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-600">SF — Material</span>
                      <span className="font-bold tabular-nums">Rp {fmt(packingCosts.sfMat ?? 0)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-slate-600">SF — Tenaga</span>
                      <span className="font-bold tabular-nums">Rp {fmt(packingCosts.sfLab ?? 0)}</span>
                    </li>
                  </ul>
                  <p className="text-[10px] text-slate-400 mt-3">Jalur aktif COGS: <strong>{packingJalur}</strong></p>
                </div>

                <div className="panel-card p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Rincian Harga Jual FOB
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total COGS</span>
                      <span className="font-bold tabular-nums">Rp {fmt(cogsData.totalCogs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Markup ({cogsConfig?.markupPct ?? 0}%)</span>
                      <span className="font-bold text-emerald-600 tabular-nums">
                        + Rp {fmt(sellingFob - cogsData.totalCogs)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-emerald-200">
                      <span className="font-black text-emerald-900">Harga Jual FOB</span>
                      <span className="text-lg font-black text-emerald-800 tabular-nums">Rp {fmt(sellingFob)}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                    Struktur mengacu sheet SUMMARY COST (ELB-555-98): Production Cost + Factory OH + Management OH, lalu markup FOB.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex justify-end">
        <button type="button" onClick={onClose} className="btn-primary">
          <FileText className="w-4 h-4" /> Tutup
        </button>
      </footer>
    </div>
  );

  return createPortal(content, document.body);
}
