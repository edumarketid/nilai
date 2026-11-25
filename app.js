// app.js - Logika Utama Aplikasi E-Rapor Kurikulum Merdeka SMKN 1 Wakatobi
const state = {
  user: null,
  siswa: [],
  guru: [],
  mapel: [],
  admin: [],
  hasilUjian: [],
  absensiHarian: [],
  raporNilai: {},
  raporWaliKelas: {},
  raporSettingMapel: {},
  raporPelengkap: {},
  jumlahTP: 3,
  kepalaSekolah: { nama: 'NUDDIN MAJIDO, S.Pd., M.Pd.', nip: '197712092005021005' }
};

function bersihkanNamaMapel(nama) {
  return String(nama || '').replace(/\s*\([^)]*\)\s*$/g, '').trim() || String(nama || '').trim();
}

// ================= SINKRONISASI & CACHE LOKAL =================
async function syncAllFromServer(notify = false) {
  const statusEl = document.getElementById('serverConnStatus');
  try {
    const src = await DBService.fetchAllSourceTables();
    state.siswa = src.siswa.filter(s => Utils.getSiswaNama(s));
    state.guru = src.guru;
    state.mapel = src.mapel;
    state.admin = src.admin;
    state.hasilUjian = src.hasilUjian;
    state.absensiHarian = src.absensiHarian;

    const kepsek = state.guru.find(g => {
      const jab = String(g.jabatan || g.JABATAN || g.tugas_tambahan || g.role || '').toLowerCase();
      return jab.includes('kepala sekolah') || jab.includes('penanggung jawab');
    });
    if (kepsek) {
      state.kepalaSekolah = { nama: Utils.getGuruNama(kepsek), nip: Utils.getGuruNIP(kepsek) };
    }

    const rData = await DBService.fetchAllRaporTables();
    state.raporNilai = {};
    rData.raporNilai.forEach(row => {
      const key = `${String(row.tahun_pelajaran || '').trim()}|${String(row.semester || '').trim()}|${String(row.kelas || '').trim()}|${String(row.nisn || '').trim()}|${String(row.kode_mapel || '').trim()}`;
      state.raporNilai[key] = row;
    });

    state.raporWaliKelas = {};
    rData.raporWaliKelas.forEach(row => {
      state.raporWaliKelas[`${String(row.tahun_pelajaran || '').trim()}|${String(row.kelas || '').trim()}`] = row;
    });

    if (rData.raporSettingMapel.length > 0) {
      state.raporSettingMapel = {};
      rData.raporSettingMapel
        .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
        .forEach(row => {
          const key = String(row.fase_key || '').trim();
          if (!state.raporSettingMapel[key]) state.raporSettingMapel[key] = [];
          state.raporSettingMapel[key].push(row);
        });
    }
    initDefaultSettingMapelPerKelas();

    state.raporPelengkap = {};
    rData.raporPelengkap.forEach(row => {
      state.raporPelengkap[`${String(row.tahun_pelajaran || '').trim()}|${String(row.semester || '').trim()}|${String(row.kelas || '').trim()}|${String(row.nisn || '').trim()}`] = row;
    });

    saveLocalCache();
    if (statusEl) {
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Terhubung ke Server (${state.siswa.length} siswa, ${state.guru.length} guru)`;
    }
    if (notify) Utils.showToast('Data berhasil disinkronkan dari Server.');
    if (state.user) {
      populateAllDropdowns();
      refreshActiveView();
    }
  } catch (err) {
    console.error(err);
    loadLocalCache();
    if (statusEl) {
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Mode Offline (Cache Lokal)`;
    }
    if (notify) Utils.showToast('Menggunakan data cache lokal.', true);
  }
}

function saveLocalCache() {
  try {
    localStorage.setItem(APP_CONFIG.CACHE_KEY, JSON.stringify({
      raporNilai: state.raporNilai,
      raporWaliKelas: state.raporWaliKelas,
      raporSettingMapel: state.raporSettingMapel,
      raporPelengkap: state.raporPelengkap
    }));
  } catch (e) {}
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.raporNilai) state.raporNilai = { ...parsed.raporNilai, ...state.raporNilai };
    if (parsed.raporWaliKelas) state.raporWaliKelas = { ...parsed.raporWaliKelas, ...state.raporWaliKelas };
    if (parsed.raporSettingMapel) state.raporSettingMapel = { ...parsed.raporSettingMapel, ...state.raporSettingMapel };
    if (parsed.raporPelengkap) state.raporPelengkap = { ...parsed.raporPelengkap, ...state.raporPelengkap };
  } catch (e) {}
}

function buildDefaultMapelArrayForKelas(kelas) {
  const fk = Utils.deteksiFaseKelompok(kelas);
  if (state.raporSettingMapel[fk] && state.raporSettingMapel[fk].length > 0) {
    return JSON.parse(JSON.stringify(state.raporSettingMapel[fk])).map((m, i) => ({
      ...m,
      fase_key: kelas,
      urutan: i + 1
    }));
  }

  const mapelCocok = getFilteredMapelForKelas(kelas);
  return mapelCocok.map((m, idx) => {
    const namaBersih = bersihkanNamaMapel(Utils.getMapelNama(m));
    const isUmum = /agama|pancasila|indonesia|jasmani|pjok|sejarah|muatan lokal|mulok|matematika|inggris|seni|informatika|ipas/i.test(namaBersih);
    return {
      fase_key: kelas,
      urutan: idx + 1,
      kelompok: isUmum ? 'A' : 'B',
      kode_mapel: Utils.getMapelKode(m),
      nama_mapel_cetak: namaBersih,
      aktif: true
    };
  });
}

function initDefaultSettingMapelPerKelas() {
  const kelasList = getUniqueKelasList();
  kelasList.forEach(kelas => {
    if (!state.raporSettingMapel[kelas] || state.raporSettingMapel[kelas].length === 0) {
      state.raporSettingMapel[kelas] = buildDefaultMapelArrayForKelas(kelas);
    }
  });
}

function getFilteredMapelForKelas(kelas) {
  const allKelasLower = getUniqueKelasList().map(k => k.toLowerCase());
  const targetLower = String(kelas || '').toLowerCase().trim();

  const filtered = state.mapel.filter(m => {
    const nama = Utils.getMapelNama(m).toLowerCase();
    const mapelKelasKolom = String(m.kelas || m.KELAS || '').toLowerCase().trim();
    if (mapelKelasKolom) return mapelKelasKolom === targetLower;

    const matchedKelasInName = allKelasLower.find(k => nama.includes(`(${k})`) || nama.endsWith(` ${k}`));
    if (matchedKelasInName) {
      return matchedKelasInName === targetLower;
    }
    return true;
  });

  return filtered.length > 0 ? filtered : state.mapel;
}

