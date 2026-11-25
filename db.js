// db.js - Layanan Komunikasi Database Supabase
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

const DBService = {
  async fetchAllSourceTables() {
    const [siswaRes, guruRes, mapelRes, adminRes, ujianRes, absenRes] = await Promise.all([
      supabaseClient.from('siswa').select('*').limit(5000),
      supabaseClient.from('guru').select('*').limit(1000),
      supabaseClient.from('mapel').select('*').limit(1000),
      supabaseClient.from('admin').select('*').limit(200),
      supabaseClient.from('hasil_ujian').select('*').limit(10000),
      supabaseClient.from('absensi_harian').select('*').limit(10000)
    ]);

    return {
      siswa: siswaRes.data || [],
      guru: guruRes.data || [],
      mapel: mapelRes.data || [],
      admin: adminRes.data || [],
      hasilUjian: ujianRes.data || [],
      absensiHarian: absenRes.data || []
    };
  },

  async fetchAllRaporTables() {
    const [nilaiRes, walasRes, mapelRes, pelengkapRes] = await Promise.all([
      supabaseClient.from('rapor_nilai').select('*').limit(10000),
      supabaseClient.from('rapor_wali_kelas').select('*').limit(1000),
      supabaseClient.from('rapor_setting_mapel').select('*').order('urutan', { ascending: true }).limit(5000),
      supabaseClient.from('rapor_pelengkap').select('*').limit(5000)
    ]);

    return {
      raporNilai: nilaiRes.data || [],
      raporWaliKelas: walasRes.data || [],
      raporSettingMapel: mapelRes.data || [],
      raporPelengkap: pelengkapRes.data || []
    };
  },

  async upsertRaporNilai(records) {
    if (!records || records.length === 0) return { error: null };
    return await supabaseClient
      .from('rapor_nilai')
      .upsert(records, { onConflict: 'tahun_pelajaran,semester,kelas,nisn,kode_mapel' });
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
