// utils.js - Fungsi Bantu Normalisasi Data, Deteksi Fase & Perhitungan Nilai
const Utils = {
  normalizePhone(hp) {
    if (!hp) return '';
    let s = String(hp).replace(/[^0-9]/g, '');
    if (s.startsWith('62')) s = '0' + s.slice(2);
    if (s.startsWith('8')) s = '0' + s;
    return s;
  },

  getSiswaNama(s) {
    return (s.nama_siswa || s.nama_lengkap || s.nama || s.full_name || s.student_name || '').trim();
  },

  getSiswaNISN(s) {
    return String(s.nisn || s.NISN || s.nis || s.NIS || s.id || '').trim();
  },

  getSiswaNIS(s) {
    return String(s.nis || s.NIS || '').trim();
  },

  getSiswaKelas(s) {
    return String(s.kelas || s.rombel || s.kelas_siswa || '').trim();
  },

  getGuruNama(g) {
    return String(g.nama_guru || g.nama || g.nama_lengkap || '').trim();
  },

  getGuruNIP(g) {
    return String(g.nip || g.NIP || '-').trim() || '-';
  },

  getGuruHP(g) {
    return this.normalizePhone(g.no_hp || g.hp || g.telepon || g.whatsapp || g.username || '');
  },

  getGuruMapelArray(g) {
    const raw = g.mapel || g.mata_pelajaran || g.mapel_diampu || '';
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(x => String(x).trim()).filter(Boolean);
    return String(raw).split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  },

  getMapelKode(m) {
    return String(m.kode_mapel || m.kode || m.id || m.nama_mapel || m.mapel || '').trim();
  },

  getMapelNama(m) {
    return String(m.nama_mapel || m.mapel || m.nama || m.kode_mapel || '').trim();
  },

  deteksiFaseKelompok(kelasStr) {
    const k = String(kelasStr || '').toUpperCase().trim();
    if (/^XII\b|^12\b/.test(k)) return 'FASE_F_XII';
    if (/^XI\b|^11\b/.test(k)) return 'FASE_F_XI';
    if (/^X\b|^10\b/.test(k)) return 'FASE_E_X';
    return 'FASE_F_XI';
  },

  getKodeFaseCetak(kelasStr) {
    return this.deteksiFaseKelompok(kelasStr) === 'FASE_E_X' ? 'E' : 'F';
  },

  getLabelFase(fk) {
    if (fk === 'FASE_E_X') return 'Fase E (Kelas X)';
    if (fk === 'FASE_F_XI') return 'Fase F (Kelas XI)';
    return 'Fase F (Kelas XII)';
  },

  hitungAngkaRapor(tpArr, sasVal) {
    const validTP = (tpArr || []).map(v => parseFloat(v)).filter(v => !isNaN(v));
    const hasSAS = sasVal !== '' && sasVal !== null && !isNaN(parseFloat(sasVal));
    const sasNum = hasSAS ? parseFloat(sasVal) : 0;

    if (validTP.length === 0 && !hasSAS) {
      return { rata: 0, rataStr: '-', desimal: 0, bulat: 0, raporStr: '-' };
    }

    const rata = validTP.length > 0
      ? validTP.reduce((a, b) => a + b, 0) / validTP.length
      : sasNum;

    const desimal = hasSAS ? (rata + sasNum) / 2 : rata;
    const bulat = Math.round(desimal);

    return {
      rata,
      rataStr: rata.toFixed(1).replace('.', ','),
      desimal,
      bulat,
      raporStr: `${bulat} (${desimal.toFixed(1).replace('.', ',')})`
    };
  },

  generateCapaianOtomatis(namaMapel, nilaiBulat) {
    if (!nilaiBulat || nilaiBulat <= 0) return '';
    if (nilaiBulat >= 90) {
      return `Menunjukkan penguasaan yang sangat baik dalam memahami, menganalisis, dan menerapkan konsep serta keterampilan pada mata pelajaran ${namaMapel}.`;
    } else if (nilaiBulat >= 80) {
      return `Menunjukkan penguasaan yang baik dalam memahami materi dan menyelesaikan tugas pada mata pelajaran ${namaMapel} dengan tepat.`;
    } else if (nilaiBulat >= 70) {
      return `Menunjukkan penguasaan yang cukup baik pada mata pelajaran ${namaMapel}, namun masih perlu latihan pendalaman pada beberapa kompetensi dasar.`;
    }
    return `Perlu bimbingan dan pendampingan lebih lanjut dalam memahami konsep dasar pada mata pelajaran ${namaMapel}.`;
  },

  showToast(msg, isError = false) {
    const box = document.getElementById('toastBox');
    if (!box) return;
    box.textContent = msg;
    box.className = `no-print fixed bottom-5 right-5 z-50 max-w-sm text-xs px-4 py-3 rounded-xl shadow-xl border ${
      isError ? 'bg-rose-900 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-700'
    }`;
    box.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => box.classList.add('hidden'), 3500);
  }
};
