import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatIDR } from './formatters';
import { expandProsesList } from './bomCostRollup';
import { calcProsesCosts } from './operationCosts';
import { flattenProsesLineItems, sumProsesLineItems } from './prosesLineItems';
import { getPartHierarchyLabels } from './treeHelpers';
import { getMaterialTypeLabel } from '../data/excelReference';

function safeFilename(base) {
  return String(base || 'BOM')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function sumRows(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function buildPackingPayload({
  dimensi,
  packingDimensions = [],
  packingSpec = {},
  containerCapacity = [],
  volBoxPacking,
  volSFPacking,
}) {
  const dim = dimensi || {};
  const volProduk = ((Number(dim.w) || 0) * (Number(dim.d) || 0) * (Number(dim.h) || 0)) / 1_000_000_000;

  const dimensionRows = (packingDimensions || []).map((item) => {
    const grossW = (Number(dim.w) || 0) + (Number(item.tolW) || 0);
    const grossD = (Number(dim.d) || 0) + (Number(item.tolD) || 0);
    const grossH = (Number(dim.h) || 0) + (Number(item.tolH) || 0);
    const vol = (grossW * grossD * grossH) / 1_000_000_000;
    return {
      type: item.type || '',
      grossW,
      grossD,
      grossH,
      grossDim: `${grossW} x ${grossD} x ${grossH}`,
      tolW: item.tolW ?? 0,
      tolD: item.tolD ?? 0,
      tolH: item.tolH ?? 0,
      vol: Number(vol.toFixed(6)),
      chairFactor: item.chairFactor ? 'Ya' : 'Tidak',
    };
  });

  const mapMaterial = (list, jalur) =>
    (list || []).map((m, i) => {
      const qty = Number(m.qty) || 0;
      const harga = Number(m.harga) || 0;
      return {
        no: i + 1,
        jalur,
        nama: m.nama || '',
        qty,
        unit: m.unit || '',
        harga,
        total: qty * harga,
      };
    });

  const materialRows = [
    ...mapMaterial(packingSpec.materialsBox, 'Box Karton'),
    ...mapMaterial(packingSpec.materialsSF, 'Single Face'),
  ];

  const mapRouting = (list, jalur) =>
    (list || []).map((r, i) => {
      const waktu = Number(r.waktu) || 0;
      const pekerja = Number(r.pekerja) || 0;
      const rate = Number(r.rate) || 0;
      return {
        no: i + 1,
        jalur,
        nama: r.nama || '',
        waktu,
        pekerja,
        rate,
        orgMenit: waktu * pekerja,
        total: waktu * pekerja * rate,
      };
    });

  const routingRows = [
    ...mapRouting(packingSpec.routingBox, 'Box Karton'),
    ...mapRouting(packingSpec.routingSF, 'Single Face'),
  ];

  const containerRows = (containerCapacity || [])
    .filter((c) => !c.hidden)
    .map((c, i) => ({
      no: i + 1,
      type: c.type || '',
      netCapBox: c.netCapBox ?? '',
      netCapSF: c.netCapSF ?? '',
      matCostBox: Number(c.matCostBox) || 0,
      matCostSF: Number(c.matCostSF) || 0,
      routCostBox: Number(c.routCostBox) || 0,
      routCostSF: Number(c.routCostSF) || 0,
      mgtOvBox: Number(c.mgtOvBox) || 0,
      mgtOvSF: Number(c.mgtOvSF) || 0,
      totalBox: Number(c.totalBox) || 0,
      totalSF: Number(c.totalSF) || 0,
    }));

  const totals = {
    packBoxMat: sumRows(materialRows.filter((m) => m.jalur === 'Box Karton'), 'total'),
    packSfMat: sumRows(materialRows.filter((m) => m.jalur === 'Single Face'), 'total'),
    packBoxLab: sumRows(routingRows.filter((r) => r.jalur === 'Box Karton'), 'total'),
    packSfLab: sumRows(routingRows.filter((r) => r.jalur === 'Single Face'), 'total'),
  };
  totals.packMat = totals.packBoxMat + totals.packSfMat;
  totals.packLab = totals.packBoxLab + totals.packSfLab;
  totals.packGrand = totals.packMat + totals.packLab;

  return {
    volProduk: Number(volProduk.toFixed(6)),
    volBoxPacking,
    volSFPacking,
    dimensionRows,
    materialRows,
    routingRows,
    containerRows,
    totals,
  };
}

/** Susun data export dari state editor */
export function buildBomExportPayload({
  productInfo,
  productMeta,
  dimensi,
  bomData,
  flatNodes,
  cogsData,
  cogsConfig,
  kursUsd,
  kursEur,
  volBoxPacking,
  volSFPacking,
  summaryTotals,
  materialTabTotals,
  prosesTabTotals,
  packingDimensions,
  packingSpec,
  containerCapacity,
}) {
  const prosesEntries = [];
  flatNodes.forEach((node) => {
    expandProsesList(node.data).forEach((p) => {
      prosesEntries.push({
        ...p,
        nodeId: node.id,
        nodeNama: node.data.nama,
        nodeKode: node.data.kode,
      });
    });
  });
  const prosesLines = flattenProsesLineItems(prosesEntries);
  const prosesTotals = sumProsesLineItems(prosesLines);

  const strukturRows = flatNodes.map((node, i) => {
    const d = node.data;
    let totalProcess = 0;
    expandProsesList(d).forEach((p) => {
      totalProcess += calcProsesCosts(p).total;
    });
    const hargaProduksi = (Number(d.biaya) || 0) * (Number(d.qty) || 1) + totalProcess;
    return {
      no: i + 1,
      level: node.level,
      tipe: d.tipe,
      kode: d.kode || '',
      nama: d.nama || '',
      qty: d.qty ?? '',
      dimensi: d.p && d.l && d.t ? `${d.p} x ${d.l} x ${d.t}` : '',
      vol: d.vol ?? '',
      biayaIdr: Number(d.biaya) || 0,
      biayaUsd: ((Number(d.biaya) || 0) / kursUsd).toFixed(2),
      biayaEur: ((Number(d.biaya) || 0) / kursEur).toFixed(2),
      prodIdr: hargaProduksi,
      prodUsd: (hargaProduksi / kursUsd).toFixed(2),
      prodEur: (hargaProduksi / kursEur).toFixed(2),
      sf: Number(d.sf) || 0,
      wf: Number(d.wf) || 0,
      prosesCount: d.proses?.length || d.proses_count || 0,
      catatan: d.catatan || '',
    };
  });

  const strukturTotals = {
    matIdr: sumRows(
      strukturRows.filter((r) => r.tipe === 'PART'),
      'biayaIdr',
    ),
    prodIdr: sumRows(strukturRows.filter((r) => r.tipe === 'PART'), 'prodIdr'),
  };

  const materialRows = flatNodes
    .filter((n) => n.data.tipe === 'PART')
    .map((node, i) => {
      const d = node.data;
      const hierarchy = getPartHierarchyLabels(bomData, node.id);
      const sf = Number(d.sf) || 0;
      const wf = Number(d.wf) || 0;
      const base = (Number(d.biaya) || 0) * (Number(d.qty) || 1);
      let totalProcess = 0;
      expandProsesList(d).forEach((p) => {
        totalProcess += calcProsesCosts(p).total;
      });
      const hargaBeli = Number(d.biaya) || 0;
      const matTotal = base * (1 + sf / 100 + wf / 100);
      const hargaProd = matTotal + totalProcess;
      return {
        no: i + 1,
        modul: hierarchy.modul?.nama || '',
        modulKode: hierarchy.modul?.kode || '',
        submodul: hierarchy.submodul?.nama || '',
        submodulKode: hierarchy.submodul?.kode || '',
        submodul2: hierarchy.submodul2?.nama || '',
        submodul2Kode: hierarchy.submodul2?.kode || '',
        materialType: getMaterialTypeLabel(d.materialType),
        kode: d.kode || '',
        nama: d.nama || '',
        vendor: d.vendor || '',
        sf,
        wf,
        dimensi: `${d.p || 0} x ${d.l || 0} x ${d.t || 0}`,
        vol: d.vol ?? '',
        qty: d.qty ?? '',
        unit: d.unit || 'EA',
        matIdr: hargaBeli,
        matTotalIdr: matTotal,
        matUsd: (hargaBeli / kursUsd).toFixed(2),
        matEur: (hargaBeli / kursEur).toFixed(2),
        prodIdr: hargaProd,
        prodUsd: (hargaProd / kursUsd).toFixed(2),
        prodEur: (hargaProd / kursEur).toFixed(2),
      };
    });

  const materialTotals = {
    matIdr: sumRows(materialRows, 'matIdr'),
    matTotalIdr: sumRows(materialRows, 'matTotalIdr'),
    prodIdr: sumRows(materialRows, 'prodIdr'),
    partCount: materialRows.length,
    totalQty: materialRows.reduce((s, r) => s + (Number(r.qty) || 0), 0),
  };

  const prosesRows = prosesLines.map((ln, i) => ({
    no: i + 1,
    partKode: ln.nodeKode,
    partNama: ln.nodeNama,
    operasi: ln.opNama,
    tipe: ln.inputMode === 'routing' ? 'Routing' : 'Work Center',
    tahap: ln.mfgProcess || '',
    wcLangkah: ln.stepUrutan != null ? `#${ln.stepUrutan} ${ln.wcNama}` : ln.wcNama,
    durasi: ln.waktu,
    pekerja: ln.person,
    orgMenit: ln.waktu * ln.person,
    biayaWc: ln.biayaMesin,
    biayaTk: ln.biayaPekerja,
    subtotal: ln.biayaTotal,
    detail: ln.note || '',
  }));

  const packing = buildPackingPayload({
    dimensi,
    packingDimensions,
    packingSpec,
    containerCapacity,
    volBoxPacking,
    volSFPacking,
  });

  return {
    meta: {
      filename: safeFilename(productInfo?.kode || productInfo?.namaBom || 'BOM'),
      exportedAt: new Date().toLocaleString('id-ID'),
    },
    productInfo,
    productMeta,
    dimensi,
    volBoxPacking,
    volSFPacking,
    kursUsd,
    kursEur,
    cogsData,
    cogsConfig,
    summaryTotals,
    materialTabTotals,
    prosesTabTotals,
    prosesTotals,
    strukturRows,
    strukturTotals,
    materialRows,
    materialTotals,
    prosesRows,
    packing,
  };
}

function sheetFromAoA(rows) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function appendSheet(wb, name, rows) {
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(rows), name.slice(0, 31));
}

/** Export multi-sheet Excel */
export function exportBomToExcel(payload) {
  const wb = XLSX.utils.book_new();
  const pi = payload.productInfo || {};
  const pm = payload.productMeta || {};
  const dim = payload.dimensi || {};
  const mt = payload.materialTabTotals || {};
  const pt = payload.prosesTabTotals || payload.prosesTotals || {};
  const pk = payload.packing || {};

  appendSheet(wb, 'Ringkasan', [
    ['LAPORAN BOM — MANUFAKTUR'],
    ['Diekspor', payload.meta.exportedAt],
    [],
    ['Kode Produk', pi.kode],
    ['Nama Produk', pi.nama],
    ['Varian', pi.varian],
    ['Customer', pi.customer],
    ['Kode BOM', pi.kodeBom],
    ['Nama BOM', pi.namaBom],
    ['Versi', pi.versi],
    ['Item Type', pm.itemType],
    ['Wood', pm.wood],
    ['Coating', pm.coating],
    [],
    ['Dimensi Nett W x D x H (mm)', `${dim.w} x ${dim.d} x ${dim.h}`],
    ['Volume Box (m³)', payload.volBoxPacking],
    ['Volume Single Face (m³)', payload.volSFPacking],
    ['Kurs USD', payload.kursUsd],
    ['Kurs EUR', payload.kursEur],
    [],
    ['— RINGKASAN MATERIAL —'],
    ['Total Material (SF & WF)', payload.summaryTotals?.material ?? mt.material ?? 0],
    ['Material Dasar (sebelum SF/WF)', mt.materialBase ?? 0],
    ['Jumlah Part', mt.partCount ?? payload.materialTotals?.partCount ?? 0],
    ['Total Qty Part', mt.totalQty ?? payload.materialTotals?.totalQty ?? 0],
    [],
    ['— RINGKASAN PROSES —'],
    ['Durasi (menit)', pt.waktu ?? 0],
    ['Biaya Proses (WC)', pt.mesin ?? 0],
    ['Biaya Tenaga Kerja', pt.pekerja ?? 0],
    ['Total Biaya Proses', pt.total ?? 0],
    ['Org·Menit', pt.personMinutes ?? 0],
    [],
    ['— RINGKASAN PRODUKSI & COGS —'],
    ['Total Produksi (Material + Proses)', payload.summaryTotals?.production ?? 0],
    ['Packing Material', pk.totals?.packMat ?? 0],
    ['Packing Tenaga Kerja', pk.totals?.packLab ?? 0],
    ['TOTAL COGS', payload.cogsData?.totalCogs ?? 0],
    ['Harga Jual', payload.cogsData?.sellingPrice ?? 0],
  ]);

  appendSheet(wb, 'Struktur BOM', [
    [
      'No',
      'Level',
      'Tipe',
      'Kode',
      'Nama',
      'Qty',
      'Dimensi',
      'Vol m³',
      'MAT IDR',
      'MAT USD',
      'MAT EUR',
      'PROD IDR',
      'PROD USD',
      'PROD EUR',
      'SF%',
      'WF%',
      'Proses',
      'Catatan',
    ],
    ...payload.strukturRows.map((r) => [
      r.no,
      r.level,
      r.tipe,
      r.kode,
      r.nama,
      r.qty,
      r.dimensi,
      r.vol,
      r.biayaIdr,
      r.biayaUsd,
      r.biayaEur,
      r.prodIdr,
      r.prodUsd,
      r.prodEur,
      r.sf,
      r.wf,
      r.prosesCount,
      r.catatan,
    ]),
    [],
    ['TOTAL (PART)', '', '', '', '', '', '', '', payload.strukturTotals?.matIdr ?? 0, '', '', payload.strukturTotals?.prodIdr ?? 0, '', '', '', '', '', ''],
  ]);

  appendSheet(wb, 'Kebutuhan Material', [
    [
      'No',
      'Kode Modul',
      'Modul',
      'Kode Submodul',
      'Submodul',
      'Submodul 2',
      'Tipe Material',
      'Kode',
      'Nama',
      'Vendor',
      'SF%',
      'WF%',
      'Dimensi',
      'Vol',
      'Qty',
      'Unit',
      'MAT Satuan IDR',
      'MAT Total IDR',
      'MAT USD',
      'MAT EUR',
      'PROD IDR',
      'PROD USD',
      'PROD EUR',
    ],
    ...payload.materialRows.map((r) => [
      r.no,
      r.modulKode,
      r.modul,
      r.submodulKode,
      r.submodul,
      r.submodul2,
      r.materialType,
      r.kode,
      r.nama,
      r.vendor,
      r.sf,
      r.wf,
      r.dimensi,
      r.vol,
      r.qty,
      r.unit,
      r.matIdr,
      r.matTotalIdr,
      r.matUsd,
      r.matEur,
      r.prodIdr,
      r.prodUsd,
      r.prodEur,
    ]),
    [],
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      payload.materialTotals?.totalQty ?? '',
      `${payload.materialTotals?.partCount ?? 0} part`,
      '',
      '',
      payload.materialTotals?.matTotalIdr ?? 0,
      '',
      '',
      payload.materialTotals?.prodIdr ?? 0,
      '',
      '',
    ],
  ]);

  appendSheet(wb, 'Kebutuhan Proses', [
    [
      'No',
      'Kode Part',
      'Nama Part',
      'Operasi',
      'Tipe',
      'Tahap Manufaktur',
      'WC / Langkah',
      'Durasi mnt',
      'Pekerja org',
      'Org·Menit',
      'Biaya Proses IDR',
      'Biaya TK IDR',
      'Subtotal IDR',
      'Detail',
    ],
    ...payload.prosesRows.map((r) => [
      r.no,
      r.partKode,
      r.partNama,
      r.operasi,
      r.tipe,
      r.tahap,
      r.wcLangkah,
      r.durasi,
      r.pekerja,
      r.orgMenit,
      r.biayaWc,
      r.biayaTk,
      r.subtotal,
      r.detail,
    ]),
    [],
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      payload.prosesTotals?.waktu ?? 0,
      '',
      payload.prosesTotals?.personMinutes ?? 0,
      payload.prosesTotals?.mesin ?? 0,
      payload.prosesTotals?.pekerja ?? 0,
      payload.prosesTotals?.total ?? 0,
      '',
    ],
  ]);

  appendSheet(wb, 'Packing & Kontainer', [
    ['SPESIFIKASI PACKING & KAPASITAS KONTAINER'],
    [],
    ['Dimensi Produk Nett (mm)', `${dim.w} x ${dim.d} x ${dim.h}`],
    ['Volume Produk Nett (m³)', pk.volProduk ?? ''],
    ['Volume Box Karton (m³)', pk.volBoxPacking ?? ''],
    ['Volume Single Face (m³)', pk.volSFPacking ?? ''],
    [],
    ['— DIMENSI PACKING (GROSS) —'],
    ['Tipe', 'W x D x H (mm)', 'Tol +W', 'Tol +D', 'Tol +H', 'Chair Factor', 'Volume (m³)'],
    ...pk.dimensionRows.map((r) => [
      r.type,
      r.grossDim,
      r.tolW,
      r.tolD,
      r.tolH,
      r.chairFactor,
      r.vol,
    ]),
    [],
    ['— MATERIAL PACKING —'],
    ['No', 'Jalur', 'Item Material', 'Qty', 'Unit', 'Harga IDR', 'Total IDR'],
    ...pk.materialRows.map((r) => [r.no, r.jalur, r.nama, r.qty, r.unit, r.harga, r.total]),
    [],
    ['Subtotal Material Box', pk.totals?.packBoxMat ?? 0],
    ['Subtotal Material Single Face', pk.totals?.packSfMat ?? 0],
    ['Total Material Packing', pk.totals?.packMat ?? 0],
    [],
    ['— ROUTING / PEKERJA PACKING —'],
    ['No', 'Jalur', 'Operasi', 'Waktu mnt', 'Pekerja', 'Rate/mnt', 'Org·Menit', 'Total IDR'],
    ...pk.routingRows.map((r) => [r.no, r.jalur, r.nama, r.waktu, r.pekerja, r.rate, r.orgMenit, r.total]),
    [],
    ['Subtotal Tenaga Box', pk.totals?.packBoxLab ?? 0],
    ['Subtotal Tenaga Single Face', pk.totals?.packSfLab ?? 0],
    ['Total Tenaga Packing', pk.totals?.packLab ?? 0],
    ['Grand Total Packing', pk.totals?.packGrand ?? 0],
    [],
    ['— KAPASITAS KONTAINER —'],
    [
      'No',
      'Type',
      'Net Cap Box',
      'Net Cap SF',
      'Mat Cost Box',
      'Mat Cost SF',
      'Routing Box',
      'Routing SF',
      'Mgmt OH Box',
      'Mgmt OH SF',
      'Total Box',
      'Total SF',
    ],
    ...pk.containerRows.map((r) => [
      r.no,
      r.type,
      r.netCapBox,
      r.netCapSF,
      r.matCostBox,
      r.matCostSF,
      r.routCostBox,
      r.routCostSF,
      r.mgtOvBox,
      r.mgtOvSF,
      r.totalBox,
      r.totalSF,
    ]),
  ]);

  const cd = payload.cogsData || {};
  const cc = payload.cogsConfig || {};
  appendSheet(wb, 'COGS', [
    ['PEMBENTUKAN COGS'],
    ['Packing Jalur', cc.packingJalur],
    ['Factory OH %', cc.factoryOhPct],
    ['Management OH %', cc.managementOhPct],
    ['Markup %', cc.markupPct],
    [],
    ['Komponen', 'Nilai IDR'],
    ['Material', cd.totalMaterial ?? 0],
    ['Proses Pabrik', cd.totalProcess ?? 0],
    ['Packing Material', cd.packingMat ?? 0],
    ['Packing Tenaga', cd.packingLab ?? 0],
    ['Packing Total', cd.packingCost ?? 0],
    ['Production Cost', cd.productionCost ?? 0],
    ['Factory OH', cd.factoryOh ?? 0],
    ['Management OH', cd.managementOh ?? 0],
    ['TOTAL COGS', cd.totalCogs ?? 0],
    ['Harga Jual (pre-round)', cd.sellingPrice ?? 0],
  ]);

  const fname = `${payload.meta.filename}_${stamp()}.xlsx`;
  XLSX.writeFile(wb, fname);
  return fname;
}