// ================= AUTENTIKASI 3 PERAN =================
function setupLoginHandlers() {
  document.getElementById('loginRole').addEventListener('change', (e) => {
    const role = e.target.value;
    const label = document.getElementById('loginUserLabel');
    const input = document.getElementById('loginUsername');
    const hint = document.getElementById('loginHint');

    if (role === 'ADMIN') {
      label.textContent = 'Username Admin';
      input.placeholder = 'Masukkan username admin';
      hint.innerHTML = 'Menggunakan kredensial dari tabel <b>admin</b> di Server.';
    } else if (role === 'WALI_KELAS') {
      label.textContent = 'Nomor HP Wali Kelas';
      input.placeholder = 'Contoh: 085298875399';
      hint.innerHTML = 'Gunakan Nomor HP yang telah ditetapkan Admin sebagai Wali Kelas (sandi <b>123456</b>).';
    } else {
      label.textContent = 'Nomor HP Guru';
      input.placeholder = 'Contoh: 085298875399';
      hint.innerHTML = 'Gunakan Nomor HP terdaftar di tabel guru dengan sandi default <b>123456</b>.';
    }
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('loginRole').value;
    const userRaw = document.getElementById('loginUsername').value.trim();
    const passRaw = document.getElementById('loginPassword').value.trim();
    const alertBox = document.getElementById('loginAlert');
    alertBox.classList.add('hidden');

    if (state.guru.length === 0 && state.admin.length === 0) {
      await syncAllFromServer(false);
    }

    if (role === 'ADMIN') {
      const foundAdmin = state.admin.find(a => {
        const u = String(a.username || a.USERNAME || a.user || a.email || '').trim().toLowerCase();
        const p = String(a.password || a.PASSWORD || a.pass || a.sandi || '').trim();
        return u === userRaw.toLowerCase() && p === passRaw;
      });
      if (!foundAdmin) {
        alertBox.textContent = 'Username atau kata sandi Admin tidak sesuai.';
        alertBox.classList.remove('hidden');
        return;
      }
      state.user = {
        role: 'ADMIN',
        nama: foundAdmin.nama || foundAdmin.NAMA || foundAdmin.nama_admin || 'Admin Kurikulum',
        nip: '-',
        no_hp: userRaw,
        mapelList: [],
        kelasBinaan: ''
      };
    } else {
      const hpInput = Utils.normalizePhone(userRaw);
      const foundGuru = state.guru.find(g => Utils.getGuruHP(g) === hpInput);
      if (!foundGuru) {
        alertBox.textContent = 'Nomor HP tidak ditemukan pada data guru di Server.';
        alertBox.classList.remove('hidden');
        return;
      }

      const validPass = String(foundGuru.password || foundGuru.PASSWORD || '123456').trim();
      if (passRaw !== validPass && passRaw !== '123456') {
        alertBox.textContent = 'Kata sandi salah. Gunakan sandi default 123456.';
        alertBox.classList.remove('hidden');
        return;
      }

      if (role === 'WALI_KELAS') {
        const tahun = document.getElementById('globalTahun').value;
        const walasEntries = Object.values(state.raporWaliKelas).filter(w =>
          w.tahun_pelajaran === tahun &&
          (Utils.normalizePhone(w.no_hp_wali_kelas) === hpInput || String(w.nama_wali_kelas).toLowerCase() === Utils.getGuruNama(foundGuru).toLowerCase())
        );

        if (walasEntries.length === 0) {
          alertBox.textContent = 'Akun Anda belum ditetapkan sebagai Wali Kelas oleh Admin pada Tahun Pelajaran ini.';
          alertBox.classList.remove('hidden');
          return;
        }

        state.user = {
          role: 'WALI_KELAS',
          nama: Utils.getGuruNama(foundGuru),
          nip: Utils.getGuruNIP(foundGuru),
          no_hp: hpInput,
          mapelList: Utils.getGuruMapelArray(foundGuru),
          kelasBinaan: walasEntries[0].kelas
        };
      } else {
        state.user = {
          role: 'GURU',
          nama: Utils.getGuruNama(foundGuru),
          nip: Utils.getGuruNIP(foundGuru),
          no_hp: hpInput,
          mapelList: Utils.getGuruMapelArray(foundGuru),
          kelasBinaan: ''
        };
      }
    }

    masukKeDashboard();
  });
}

function masukKeDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  const roleLabels = {
    GURU: 'GURU MAPEL',
    WALI_KELAS: `WALI KELAS (${state.user.kelasBinaan})`,
    ADMIN: 'ADMIN KURIKULUM'
  };
  document.getElementById('roleBadge').textContent = roleLabels[state.user.role];
  document.getElementById('userInfoSubtitle').textContent = `${state.user.nama} • ${APP_CONFIG.NAMA_SEKOLAH}`;

  buildNavigationByRole();
  populateAllDropdowns();
}

function logout() {
  state.user = null;
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
}

function buildNavigationByRole() {
  const nav = document.getElementById('navTabs');
  let tabs = [];

  if (state.user.role === 'GURU') {
    tabs = [{ id: 'nilai', label: '1. Input & Pengolahan Nilai Mapel' }];
  } else if (state.user.role === 'WALI_KELAS') {
    tabs = [
      { id: 'rekap', label: '1. Rekap Nilai Semua Mapel' },
      { id: 'pelengkap', label: '2. Data Pelengkap (PKL, Ekskul, Absensi)' },
      { id: 'cetak', label: '3. Pratinjau & Cetak Rapor F4' }
    ];
  } else if (state.user.role === 'ADMIN') {
    tabs = [
      { id: 'admin-walas', label: '1. Penetapan Wali Kelas' },
      { id: 'admin-mapel', label: '2. Susunan Mapel per Kelas' },
      { id: 'rekap', label: '3. Pantau Rekap Nilai' },
      { id: 'cetak', label: '4. Pratinjau Cetak Rapor F4' }
    ];
  }

  nav.innerHTML = tabs.map((t, idx) => `
    <button onclick="switchTab('${t.id}')" id="navbtn-${t.id}"
      class="nav-tab-btn px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${idx === 0 ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}">
      ${t.label}
    </button>
  `).join('');

  if (tabs.length > 0) switchTab(tabs[0].id);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.remove('bg-blue-600', 'text-white');
    b.classList.add('text-slate-300');
  });

  const panel = document.getElementById(`tab-${tabId}`);
  const btn = document.getElementById(`navbtn-${tabId}`);
  if (panel) panel.classList.remove('hidden');
  if (btn) {
    btn.classList.add('bg-blue-600', 'text-white');
    btn.classList.remove('text-slate-300');
  }
  refreshActiveView(tabId);
}

function refreshActiveView(activeTabId) {
  const visiblePanel = activeTabId || Array.from(document.querySelectorAll('.tab-panel')).find(p => !p.classList.contains('hidden'))?.id.replace('tab-', '');
  if (visiblePanel === 'nilai') renderTabelNilai();
  if (visiblePanel === 'rekap') renderRekapWaliKelas();
  if (visiblePanel === 'pelengkap') loadFormPelengkapSiswa();
  if (visiblePanel === 'cetak') renderPreviewRapor();
  if (visiblePanel === 'admin-walas') renderAdminWalas();
  if (visiblePanel === 'admin-mapel') renderAdminSettingMapel();
}

