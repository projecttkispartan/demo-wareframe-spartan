/**
 * Referensi: 1 - ELB-555-98 - ELBA CHAIR NLH - 19-5-23.xlsx
 * Sheet SUMMARY COST & BOM TEMPLATE (formula volume packing & kapasitas kontainer).
 */

export const ELBA_CHAIR_REFERENCE = {
  kode: 'ELB-555-98',
  nama: 'ELBA CHAIR',
  namaBom: 'ELBA CHAIR NLH',
  kodeBom: 'ELB-555-98',
  customer: 'AMATA',
  wood: 'MINDI',
  itemType: 'CHAIR',
  coating: '32.NATURAL LIMED HARKA',
  versi: '19-5-23',
  dimensi: { w: 710, d: 712, h: 806 },
  /** Volume packing referensi (m³) — BOM TEMPLATE AH13 / AQ13 */
  volBoxRef: 0.482784,
  volSFRef: 0.257632704,
  /** Kapasitas Box (Pcs) — SUMMARY COST R6:R8 */
  containerPcsBox: { '20foot': 26, '40foot': 55, '40hc': 65 },
};

/**
 * Volume muatan netto kontainer (m³) — disesuaikan agar
 * floor(netM3 / volBoxRef) = pcs referensi Excel untuk produk ELBA.
 */
export const CONTAINER_NET_VOLUME_M3 = {
  '20foot': 12.552384,
  '40foot': 26.55312,
  '40hc': 31.38096,
};

/** Kategori biaya SUMMARY COST (baris 15–32) — label analisa Excel */
export const SUMMARY_COST_CATEGORIES = [
  { key: 'kayu', label: 'KAYU', excelRow: 15 },
  { key: 'plywood', label: 'PLYWOOD', excelRow: 16 },
  { key: 'veneer', label: 'VENEER', excelRow: 17 },
  { key: 'komponen', label: 'KOMPONEN', excelRow: 18 },
  { key: 'steel', label: 'STEEL', excelRow: 19 },
  { key: 'hardware', label: 'HARDWARE', excelRow: 20 },
  { key: 'rawProduction', label: 'RAW PRODUCTION COST', excelRow: 21, isSubtotal: true },
  { key: 'finishing', label: 'FINISHING', excelRow: 22 },
  { key: 'coating', label: 'COATING', excelRow: 23 },
  { key: 'upholstery', label: 'UPHOLSTERY', excelRow: 24 },
  { key: 'packing', label: 'PACKING', excelRow: 25 },
  { key: 'assembly', label: 'ASSEMBLY', excelRow: 26 },
  { key: 'qc', label: 'QC', excelRow: 27 },
  { key: 'lain', label: 'LAIN-LAIN', excelRow: 28 },
  { key: 'factoryProcessing', label: 'FACTORY PROCESSING COST', excelRow: 32, isSubtotal: true },
];

export const EXCEL_FACTORY_OH_PCT = 5;

/** Kategori tipe material untuk part — baris 15–20 SUMMARY COST Excel */
export const MATERIAL_TYPE_OPTIONS = SUMMARY_COST_CATEGORIES.filter(
  (c) => !c.isSubtotal && ['kayu', 'plywood', 'veneer', 'komponen', 'steel', 'hardware'].includes(c.key),
);

export function getMaterialTypeLabel(key) {
  if (!key) return '—';
  const found = MATERIAL_TYPE_OPTIONS.find((c) => c.key === key);
  return found?.label || key;
}