/** Export PDF ringkas multi-section */
export function exportBomToPdf(payload) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pi = payload.productInfo || {};
  const mt = payload.materialTabTotals || {};
  const pt = payload.prosesTabTotals || payload.prosesTotals || {};
  const margin = 14;
  let y = 16;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Laporan BOM — ${pi.nama || pi.kodeBom || 'Produk'}`, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${pi.kode} · ${pi.customer || '-'} · v${pi.versi || '-'} · Diekspor: ${payload.meta.exportedAt}`,
    margin,
    y
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Ringkasan', 'Nilai']],
    body: [
      ['Total Material', `Rp ${formatIDR(payload.summaryTotals?.material ?? mt.material ?? 0)}`],
      ['Material Dasar', `Rp ${formatIDR(mt.materialBase ?? 0)}`],
      ['Durasi Proses', `${pt.waktu ?? 0} menit`],
      ['Biaya Proses (WC)', `Rp ${formatIDR(pt.mesin ?? 0)}`],
      ['Biaya Tenaga Kerja', `Rp ${formatIDR(pt.pekerja ?? 0)}`],
      ['Total Biaya Proses', `Rp ${formatIDR(pt.total ?? 0)}`],
      ['Total Produksi', `Rp ${formatIDR(payload.summaryTotals?.production ?? 0)}`],
      ['TOTAL COGS', `Rp ${formatIDR(payload.cogsData?.totalCogs ?? 0)}`],
      ['Harga Jual', `Rp ${formatIDR(payload.cogsData?.sellingPrice ?? 0)}`],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [['Struktur BOM']],
    body: [],
    theme: 'plain',
    styles: { fontSize: 10, fontStyle: 'bold' },
  });
  y = doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Tipe', 'Kode', 'Nama', 'Qty', 'MAT IDR', 'PROD IDR']],
    body: payload.strukturRows.map((r) => [
      r.no,
      r.tipe,
      r.kode,
      r.nama,
      r.qty,
      formatIDR(r.biayaIdr),
      formatIDR(r.prodIdr),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [100, 116, 139] },
    margin: { left: margin, right: margin },
  });

  doc.addPage();
  y = 16;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Kebutuhan Material (Part)', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Modul', 'Submodul', 'Tipe Mat.', 'Kode', 'Nama', 'Qty', 'MAT Total', 'PROD IDR']],
    body: payload.materialRows.map((r) => [
      r.no,
      r.modul || '—',
      r.submodul || '—',
      r.materialType,
      r.kode,
      r.nama,
      r.qty,
      formatIDR(r.matTotalIdr),
      formatIDR(r.prodIdr),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [217, 119, 6] },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 10;
  if (y > 180) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.text('Kebutuhan Proses', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['No', 'Part', 'Operasi', 'Tahap', 'WC/Langkah', 'Mnt', 'Org', 'Org·Mnt', 'Biaya WC', 'Biaya TK', 'Subtotal']],
    body: payload.prosesRows.map((r) => [
      r.no,
      r.partNama,
      r.operasi,
      r.tahap,
      r.wcLangkah,
      r.durasi,
      r.pekerja,
      r.orgMenit,
      formatIDR(r.biayaWc),
      formatIDR(r.biayaTk),
      formatIDR(r.subtotal),
    ]),
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: margin, right: margin },
  });

  const fname = `${payload.meta.filename}_${stamp()}.pdf`;
  doc.save(fname);
  return fname;
}
