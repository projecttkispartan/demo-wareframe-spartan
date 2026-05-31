import { enrichRoutingSteps } from '../data/routingCatalog';
import { calcProsesCosts } from './operationCosts';

/** Satu baris kebutuhan proses — WC tunggal atau langkah routing */
export function flattenProsesLineItems(prosesEntries) {
  const lines = [];
  prosesEntries.forEach((p, opIndex) => {
    if (p.inputMode === 'routing' && p.routingSteps?.length) {
      enrichRoutingSteps(p.routingSteps).forEach((st) => {
        const biayaMesin = (st.biayaMesin || 0) + (st.biayaWc || 0);
        const biayaPekerja = st.biayaPekerja || 0;
        lines.push({
          key: `${p.nodeId ?? opIndex}-rt-${st.urutan ?? lines.length}`,
          opIndex,
          nodeKode: p.nodeKode,
          nodeNama: p.nodeNama,
          opNama: p.nama,
          inputMode: 'routing',
          stepUrutan: st.urutan,
          wcNama: st.wcNama || st.namaProses || '—',
          mfgProcess: st.mfgProcess || p.mfgProcess,
          waktu: Number(st.waktuMenit) || 0,
          person: Number(st.totalPerson) || 0,
          biayaMesin,
          biayaPekerja,
          biayaTotal: biayaMesin + biayaPekerja,
          note: st.note,
          parentOp: p,
        });
      });
    } else {
      const c = calcProsesCosts(p);
      lines.push({
        key: `${p.nodeId ?? opIndex}-wc`,
        opIndex,
        nodeKode: p.nodeKode,
        nodeNama: p.nodeNama,
        opNama: p.nama,
        inputMode: p.inputMode === 'routing' ? 'routing' : 'work_center',
        stepUrutan: null,
        wcNama: p.workCenterId || '—',
        mfgProcess: p.mfgProcess,
        waktu: c.waktu,
        person: c.person,
        biayaMesin: c.mesin + (c.wc || 0),
        biayaPekerja: c.pekerja,
        biayaTotal: c.total,
        note: p.note,
        parentOp: p,
      });
    }
  });
  return lines;
}

export function sumProsesLineItems(lines) {
  return lines.reduce(
    (acc, ln) => ({
      waktu: acc.waktu + ln.waktu,
      mesin: acc.mesin + ln.biayaMesin,
      pekerja: acc.pekerja + ln.biayaPekerja,
      total: acc.total + ln.biayaTotal,
      personMinutes: acc.personMinutes + ln.waktu * ln.person,
    }),
    { waktu: 0, mesin: 0, pekerja: 0, total: 0, personMinutes: 0 }
  );
}
