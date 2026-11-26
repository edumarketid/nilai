// utils.js - Fungsi Bantu Normalisasi Data, Deteksi Fase & Perhitungan Nilai
const Utils = {
  // Helper fleksibel mengambil nilai properti tanpa peduli huruf besar/kecil
  pickField(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of candidates) {
      if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
        return String(obj[key]).trim();
      }
    }
    const lowerMap = {};
    Object.keys(obj).forEach(k => { lowerMap[k.toLowerCase()] = obj[k]; });
    for (const key of candidates) {
      const val = lowerMap[key.toLowerCase()];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  },

  normalizePhone(hp) {
    if (!hp) return '';
    let s = String(hp).replace(/[^0-9]/g, '');
    if (s.startsWith('62')) s = '0' + s.slice(2);
    if (s.startsWith('8')) s = '0' + s;
    return s;
  },

  getSiswaNama(s) {
    return this.pickField(s, ['nama_siswa', 'NAMA_SISWA', 'nama_lengkap', 'NAMA_LENGKAP', 'nama', 'NAMA', 'full_name', 'student_name']);
  },

  getSiswaNISN(s) {
    return this.pickField(s, ['nisn', 'NISN', 'nis', 'NIS', 'id', 'ID']);
  },

  getSiswaNIS(s) {
    return this.pickField(s, ['nis', 'NIS', 'no_induk', 'NO_INDUK']);
  },

  getSiswaKelas(s) {
    return this.pickField(s, ['KELAS', 'kelas', 'ROMBEL', 'rombel', 'KELAS_SISWA', 'kelas_siswa']);
  },

  getGuruNama(g) {
    return this.pickField(g, ['nama_guru', 'NAMA_GURU', 'nama', 'NAMA', 'nama_lengkap', 'NAMA_LENGKAP']);
  },

  getGuruNIP(g) {
    return this.pickField(g, ['nip', 'NIP', 'nuptk', 'NUPTK']) || '-';
  },

  getGuruHP(g) {
    const raw = this.pickField(g, ['no_hp', 'NO_HP', 'hp', 'HP', 'telepon', 'TELEPON', 'no_wa', 'NO_WA', 'whatsapp', 'WHATSAPP', 'username', 'USERNAME']);
    return this.normalizePhone(raw);
  },

  getGuruMapelArray(g) {
    const raw = g.mapel ?? g.MAPEL ?? g.mata_pelajaran ?? g.MATA_PELAJARAN ?? g.mapel_diampu ?? g.MAPEL_DIAMPU ?? '';
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(x => String(x).trim()).filter(Boolean);
    return String(raw).split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  },

  getMapelKode(m) {
    return this.pickField(m, ['kode_mapel', 'KODE_MAPEL', 'kode', 'KODE', 'id', 'ID', 'nama_mapel', 'NAMA_MAPEL', 'mapel', 'MAPEL']);
  },

  getMapelNama(m) {
    return this.pickField(m, ['nama_mapel', 'NAMA_MAPEL', 'mapel', 'MAPEL', 'nama', 'NAMA', 'kode_mapel', 'KODE_MAPEL']);
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

  hitungAngkaRapor(tpArr, sasVal, persenSumatif = 50, persenSAS = 50) {
    const validTP = (tpArr || []).map(v => parseFloat(v)).filter(v => !isNaN(v));
    const hasSAS = sasVal !== '' && sasVal !== null && !isNaN(parseFloat(sasVal));
    const sasNum = hasSAS ? parseFloat(sasVal) : 0;

    if (validTP.length === 0 && !hasSAS) {
      return { rata: 0, rataStr: '-', desimal: 0, bulat: 0, raporStr: '-' };
    }

    const rata = validTP.length > 0
      ? validTP.reduce((a, b) => a + b, 0) / validTP.length
      : sasNum;

    const pSum = isNaN(parseFloat(persenSumatif)) ? 50 : parseFloat(persenSumatif);
    const pSas = isNaN(parseFloat(persenSAS)) ? 50 : parseFloat(persenSAS);
    const totalBobot = pSum + pSas;

    let desimal = rata;
    if (hasSAS && totalBobot > 0) {
      desimal = ((rata * pSum) + (sasNum * pSas)) / totalBobot;
    } else if (hasSAS) {
      desimal = (rata + sasNum) / 2;
    }

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
    let box = document.getElementById('toastBox') || document.getElementById('toastBanner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBanner';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = `no-print fixed bottom-5 right-5 z-[9999] max-w-sm text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border ${
      isError ? 'bg-rose-800 text-white border-rose-600' : 'bg-slate-900 text-white border-slate-700'
    }`;
    box.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => box.classList.add('hidden'), 3800);
  }
};
