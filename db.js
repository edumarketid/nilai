// db.js - Lapisan Akses Database Server (Baca-Saja Tabel Existing + Baca-Tulis Tabel rapor_*)
const dbClient = window.supabase.createClient(APP_CONFIG.SERVER_URL, APP_CONFIG.SERVER_ANON_KEY);

const DBService = {
  // Baca semua tabel sumber dengan limit 5000 baris & pelaporan error jelas
  async fetchAllSourceTables() {
    const [resSiswa, resGuru, resMapel, resAdmin, resUjian, resAbsensi] = await Promise.all([
      dbClient.from('siswa').select('*').range(0, 4999),
      dbClient.from('guru').select('*').range(0, 1999),
      dbClient.from('mapel').select('*').range(0, 999),
      dbClient.from('admin').select('*').range(0, 499),
      dbClient.from('hasil_ujian').select('*').range(0, 9999),
      dbClient.from('absensi_harian').select('*').range(0, 9999)
    ]);

    const errors = [];
    if (resSiswa.error) errors.push(`siswa: ${resSiswa.error.message}`);
    if (resGuru.error) errors.push(`guru: ${resGuru.error.message}`);
    if (resMapel.error) errors.push(`mapel: ${resMapel.error.message}`);

    return {
      siswa: resSiswa.data || [],
      guru: resGuru.data || [],
      mapel: resMapel.data || [],
      admin: resAdmin.data || [],
      hasilUjian: resUjian.data || [],
      absensiHarian: resAbsensi.data || [],
      errors
    };
  },

  // Baca 4 tabel khusus penyimpanan E-Rapor
  async fetchAllRaporTables() {
    const [resRNilai, resRWalas, resRMapel, resRPelengkap] = await Promise.all([
      dbClient.from('rapor_nilai').select('*').range(0, 9999),
      dbClient.from('rapor_wali_kelas').select('*').range(0, 999),
      dbClient.from('rapor_setting_mapel').select('*').range(0, 999),
      dbClient.from('rapor_pelengkap').select('*').range(0, 4999)
    ]);

    return {
      raporNilai: resRNilai.error ? [] : (resRNilai.data || []),
      raporWaliKelas: resRWalas.error ? [] : (resRWalas.data || []),
      raporSettingMapel: resRMapel.error ? [] : (resRMapel.data || []),
      raporPelengkap: resRPelengkap.error ? [] : (resRPelengkap.data || [])
    };
  },

  async upsertRaporNilai(payload) {
    return await dbClient.from('rapor_nilai').upsert(payload, {
      onConflict: 'tahun_pelajaran,semester,kelas,nisn,kode_mapel'
    });
  },

  async upsertWaliKelas(payload) {
    return await dbClient.from('rapor_wali_kelas').upsert(payload, {
      onConflict: 'tahun_pelajaran,kelas'
    });
  },

  async replaceSettingMapel(faseKey, payload) {
    await dbClient.from('rapor_setting_mapel').delete().eq('fase_key', faseKey);
    if (payload.length > 0) {
      return await dbClient.from('rapor_setting_mapel').insert(payload);
    }
    return { error: null };
  },

  async upsertPelengkap(record) {
    return await dbClient.from('rapor_pelengkap').upsert(record, {
      onConflict: 'tahun_pelajaran,semester,kelas,nisn'
    });
  }
};