// ================= POPULATE DROPDOWNS =================
function getUniqueKelasList() {
  const set = new Set();
  state.siswa.forEach(s => {
    const k = Utils.getSiswaKelas(s);
    if (k) set.add(k);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
}

function updateDropdownMapelUntukKelas(kelasAktif) {
  const selMapelNilai = document.getElementById('filterMapelNilai');
  const badgesContainer = document.getElementById('mapelQuickBadges');
  if (!selMapelNilai) return;

  const prevMapelNama = bersihkanNamaMapel(selMapelNilai.options[selMapelNilai.selectedIndex]?.text || '');
  const prevMapelKode = selMapelNilai.value;
  const guruMapels = state.user?.mapelList || [];
  const mapelSesuaiKelas = getFilteredMapelForKelas(kelasAktif);

  let mapelOptions = [];
  if (state.user?.role === 'GURU' && guruMapels.length > 0) {
    guruMapels.forEach(gm => {
      const gmBersih = bersihkanNamaMapel(gm).toLowerCase();
      const match = mapelSesuaiKelas.find(m =>
        bersihkanNamaMapel(Utils.getMapelNama(m)).toLowerCase() === gmBersih ||
        Utils.getMapelNama(m).toLowerCase() === gm.toLowerCase() ||
        Utils.getMapelKode(m).toLowerCase() === gm.toLowerCase()
      );
      if (match) {
        mapelOptions.push({ kode: Utils.getMapelKode(match), nama: bersihkanNamaMapel(Utils.getMapelNama(match)) });
      } else {
        mapelOptions.push({ kode: gm, nama: bersihkanNamaMapel(gm) });
      }
    });
  } else {
    mapelOptions = mapelSesuaiKelas.map(m => ({
      kode: Utils.getMapelKode(m),
      nama: bersihkanNamaMapel(Utils.getMapelNama(m))
    }));
  }

  const seen = new Set();
  mapelOptions = mapelOptions.filter(item => {
    const k = item.nama.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  selMapelNilai.innerHTML = mapelOptions.map(m => `<option value="${m.kode}">${m.nama}</option>`).join('');

  const matchPrev = mapelOptions.find(m => m.kode === prevMapelKode || m.nama === prevMapelNama);
  if (matchPrev) {
    selMapelNilai.value = matchPrev.kode;
  }

  if (badgesContainer) {
    if (guruMapels.length > 0 && state.user?.role === 'GURU') {
      badgesContainer.innerHTML = `<span class="text-[11px] text-slate-500 py-1">Mapel Anda:</span>` +
        mapelOptions.map(m => `
          <button type="button" onclick="pilihMapelCepat('${m.kode}')"
            class="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold">
            ★ ${m.nama}
          </button>
        `).join('');
    } else {
      badgesContainer.innerHTML = '';
    }
  }
}

function populateAllDropdowns() {
  const kelasList = getUniqueKelasList();
  const selKelasNilai = document.getElementById('filterKelasNilai');
  if (selKelasNilai) {
    const prevKelas = selKelasNilai.value;
    const faseFilter = document.getElementById('filterFaseNilai')?.value || 'ALL';
    const filteredKelas = faseFilter === 'ALL'
      ? kelasList
      : kelasList.filter(k => Utils.deteksiFaseKelompok(k) === faseFilter);

    selKelasNilai.innerHTML = filteredKelas.map(k => `<option value="${k}">${k}</option>`).join('');
    if (prevKelas && filteredKelas.includes(prevKelas)) {
      selKelasNilai.value = prevKelas;
    }
    updateDropdownMapelUntukKelas(selKelasNilai.value);
  }

  const targetKelasWalas = (state.user?.role === 'WALI_KELAS' && state.user.kelasBinaan)
    ? [state.user.kelasBinaan]
    : kelasList;

  ['filterKelasRekap', 'filterKelasPelengkap', 'filterKelasCetak'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prevVal = el.value;
    el.innerHTML = targetKelasWalas.map(k => `<option value="${k}">${k}</option>`).join('');
    if (prevVal && targetKelasWalas.includes(prevVal)) el.value = prevVal;
    el.disabled = (state.user?.role === 'WALI_KELAS');
  });

  const selAdminKelasMapel = document.getElementById('adminKelasMapelSelect');
  if (selAdminKelasMapel) {
    const prevVal = selAdminKelasMapel.value;
    selAdminKelasMapel.innerHTML = kelasList.map(k => `<option value="${k}">${k}</option>`).join('');
    if (prevVal && kelasList.includes(prevVal)) selAdminKelasMapel.value = prevVal;
  }

  const selAdminMapel = document.getElementById('adminTambahMapelSelect');
  if (selAdminMapel) {
    const prevVal = selAdminMapel.value;
    selAdminMapel.innerHTML = state.mapel.map(m => `<option value="${Utils.getMapelKode(m)}">${Utils.getMapelNama(m)}</option>`).join('');
    if (prevVal) selAdminMapel.value = prevVal;
  }

  onKelasPelengkapChange();
  onKelasCetakChange();
}

function pilihMapelCepat(kode) {
  document.getElementById('filterMapelNilai').value = kode;
  renderTabelNilai();
}

function onFaseNilaiChange() {
  const faseFilter = document.getElementById('filterFaseNilai').value;
  const allKelas = getUniqueKelasList();
  const selKelas = document.getElementById('filterKelasNilai');
  const prevKelas = selKelas.value;
  const filtered = faseFilter === 'ALL' ? allKelas : allKelas.filter(k => Utils.deteksiFaseKelompok(k) === faseFilter);
  selKelas.innerHTML = filtered.map(k => `<option value="${k}">${k}</option>`).join('');
  if (prevKelas && filtered.includes(prevKelas)) selKelas.value = prevKelas;
  updateDropdownMapelUntukKelas(selKelas.value);
  renderTabelNilai();
}

// ================= TAB 1: INPUT & PENGOLAHAN NILAI GURU =================
function tambahKolomTP() {
  if (state.jumlahTP < 10) {
    state.jumlahTP++;
    renderTabelNilai();
  }
}

function hapusKolomTP() {
  if (state.jumlahTP > 1) {
    state.jumlahTP--;
    renderTabelNilai();
  }
}

function cariNilaiSASServer(siswa, kodeMapel, namaMapel) {
  const nisn = Utils.getSiswaNISN(siswa).toLowerCase();
  const nis = Utils.getSiswaNIS(siswa).toLowerCase();
  const namaS = Utils.getSiswaNama(siswa).toLowerCase();
  const km = kodeMapel.toLowerCase();
  const nm = bersihkanNamaMapel(namaMapel).toLowerCase();

  const match = state.hasilUjian.find(h => {
    const hNisn = String(h.nisn || h.NISN || h.nis || h.NIS || '').trim().toLowerCase();
    const hNama = String(h.nama_siswa || h.NAMA_SISWA || h.nama || h.NAMA || '').trim().toLowerCase();
    const hMapel = bersihkanNamaMapel(String(h.kode_mapel || h.KODE_MAPEL || h.mapel || h.MAPEL || h.nama_mapel || '')).toLowerCase();
    const siswaCocok = (nisn && hNisn === nisn) || (nis && hNisn === nis) || (namaS && hNama === namaS);
    const mapelCocok = hMapel === km || hMapel === nm || hMapel.includes(nm) || nm.includes(hMapel);
    return siswaCocok && mapelCocok;
  });

  if (!match) return '';
  const skor = match.nilai ?? match.NILAI ?? match.skor ?? match.SKOR ?? match.nilai_akhir ?? match.hasil ?? '';
  return skor !== '' && !isNaN(Number(skor)) ? Number(skor) : '';
}

function renderTabelNilai() {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const selKelas = document.getElementById('filterKelasNilai');
  const kelas = selKelas.options[selKelas.selectedIndex]?.value || selKelas.value;

  updateDropdownMapelUntukKelas(kelas);

  const selMapel = document.getElementById('filterMapelNilai');
  const kodeMapel = selMapel.value;
  const namaMapel = bersihkanNamaMapel(selMapel.options[selMapel.selectedIndex]?.text || kodeMapel);

  document.getElementById('judulTabelNilai').textContent = `Pengolahan Nilai: ${namaMapel} — Kelas ${kelas || '-'}`;

  const siswaKelas = state.siswa
    .filter(s => Utils.getSiswaKelas(s) === kelas)
    .sort((a, b) => Utils.getSiswaNama(a).localeCompare(Utils.getSiswaNama(b), 'id'));

  siswaKelas.forEach(s => {
    const saved = cariNilaiSiswaUntukMapel(tahun, semester, kelas, Utils.getSiswaNISN(s), kodeMapel, namaMapel);
    if (saved && Array.isArray(saved.nilai_sumatif) && saved.nilai_sumatif.length > state.jumlahTP) {
      state.jumlahTP = saved.nilai_sumatif.length;
    }
  });

  let tpHeaders = '';
  for (let i = 1; i <= state.jumlahTP; i++) {
    tpHeaders += `<th class="p-2.5 text-center border-r border-b border-slate-300 min-w-[78px] w-[78px]">Sumatif ${i}<br><span class="text-[10px] font-normal text-slate-500">(TP ${i})</span></th>`;
  }

  document.getElementById('theadNilai').innerHTML = `
    <tr>
      <th class="sticky-col-no p-2.5 text-center border-r border-b border-slate-300">No</th>
      <th class="sticky-col-nama p-2.5 text-left border-r border-b border-slate-300">Nama Siswa</th>
      ${tpHeaders}
      <th class="p-2.5 text-center border-r border-b border-slate-300 bg-blue-50 text-blue-900 min-w-[88px] w-[88px]">Rata-Rata<br>Sumatif</th>
      <th class="p-2.5 text-center border-r border-b border-slate-300 bg-amber-50 text-amber-900 min-w-[96px] w-[96px]">Sumatif Akhir<br>Semester (SAS)</th>
      <th class="p-2.5 text-center border-r border-b border-slate-300 bg-emerald-50 text-emerald-900 min-w-[104px] w-[104px]">Nilai Rapor</th>
      <th class="col-capaian p-2.5 text-left border-b border-slate-300">Capaian Kompetensi</th>
    </tr>
  `;

  const tbody = document.getElementById('tbodyNilai');
  if (siswaKelas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${6 + state.jumlahTP}" class="p-6 text-center text-slate-500">Tidak ada data siswa pada kelas ${kelas}.</td></tr>`;
    return;
  }

  tbody.innerHTML = siswaKelas.map((s, idx) => {
    const nisn = Utils.getSiswaNISN(s);
    const nama = Utils.getSiswaNama(s);
    const saved = cariNilaiSiswaUntukMapel(tahun, semester, kelas, nisn, kodeMapel, namaMapel) || {};
    const tpArr = Array.isArray(saved.nilai_sumatif) ? saved.nilai_sumatif : [];

    let sasVal = (saved.nilai_sas !== undefined && saved.nilai_sas !== null && saved.nilai_sas !== '')
      ? saved.nilai_sas
      : cariNilaiSASServer(s, kodeMapel, namaMapel);

    let tpInputs = '';
    for (let t = 0; t < state.jumlahTP; t++) {
      const val = tpArr[t] !== undefined && tpArr[t] !== null ? tpArr[t] : '';
      tpInputs += `
        <td class="p-1.5 text-center border-r border-b border-slate-200">
          <input type="number" min="0" max="100" step="0.1" value="${val}"
            data-nisn="${nisn}" data-tp="${t}"
            oninput="hitungBarisNilai('${nisn}')"
            class="inp-tp-${nisn} w-16 text-center border border-slate-300 rounded px-1.5 py-1 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </td>
      `;
    }

    const calc = Utils.hitungAngkaRapor(tpArr, sasVal);
    const capaianText = saved.capaian_kompetensi || (calc.bulat > 0 ? Utils.generateCapaianOtomatis(namaMapel, calc.bulat) : '');

    return `
      <tr class="hover:bg-slate-50" data-row-nisn="${nisn}" data-row-nama="${nama}">
        <td class="sticky-col-no p-2 text-center border-r border-b border-slate-200 text-slate-500">${idx + 1}</td>
        <td class="sticky-col-nama p-2 border-r border-b border-slate-200 font-semibold text-slate-800">
          <div class="truncate" title="${nama}">${nama}</div>
          <div class="text-[10px] font-normal text-slate-400">NISN: ${nisn}</div>
        </td>
        ${tpInputs}
        <td class="p-2 text-center border-r border-b border-slate-200 bg-blue-50/40 font-semibold text-blue-900" id="rata-${nisn}">
          ${calc.rataStr}
        </td>
        <td class="p-1.5 text-center border-r border-b border-slate-200 bg-amber-50/40">
          <input type="number" min="0" max="100" step="0.1" value="${sasVal}"
            id="sas-${nisn}" oninput="hitungBarisNilai('${nisn}')"
            class="w-16 text-center border border-amber-300 bg-white rounded px-1.5 py-1 text-xs font-bold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
        </td>
        <td class="p-2 text-center border-r border-b border-slate-200 bg-emerald-50/40 font-bold text-emerald-900" id="rapor-${nisn}">
          ${calc.raporStr}
        </td>
        <td class="col-capaian p-1.5 border-b border-slate-200">
          <textarea rows="2" id="capaian-${nisn}"
            class="textarea-capaian border border-slate-300 rounded px-2.5 py-1.5 text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none">${capaianText}</textarea>
        </td>
      </tr>
    `;
  }).join('');
}

function hitungBarisNilai(nisn) {
  const selMapel = document.getElementById('filterMapelNilai');
  const namaMapel = bersihkanNamaMapel(selMapel.options[selMapel.selectedIndex]?.text || '');
  const tpInputs = document.querySelectorAll(`.inp-tp-${nisn}`);
  const tpVals = Array.from(tpInputs).map(inp => inp.value);
  const sasVal = document.getElementById(`sas-${nisn}`).value;

  const calc = Utils.hitungAngkaRapor(tpVals, sasVal);
  document.getElementById(`rata-${nisn}`).textContent = calc.rataStr;
  document.getElementById(`rapor-${nisn}`).textContent = calc.raporStr;

  const capEl = document.getElementById(`capaian-${nisn}`);
  if (capEl && (!capEl.value.trim() || capEl.dataset.auto === '1') && calc.bulat > 0) {
    capEl.value = Utils.generateCapaianOtomatis(namaMapel, calc.bulat);
    capEl.dataset.auto = '1';
  }
}

async function tarikNilaiSASDariServer() {
  const selKelas = document.getElementById('filterKelasNilai');
  const kelasTerpilih = selKelas.value;
  await syncAllFromServer(false);
  if (kelasTerpilih) selKelas.value = kelasTerpilih;

  const kelas = selKelas.value;
  const selMapel = document.getElementById('filterMapelNilai');
  const kodeMapel = selMapel.value;
  const namaMapel = bersihkanNamaMapel(selMapel.options[selMapel.selectedIndex]?.text || kodeMapel);

  const siswaKelas = state.siswa.filter(s => Utils.getSiswaKelas(s) === kelas);
  let terisi = 0;

  siswaKelas.forEach(s => {
    const nisn = Utils.getSiswaNISN(s);
    const sasServer = cariNilaiSASServer(s, kodeMapel, namaMapel);
    if (sasServer !== '') {
      const inp = document.getElementById(`sas-${nisn}`);
      if (inp) {
        inp.value = sasServer;
        hitungBarisNilai(nisn);
        terisi++;
      }
    }
  });

  Utils.showToast(`Berhasil menarik ${terisi} nilai SAS kelas ${kelas} dari hasil ujian.`);
}

async function simpanNilaiMapelKeServer() {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const selKelas = document.getElementById('filterKelasNilai');
  const kelas = selKelas.options[selKelas.selectedIndex]?.value || selKelas.value;
  const selMapel = document.getElementById('filterMapelNilai');
  const kodeMapel = selMapel.value;
  const namaMapel = bersihkanNamaMapel(selMapel.options[selMapel.selectedIndex]?.text || kodeMapel);

  if (!kelas) {
    Utils.showToast('Pilih kelas terlebih dahulu sebelum menyimpan.', true);
    return;
  }

  const rows = document.querySelectorAll('#tbodyNilai tr[data-row-nisn]');
  if (rows.length === 0) {
    Utils.showToast(`Tidak ada baris siswa pada kelas ${kelas}.`, true);
    return;
  }

  const payload = [];

  rows.forEach(tr => {
    const nisn = tr.dataset.rowNisn;
    const namaSiswa = tr.dataset.rowNama;
    const tpInputs = tr.querySelectorAll(`.inp-tp-${nisn}`);
    const tpArr = Array.from(tpInputs).map(i => i.value === '' ? null : parseFloat(i.value));
    const sasRaw = document.getElementById(`sas-${nisn}`).value;
    const sasNum = sasRaw === '' ? 0 : parseFloat(sasRaw);
    const capaian = document.getElementById(`capaian-${nisn}`).value.trim();

    const calc = Utils.hitungAngkaRapor(tpArr, sasRaw);
    const key = `${tahun}|${semester}|${kelas}|${nisn}|${kodeMapel}`;

    const record = {
      tahun_pelajaran: tahun,
      semester: semester,
      kelas: kelas,
      nisn: nisn,
      nama_siswa: namaSiswa,
      kode_mapel: kodeMapel,
      nama_mapel: namaMapel,
      nilai_sumatif: tpArr,
      rata_sumatif: Number(calc.rata.toFixed(2)),
      nilai_sas: Number(sasNum.toFixed(2)),
      nilai_akhir_desimal: Number(calc.desimal.toFixed(2)),
      nilai_akhir_bulat: calc.bulat,
      capaian_kompetensi: capaian,
      guru_penginput: state.user?.nama || ''
    };

    state.raporNilai[key] = record;
    payload.push(record);
  });

  saveLocalCache();

  try {
    const { error } = await DBService.upsertRaporNilai(payload);
    if (error) throw error;
    Utils.showToast(`Tersimpan ${payload.length} nilai ${namaMapel} untuk kelas ${kelas} ke Server.`);
  } catch (err) {
    console.error('Gagal simpan nilai ke server:', err);
    Utils.showToast(`Gagal kirim ke server (${err.message || 'cek tabel rapor_nilai'}), data disimpan lokal.`, true);
  }
}

// ================= TAB 2: REKAP NILAI WALI KELAS & ADMIN =================
function getMapelSusunanByKelas(kelas) {
  if (state.raporSettingMapel[kelas] && state.raporSettingMapel[kelas].length > 0) {
    return state.raporSettingMapel[kelas].filter(m => m.aktif !== false);
  }
  const fk = Utils.deteksiFaseKelompok(kelas);
  const listFase = state.raporSettingMapel[fk] || [];
  if (listFase.length > 0) return listFase.filter(m => m.aktif !== false);

  return getFilteredMapelForKelas(kelas).map((m, i) => ({
    urutan: i + 1,
    kelompok: 'A',
    kode_mapel: Utils.getMapelKode(m),
    nama_mapel_cetak: bersihkanNamaMapel(Utils.getMapelNama(m)),
    aktif: true
  }));
}

function cariNilaiSiswaUntukMapel(tahun, semester, kelas, nisn, kodeMapel, namaMapel) {
  const tahunClean = String(tahun || '').trim();
  const semClean = String(semester || '').trim();
  const kelasClean = String(kelas || '').trim();
  const nisnClean = String(nisn || '').trim();

  // 1. Cek kecocokan persis berdasarkan kode_mapel
  const exact = state.raporNilai[`${tahunClean}|${semClean}|${kelasClean}|${nisnClean}|${kodeMapel}`];
  if (exact) return exact;

  // 2. Cari di antara semua nilai siswa pada tahun, semester, dan kelas yang sama
  const targetNamaBersih = bersihkanNamaMapel(namaMapel).toLowerCase();
  const prefix = `${tahunClean}|${semClean}|${kelasClean}|${nisnClean}|`;

  const candidates = Object.keys(state.raporNilai)
    .filter(k => k.startsWith(prefix))
    .map(k => state.raporNilai[k]);

  const byName = candidates.find(item => {
    const itemNama = bersihkanNamaMapel(item.nama_mapel || '').toLowerCase();
    return itemNama === targetNamaBersih ||
      (targetNamaBersih.length >= 6 && itemNama.includes(targetNamaBersih)) ||
      (itemNama.length >= 6 && targetNamaBersih.includes(itemNama));
  });

  return byName || null;
}

async function tarikUlangRekapDariServer() {
  const selKelas = document.getElementById('filterKelasRekap');
  const kelasAktif = selKelas ? selKelas.value : '';
  await syncAllFromServer(true);
  if (selKelas && kelasAktif) selKelas.value = kelasAktif;
  renderRekapWaliKelas();
}

function renderRekapWaliKelas() {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const kelas = document.getElementById('filterKelasRekap').value;
  const walas = state.raporWaliKelas[`${tahun}|${kelas}`];

  document.getElementById('infoWaliKelasRekap').textContent = walas?.nama_wali_kelas || 'Belum ditetapkan Admin';
  document.getElementById('infoFaseRekap').textContent = `${kelas} (${Utils.getLabelFase(Utils.deteksiFaseKelompok(kelas))})`;

  const mapelSusunan = getMapelSusunanByKelas(kelas);
  const siswaKelas = state.siswa
    .filter(s => Utils.getSiswaKelas(s) === kelas)
    .sort((a, b) => Utils.getSiswaNama(a).localeCompare(Utils.getSiswaNama(b), 'id'));

  document.getElementById('theadRekap').innerHTML = `
    <tr>
      <th class="p-2.5 text-center border-r border-slate-300 w-10">No</th>
      <th class="p-2.5 text-left border-r border-slate-300 min-w-[180px]">Nama Peserta Didik</th>
      ${mapelSusunan.map((m, idx) => `
        <th class="p-2 text-center border-r border-slate-300 min-w-[90px]" title="${m.nama_mapel_cetak}">
          ${idx + 1}. ${m.nama_mapel_cetak}
        </th>
      `).join('')}
      <th class="p-2.5 text-center bg-blue-50 text-blue-900 min-w-[85px]">Rata-Rata</th>
    </tr>
  `;

  document.getElementById('tbodyRekap').innerHTML = siswaKelas.map((s, idx) => {
    const nisn = Utils.getSiswaNISN(s);
    let sum = 0;
    let count = 0;

    const cells = mapelSusunan.map(m => {
      const nObj = cariNilaiSiswaUntukMapel(tahun, semester, kelas, nisn, m.kode_mapel, m.nama_mapel_cetak);
      const val = nObj?.nilai_akhir_bulat || 0;
      if (val > 0) {
        sum += val;
        count++;
      }
      return `<td class="p-2 text-center border-r border-slate-200 font-semibold ${val > 0 ? 'text-slate-800' : 'text-rose-400'}">${val > 0 ? val : '-'}</td>`;
    }).join('');

    const avg = count > 0 ? (sum / count).toFixed(1).replace('.', ',') : '-';
    return `
      <tr class="hover:bg-slate-50">
        <td class="p-2 text-center border-r border-slate-200">${idx + 1}</td>
        <td class="p-2 border-r border-slate-200 font-semibold text-slate-800">${Utils.getSiswaNama(s)}</td>
        ${cells}
        <td class="p-2 text-center bg-blue-50/50 font-bold text-blue-900">${avg}</td>
      </tr>
    `;
  }).join('');
}

function exportLegerCSV() {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const kelas = document.getElementById('filterKelasRekap').value;
  const mapelSusunan = getMapelSusunanByKelas(kelas);
  const siswaKelas = state.siswa.filter(s => Utils.getSiswaKelas(s) === kelas);

  const headers = ['No', 'NISN', 'Nama Siswa', ...mapelSusunan.map(m => m.nama_mapel_cetak)];
  const lines = [headers.join(';')];

  siswaKelas.forEach((s, idx) => {
    const nisn = Utils.getSiswaNISN(s);
    const vals = mapelSusunan.map(m => {
      const nObj = cariNilaiSiswaUntukMapel(tahun, semester, kelas, nisn, m.kode_mapel, m.nama_mapel_cetak);
      return nObj?.nilai_akhir_bulat || '';
    });
    lines.push([idx + 1, nisn, `"${Utils.getSiswaNama(s)}"`, ...vals].join(';'));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Leger_Nilai_${kelas.replace(/\s+/g, '_')}_${semester}_${tahun.replace('/', '-')}.csv`;
  link.click();
}

// ================= TAB 3: DATA PELENGKAP RAPOR =================
function onKelasPelengkapChange() {
  const elKelas = document.getElementById('filterKelasPelengkap');
  if (!elKelas) return;
  const kelas = elKelas.value;
  const siswaKelas = state.siswa
    .filter(s => Utils.getSiswaKelas(s) === kelas)
    .sort((a, b) => Utils.getSiswaNama(a).localeCompare(Utils.getSiswaNama(b), 'id'));

  const elSiswa = document.getElementById('filterSiswaPelengkap');
  if (elSiswa) {
    elSiswa.innerHTML = siswaKelas
      .map(s => `<option value="${Utils.getSiswaNISN(s)}">${Utils.getSiswaNama(s)} (${Utils.getSiswaNISN(s)})</option>`)
      .join('');
  }
  loadFormPelengkapSiswa();
}

function hitungAbsensiDariServer(siswa) {
  const nisn = Utils.getSiswaNISN(siswa).toLowerCase();
  const nis = Utils.getSiswaNIS(siswa).toLowerCase();
  const namaS = Utils.getSiswaNama(siswa).toLowerCase();
  let sakit = 0, izin = 0, alpa = 0;

  state.absensiHarian.forEach(row => {
    const rNisn = String(row.nisn || row.NISN || row.nis || row.NIS || '').trim().toLowerCase();
    const rNama = String(row.nama_siswa || row.NAMA_SISWA || row.nama || row.NAMA || '').trim().toLowerCase();
    const cocok = (nisn && rNisn === nisn) || (nis && rNisn === nis) || (namaS && rNama === namaS);
    if (!cocok) return;

    const rawStatus = row.STATUS_AKHIR ?? row.status_akhir ?? row.status ?? row.keterangan ?? row.kehadiran ?? '';
    const st = String(rawStatus).trim().toLowerCase();

    if (st === 'sakit' || st === 's') sakit++;
    else if (st === 'izin' || st === 'i') izin++;
    else if (st === 'alpa' || st === 'alpha' || st === 'a' || st === 'tanpa keterangan') alpa++;
  });

  return { sakit, izin, alpa };
}

function loadFormPelengkapSiswa() {
  const tahun = document.getElementById('globalTahun')?.value;
  const semester = document.getElementById('globalSemester')?.value;
  const kelas = document.getElementById('filterKelasPelengkap')?.value;
  const nisn = document.getElementById('filterSiswaPelengkap')?.value;
  if (!nisn) return;

  const saved = state.raporPelengkap[`${tahun}|${semester}|${kelas}|${nisn}`];
  const siswaObj = state.siswa.find(s => Utils.getSiswaNISN(s) === nisn);

  renderListPKL(saved?.data_pkl?.length ? saved.data_pkl : [{ mitra: '', lokasi: '', lamanya: '', keterangan: '' }]);
  renderListEkskul(saved?.data_ekskul?.length ? saved.data_ekskul : [{ kegiatan: '', keterangan: '' }]);

  if (saved) {
    document.getElementById('inputSakit').value = saved.sakit ?? 0;
    document.getElementById('inputIzin').value = saved.izin ?? 0;
    document.getElementById('inputAlpa').value = saved.tanpa_keterangan ?? 0;
    if (saved.tanggal_cetak) document.getElementById('inputTanggalCetak').value = saved.tanggal_cetak;
  } else if (siswaObj) {
    const abs = hitungAbsensiDariServer(siswaObj);
    document.getElementById('inputSakit').value = abs.sakit;
    document.getElementById('inputIzin').value = abs.izin;
    document.getElementById('inputAlpa').value = abs.alpa;
  }
}

function hitungUlangAbsensiSiswa() {
  const nisn = document.getElementById('filterSiswaPelengkap').value;
  const siswaObj = state.siswa.find(s => Utils.getSiswaNISN(s) === nisn);
  if (!siswaObj) return;
  const abs = hitungAbsensiDariServer(siswaObj);
  document.getElementById('inputSakit').value = abs.sakit;
  document.getElementById('inputIzin').value = abs.izin;
  document.getElementById('inputAlpa').value = abs.alpa;
  Utils.showToast('Rekap ketidakhadiran diperbarui dari tabel absensi_harian (STATUS_AKHIR).');
}

function renderListPKL(list) {
  document.getElementById('listPKLContainer').innerHTML = list.map(item => `
    <div class="pkl-item grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
      <input type="text" placeholder="Mitra DU/DI" value="${item.mitra || ''}" class="pkl-mitra border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <input type="text" placeholder="Lokasi" value="${item.lokasi || ''}" class="pkl-lokasi border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <input type="text" placeholder="Lamanya" value="${item.lamanya || ''}" class="pkl-lamanya border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <div class="flex gap-1">
        <input type="text" placeholder="Keterangan" value="${item.keterangan || ''}" class="pkl-ket w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
        <button type="button" onclick="this.closest('.pkl-item').remove()" class="px-2 text-rose-600 font-bold">×</button>
      </div>
    </div>
  `).join('');
}

function tambahBarisPKL() {
  const div = document.createElement('div');
  div.className = 'pkl-item grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200';
  div.innerHTML = `
    <input type="text" placeholder="Mitra DU/DI" class="pkl-mitra border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
    <input type="text" placeholder="Lokasi" class="pkl-lokasi border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
    <input type="text" placeholder="Lamanya" class="pkl-lamanya border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
    <div class="flex gap-1">
      <input type="text" placeholder="Keterangan" class="pkl-ket w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <button type="button" onclick="this.closest('.pkl-item').remove()" class="px-2 text-rose-600 font-bold">×</button>
    </div>
  `;
  document.getElementById('listPKLContainer').appendChild(div);
}

function renderListEkskul(list) {
  document.getElementById('listEkskulContainer').innerHTML = list.map(item => `
    <div class="ekskul-item grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
      <input type="text" placeholder="Kegiatan Ekstrakurikuler" value="${item.kegiatan || ''}" class="eks-nama border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <div class="flex gap-1">
        <input type="text" placeholder="Keterangan" value="${item.keterangan || ''}" class="eks-ket w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
        <button type="button" onclick="this.closest('.ekskul-item').remove()" class="px-2 text-rose-600 font-bold">×</button>
      </div>
    </div>
  `).join('');
}

function tambahBarisEkskul() {
  const div = document.createElement('div');
  div.className = 'ekskul-item grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200';
  div.innerHTML = `
    <input type="text" placeholder="Kegiatan Ekstrakurikuler" class="eks-nama border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
    <div class="flex gap-1">
      <input type="text" placeholder="Keterangan" class="eks-ket w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white" />
      <button type="button" onclick="this.closest('.ekskul-item').remove()" class="px-2 text-rose-600 font-bold">×</button>
    </div>
  `;
  document.getElementById('listEkskulContainer').appendChild(div);
}

async function simpanPelengkapKeServer() {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const kelas = document.getElementById('filterKelasPelengkap').value;
  const nisn = document.getElementById('filterSiswaPelengkap').value;
  if (!nisn) return;

  const dataPkl = Array.from(document.querySelectorAll('.pkl-item')).map(el => ({
    mitra: el.querySelector('.pkl-mitra').value.trim(),
    lokasi: el.querySelector('.pkl-lokasi').value.trim(),
    lamanya: el.querySelector('.pkl-lamanya').value.trim(),
    keterangan: el.querySelector('.pkl-ket').value.trim()
  })).filter(x => x.mitra || x.lokasi || x.lamanya);

  const dataEkskul = Array.from(document.querySelectorAll('.ekskul-item')).map(el => ({
    kegiatan: el.querySelector('.eks-nama').value.trim(),
    keterangan: el.querySelector('.eks-ket').value.trim()
  })).filter(x => x.kegiatan);

  const record = {
    tahun_pelajaran: tahun,
    semester: semester,
    kelas: kelas,
    nisn: nisn,
    data_pkl: dataPkl,
    data_ekskul: dataEkskul,
    sakit: parseInt(document.getElementById('inputSakit').value || '0', 10),
    izin: parseInt(document.getElementById('inputIzin').value || '0', 10),
    tanpa_keterangan: parseInt(document.getElementById('inputAlpa').value || '0', 10),
    tanggal_cetak: document.getElementById('inputTanggalCetak').value.trim()
  };

  state.raporPelengkap[`${tahun}|${semester}|${kelas}|${nisn}`] = record;
  saveLocalCache();

  try {
    const { error } = await DBService.upsertPelengkap(record);
    if (error) throw error;
    Utils.showToast('Data pelengkap rapor berhasil disimpan ke Server.');
  } catch (err) {
    Utils.showToast('Data pelengkap tersimpan di perangkat lokal.', true);
  }
}

// ================= TAB 4: PRATINJAU & CETAK RAPOR F4 =================
function onKelasCetakChange() {
  const elKelas = document.getElementById('filterKelasCetak');
  if (!elKelas) return;
  const kelas = elKelas.value;
  const siswaKelas = state.siswa
    .filter(s => Utils.getSiswaKelas(s) === kelas)
    .sort((a, b) => Utils.getSiswaNama(a).localeCompare(Utils.getSiswaNama(b), 'id'));

  const elSiswa = document.getElementById('filterSiswaCetak');
  if (elSiswa) {
    elSiswa.innerHTML = siswaKelas
      .map(s => `<option value="${Utils.getSiswaNISN(s)}">${Utils.getSiswaNama(s)} (${Utils.getSiswaNISN(s)})</option>`)
      .join('');
  }
  renderPreviewRapor();
}

function getPrintContextForSiswa(siswa) {
  const tahun = document.getElementById('globalTahun').value;
  const semester = document.getElementById('globalSemester').value;
  const kelas = Utils.getSiswaKelas(siswa);
  const nisn = Utils.getSiswaNISN(siswa);
  const pelengkap = state.raporPelengkap[`${tahun}|${semester}|${kelas}|${nisn}`];
  const absAuto = pelengkap ? {
    sakit: pelengkap.sakit ?? 0,
    izin: pelengkap.izin ?? 0,
    alpa: pelengkap.tanpa_keterangan ?? 0
  } : hitungAbsensiDariServer(siswa);

  return {
    tahun,
    semester,
    alamatSekolah: document.getElementById('inputAlamatSekolah')?.value || APP_CONFIG.ALAMAT_DEFAULT,
    mapelSusunan: getMapelSusunanByKelas(kelas),
    pelengkap,
    absAuto,
    walasObj: state.raporWaliKelas[`${tahun}|${kelas}`],
    kepalaSekolah: state.kepalaSekolah,
    tglCetakDefault: document.getElementById('inputTanggalCetak')?.value || 'Wakatobi, 20 Desember 2026',
    getNilaiFn: cariNilaiSiswaUntukMapel
  };
}

function renderPreviewRapor() {
  const nisn = document.getElementById('filterSiswaCetak')?.value;
  const siswa = state.siswa.find(s => Utils.getSiswaNISN(s) === nisn);
  const container = document.getElementById('printAreaContainer');
  if (!container) return;

  if (!siswa) {
    container.innerHTML = `<div class="bg-white p-8 rounded-xl text-center text-slate-500">Pilih peserta didik untuk melihat pratinjau rapor F4.</div>`;
    return;
  }

  container.innerHTML = RaporPrinter.buildRaporDuaHalamanHTML(siswa, getPrintContextForSiswa(siswa));
}

function cetakSatuSiswa() {
  renderPreviewRapor();
  setTimeout(() => window.print(), 150);
}

function cetakSemuaSatuKelas() {
  const kelas = document.getElementById('filterKelasCetak').value;
  const siswaKelas = state.siswa
    .filter(s => Utils.getSiswaKelas(s) === kelas)
    .sort((a, b) => Utils.getSiswaNama(a).localeCompare(Utils.getSiswaNama(b), 'id'));

  if (siswaKelas.length === 0) return;
  const container = document.getElementById('printAreaContainer');
  container.innerHTML = siswaKelas.map(s => RaporPrinter.buildRaporDuaHalamanHTML(s, getPrintContextForSiswa(s))).join('');
  setTimeout(() => {
    window.print();
    renderPreviewRapor();
  }, 250);
}

// ================= TAB 5: ADMIN - PENETAPAN WALI KELAS =================
function renderAdminWalas() {
  const tahun = document.getElementById('globalTahun').value;
  const kelasList = getUniqueKelasList();
  const tbody = document.getElementById('tbodyAdminWalas');

  tbody.innerHTML = kelasList.map((kelas, idx) => {
    const jmlSiswa = state.siswa.filter(s => Utils.getSiswaKelas(s) === kelas).length;
    const saved = state.raporWaliKelas[`${tahun}|${kelas}`];
    const fk = Utils.deteksiFaseKelompok(kelas);

    const guruOpts = `<option value="">-- Pilih Wali Kelas --</option>` +
      state.guru.map(g => {
        const nama = Utils.getGuruNama(g);
        const hp = Utils.getGuruHP(g);
        const nip = Utils.getGuruNIP(g);
        const selected = saved && (saved.nama_wali_kelas === nama || Utils.normalizePhone(saved.no_hp_wali_kelas) === hp) ? 'selected' : '';
        return `<option value="${nama}|${nip}|${hp}" ${selected}>${nama} (${hp || 'Tanpa HP'})</option>`;
      }).join('');

    return `
      <tr class="hover:bg-slate-50" data-walas-kelas="${kelas}">
        <td class="p-2.5 text-center">${idx + 1}</td>
        <td class="p-2.5 font-bold text-slate-800">${kelas}</td>
        <td class="p-2.5 text-slate-600">${Utils.getLabelFase(fk)}</td>
        <td class="p-2.5 text-center">${jmlSiswa} siswa</td>
        <td class="p-2.5">
          <select onchange="onSelectWalasRow(this)" class="sel-walas w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white">
            ${guruOpts}
          </select>
        </td>
        <td class="p-2.5 text-slate-500 hp-walas-cell">${saved?.no_hp_wali_kelas || '-'}</td>
      </tr>
    `;
  }).join('');
}

function onSelectWalasRow(selectEl) {
  const val = selectEl.value;
  const hpCell = selectEl.closest('tr').querySelector('.hp-walas-cell');
  hpCell.textContent = val ? (val.split('|')[2] || '-') : '-';
}

async function simpanWaliKelasKeServer() {
  const tahun = document.getElementById('globalTahun').value;
  const rows = document.querySelectorAll('#tbodyAdminWalas tr[data-walas-kelas]');
  const payload = [];

  rows.forEach(tr => {
    const kelas = tr.dataset.walasKelas;
    const val = tr.querySelector('.sel-walas').value;
    if (!val) return;
    const [nama, nip, hp] = val.split('|');

    const record = {
      tahun_pelajaran: tahun,
      kelas: kelas,
      nama_wali_kelas: nama,
      nip_wali_kelas: nip || '-',
      no_hp_wali_kelas: hp || ''
    };
    state.raporWaliKelas[`${tahun}|${kelas}`] = record;
    payload.push(record);
  });

  saveLocalCache();

  try {
    if (payload.length > 0) {
      const { error } = await DBService.upsertWaliKelas(payload);
      if (error) throw error;
    }
    Utils.showToast('Penetapan Wali Kelas berhasil disimpan ke Server.');
  } catch (err) {
    Utils.showToast('Penetapan Wali Kelas tersimpan di cache lokal.', true);
  }
}

// ================= TAB 6: ADMIN - SUSUNAN MAPEL PER KELAS (X TKJ, X TKR, DLL) =================
function renderAdminSettingMapel() {
  const kelas = document.getElementById('adminKelasMapelSelect')?.value;
  const tbody = document.getElementById('tbodyAdminMapel');
  if (!kelas) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Data kelas dari tabel siswa belum tersedia.</td></tr>`;
    return;
  }

  if (!state.raporSettingMapel[kelas] || state.raporSettingMapel[kelas].length === 0) {
    state.raporSettingMapel[kelas] = buildDefaultMapelArrayForKelas(kelas);
  }

  const fk = Utils.deteksiFaseKelompok(kelas);
  const judulEl = document.getElementById('judulSettingMapelKelas');
  const badgeEl = document.getElementById('badgeFaseSettingMapel');
  if (judulEl) judulEl.textContent = `Urutan & Pengelompokan Mata Pelajaran Rapor — Kelas ${kelas}`;
  if (badgeEl) badgeEl.textContent = Utils.getLabelFase(fk);

  const list = state.raporSettingMapel[kelas];
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada mata pelajaran untuk kelas ${kelas}.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr class="hover:bg-slate-50">
      <td class="p-2.5 text-center font-bold">${idx + 1}</td>
      <td class="p-2.5">
        <select onchange="ubahKelompokMapelKelas('${kelas}', ${idx}, this.value)" class="border border-slate-300 rounded px-2 py-1 text-xs bg-white w-full">
          <option value="A" ${item.kelompok === 'A' ? 'selected' : ''}>A. Kelompok Umum</option>
          <option value="B" ${item.kelompok === 'B' ? 'selected' : ''}>B. Kelompok Kejuruan</option>
        </select>
      </td>
      <td class="p-2.5 text-slate-500">${item.kode_mapel}</td>
      <td class="p-2.5">
        <input type="text" value="${item.nama_mapel_cetak}" onchange="ubahNamaCetakMapelKelas('${kelas}', ${idx}, this.value)"
          class="w-full border border-slate-300 rounded px-2.5 py-1 text-xs font-medium" />
      </td>
      <td class="p-2.5 text-center space-x-1">
        <button type="button" onclick="geserUrutanMapel('${kelas}', ${idx}, -1)" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded font-bold">↑</button>
        <button type="button" onclick="geserUrutanMapel('${kelas}', ${idx}, 1)" class="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded font-bold">↓</button>
        <button type="button" onclick="hapusMapelDariKelas('${kelas}', ${idx})" class="px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded font-bold">×</button>
      </td>
    </tr>
  `).join('');
}

function tambahMapelKeKelas() {
  const kelas = document.getElementById('adminKelasMapelSelect').value;
  if (!kelas) return;
  const sel = document.getElementById('adminTambahMapelSelect');
  const kode = sel.value;
  const namaRaw = sel.options[sel.selectedIndex]?.text || kode;
  const namaBersih = bersihkanNamaMapel(namaRaw);

  const list = state.raporSettingMapel[kelas] || [];
  if (list.some(x => x.kode_mapel === kode || bersihkanNamaMapel(x.nama_mapel_cetak).toLowerCase() === namaBersih.toLowerCase())) {
    Utils.showToast(`Mata pelajaran tersebut sudah ada di kelas ${kelas}.`, true);
    return;
  }

  list.push({
    fase_key: kelas,
    urutan: list.length + 1,
    kelompok: 'A',
    kode_mapel: kode,
    nama_mapel_cetak: namaBersih,
    aktif: true
  });
  state.raporSettingMapel[kelas] = list;
  renderAdminSettingMapel();
}

function ubahKelompokMapelKelas(kelas, idx, val) {
  state.raporSettingMapel[kelas][idx].kelompok = val;
}

function ubahNamaCetakMapelKelas(kelas, idx, val) {
  state.raporSettingMapel[kelas][idx].nama_mapel_cetak = val.trim();
}

function geserUrutanMapel(kelas, idx, arah) {
  const list = state.raporSettingMapel[kelas];
  const target = idx + arah;
  if (target < 0 || target >= list.length) return;
  const temp = list[idx];
  list[idx] = list[target];
  list[target] = temp;
  list.forEach((item, i) => item.urutan = i + 1);
  renderAdminSettingMapel();
}

function hapusMapelDariKelas(kelas, idx) {
  state.raporSettingMapel[kelas].splice(idx, 1);
  state.raporSettingMapel[kelas].forEach((item, i) => item.urutan = i + 1);
  renderAdminSettingMapel();
}

function salinMapelKeKelasLain() {
  const sumberKelas = document.getElementById('adminKelasMapelSelect').value;
  if (!sumberKelas) return;
  const kelasList = getUniqueKelasList().filter(k => k !== sumberKelas);
  if (kelasList.length === 0) return;

  const tujuan = prompt(`Salin susunan mapel dari ${sumberKelas} ke kelas mana?\nPilihan kelas tersedia:\n${kelasList.join(', ')}`);
  if (!tujuan) return;
  const targetKelas = kelasList.find(k => k.toLowerCase() === tujuan.trim().toLowerCase());
  if (!targetKelas) {
    Utils.showToast('Nama kelas tujuan tidak ditemukan di daftar kelas.', true);
    return;
  }

  state.raporSettingMapel[targetKelas] = JSON.parse(JSON.stringify(state.raporSettingMapel[sumberKelas])).map((m, idx) => ({
    ...m,
    fase_key: targetKelas,
    urutan: idx + 1
  }));
  saveLocalCache();
  Utils.showToast(`Susunan mapel ${sumberKelas} disalin ke ${targetKelas}. Jangan lupa simpan ${targetKelas}.`);
}

async function simpanSettingMapelKeServer() {
  const kelas = document.getElementById('adminKelasMapelSelect').value;
  if (!kelas) return;
  const list = state.raporSettingMapel[kelas] || [];
  const payload = list.map((item, idx) => ({
    fase_key: kelas,
    urutan: idx + 1,
    kelompok: item.kelompok,
    kode_mapel: item.kode_mapel,
    nama_mapel_cetak: item.nama_mapel_cetak,
    aktif: true
  }));

  saveLocalCache();

  try {
    const { error } = await DBService.replaceSettingMapel(kelas, payload);
    if (error) throw error;
    Utils.showToast(`Susunan mapel kelas ${kelas} berhasil disimpan ke Server.`);
  } catch (err) {
    Utils.showToast(`Susunan mapel kelas ${kelas} tersimpan di cache lokal.`, true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupLoginHandlers();
  loadLocalCache();
  syncAllFromServer(false);
});
