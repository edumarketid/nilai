// db.js - Layanan Komunikasi Database Supabase (SMKN 1 Wakatobi)
const _SERVER_URL = (typeof APP_CONFIG !== 'undefined' && (APP_CONFIG.SERVER_URL || APP_CONFIG.SUPABASE_URL))
  ? (APP_CONFIG.SERVER_URL || APP_CONFIG.SUPABASE_URL)
  : 'https://nbwpnhshhpfqtmbwewgk.supabase.co';

const _SERVER_KEY = (typeof APP_CONFIG !== 'undefined' && (APP_CONFIG.SERVER_ANON_KEY || APP_CONFIG.SUPABASE_ANON_KEY))
  ? (APP_CONFIG.SERVER_ANON_KEY || APP_CONFIG.SUPABASE_ANON_KEY)
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3BuaHNoaHBmcXRtYndld2drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTQ1ODUsImV4cCI6MjEwNzk5MDU4NX0.2Ah6o8svWPMDEI1O3zOxytNyqBIjED7GXTxowNm1Ai4';

if (!window.supabase) {
  throw new Error('Library Supabase CDN gagal dimuat. Periksa koneksi internet.');
}

const supabaseClient = window.supabase.createClient(_SERVER_URL, _SERVER_KEY);

async function safeSelect(tableName, orderCol = null, maxRows = 5000) {
  try {
    let q = supabaseClient.from(tableName).select('*');
    if (orderCol) q = q.order(orderCol, { ascending: true });
    if (maxRows) q = q.limit(maxRows);
    const { data, error } = await q;
    if (error) {
      console.warn(`Tabel ${tableName} gagal dimuat:`, error.message);
      return { data: [], error };
    }
    return { data: data || [], error: null };
  } catch (err) {
    console.warn(`Exception tabel ${tableName}:`, err);
    return { data: [], error: err };
  }
}

window.DBService = {
  async fetchAllSourceTables() {
    const [siswaRes, guruRes, mapelRes, adminRes, ujianRes, absenRes] = await Promise.all([
      safeSelect('siswa', null, 3000),
      safeSelect('guru', null, 500),
      safeSelect('mapel', null, 500),
      safeSelect('admin', null, 100),
      safeSelect('hasil_ujian', null, 5000),
      safeSelect('absensi_harian', null, 5000)
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
      safeSelect('rapor_nilai', null, 10000),
      safeSelect('rapor_wali_kelas', null, 500),
      safeSelect('rapor_setting_mapel', 'urutan', 2000),
      safeSelect('rapor_pelengkap', null, 3000)
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
