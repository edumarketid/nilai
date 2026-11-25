// db.js - Layanan Komunikasi Database Supabase (Membaca Kredensial Murni dari config.js)
if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.SERVER_URL || !APP_CONFIG.SERVER_ANON_KEY) {
  throw new Error('Konfigurasi APP_CONFIG pada config.js tidak ditemukan atau belum lengkap.');
}

if (!window.supabase) {
  throw new Error('Library Supabase CDN gagal dimuat. Periksa koneksi internet.');
}

const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SERVER_URL,
  APP_CONFIG.SERVER_ANON_KEY
);

// Tarik seluruh baris tabel bertahap per 1000 baris agar tidak terpotong limit default API Supabase
async function fetchAllRowsPaginated(tableName, orderCol = null, maxPages = 30) {
  let allData = [];
  const pageSize = 1000;
  let lastError = null;

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    try {
      let q = supabaseClient.from(tableName).select('*').range(from, to);
      if (orderCol) q = q.order(orderCol, { ascending: true });
      const { data, error } = await q;
      if (error) {
        lastError = error;
        console.warn(`Tabel ${tableName} halaman ${page} gagal:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
    } catch (err) {
      lastError = err;
      console.warn(`Exception tabel ${tableName}:`, err);
      break;
    }
  }

  return { data: allData, error: allData.length > 0 ? null : lastError };
}

window.DBService = {
  async fetchAllSourceTables() {
    const [siswaRes, guruRes, mapelRes, adminRes, ujianRes, absenRes] = await Promise.all([
      fetchAllRowsPaginated('siswa', null, 10),
      fetchAllRowsPaginated('guru', null, 5),
      fetchAllRowsPaginated('mapel', null, 5),
      fetchAllRowsPaginated('admin', null, 2),
      fetchAllRowsPaginated('hasil_ujian', null, 15),
      fetchAllRowsPaginated('absensi_harian', null, 15)
    ]);

    if (siswaRes.error && guruRes.error) {
      throw new Error(siswaRes.error.message || guruRes.error.message || 'Koneksi ke Supabase terputus');
    }

    return {
      siswa: siswaRes.data,
      guru: guruRes.data,
      mapel: mapelRes.data,
      admin: adminRes.data,
      hasilUjian: ujianRes.data,
      absensiHarian: absenRes.data
    };
  },

  async fetchAllRaporTables() {
    const [nilaiRes, walasRes, mapelRes, pelengkapRes] = await Promise.all([
      fetchAllRowsPaginated('rapor_nilai', null, 30),
      fetchAllRowsPaginated('rapor_wali_kelas', null, 5),
      fetchAllRowsPaginated('rapor_setting_mapel', 'urutan', 10),
      fetchAllRowsPaginated('rapor_pelengkap', null, 10)
    ]);

    return {
      raporNilai: nilaiRes.data,
      raporWaliKelas: walasRes.data,
      raporSettingMapel: mapelRes.data,
      raporPelengkap: pelengkapRes.data
    };
  },

  async upsertRaporNilai(records) {
    if (!records || records.length === 0) return { error: null };

    // Jalur 1: Upsert batch standar
    const res = await supabaseClient
      .from('rapor_nilai')
      .upsert(records, { onConflict: 'tahun_pelajaran,semester,kelas,nisn,kode_mapel' });

    if (!res.error) return res;

    // Jalur 2 (Cadangan otomatis jika constraint onConflict berbeda di Supabase)
    console.warn('Upsert onConflict gagal, beralih ke metode replace per kelas & mapel:', res.error.message);
    const sample = records[0];
    const nisnList = records.map(r => r.nisn).filter(Boolean);

    if (sample.tahun_pelajaran && sample.semester && sample.kelas && sample.kode_mapel && nisnList.length > 0) {
      await supabaseClient
        .from('rapor_nilai')
        .delete()
        .eq('tahun_pelajaran', sample.tahun_pelajaran)
        .eq('semester', sample.semester)
        .eq('kelas', sample.kelas)
        .eq('kode_mapel', sample.kode_mapel)
        .in('nisn', nisnList);
    }

    return await supabaseClient.from('rapor_nilai').insert(records);
  },

  async upsertWaliKelas(records) {
    if (!records || records.length === 0) return { error: null };
    return await supabaseClient
      .from('rapor_wali_kelas')
      .upsert(records, { onConflict: 'tahun_pelajaran,kelas' });
  },

  async replaceSettingMapel(faseKey, records) {
    await supabaseClient.from('rapor_setting_mapel').delete().eq('fase_key', faseKey);
    if (!records || records.length === 0) return { error: null };
    return await supabaseClient.from('rapor_setting_mapel').insert(records);
  },

  async upsertPelengkap(record) {
    return await supabaseClient
      .from('rapor_pelengkap')
      .upsert([record], { onConflict: 'tahun_pelajaran,semester,kelas,nisn' });
  }
};
