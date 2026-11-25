// print_rapor.js - Modul Pembuat Layout Cetak Rapor F4 (2 Halaman per Siswa)
const RaporPrinter = {
  buildIdentitasHeaderHTML(siswa, kelas, semester, tahun, alamatSekolah) {
    const nama = Utils.getSiswaNama(siswa).toUpperCase();
    const nis = Utils.getSiswaNIS(siswa);
    const nisn = Utils.getSiswaNISN(siswa);
    const indukGabung = nis && nis !== nisn ? `${nis}/${nisn}` : nisn;
    const faseKode = Utils.getKodeFaseCetak(kelas);

    return `
      <table class="identitas-table">
        <tr>
          <td style="width: 22%;">Nama Peserta Didik</td>
          <td style="width: 38%;">: <b>${nama}</b></td>
          <td style="width: 18%;">Kelas</td>
          <td style="width: 22%;">: ${kelas}</td>
        </tr>
        <tr>
          <td>Nomor Induk/NISN</td>
          <td>: ${indukGabung}</td>
          <td>Fase</td>
          <td>: ${faseKode}</td>
        </tr>
        <tr>
          <td>Sekolah</td>
          <td>: ${APP_CONFIG.NAMA_SEKOLAH}</td>
          <td>Semester</td>
          <td>: ${semester}</td>
        </tr>
        <tr>
          <td>Alamat</td>
          <td>: ${alamatSekolah}</td>
          <td>Tahun Pelajaran</td>
          <td>: ${tahun}</td>
        </tr>
      </table>
    `;
  },

  buildRaporDuaHalamanHTML(siswa, ctx) {
    const { tahun, semester, alamatSekolah, mapelSusunan, pelengkap, absAuto, walasObj, kepalaSekolah, tglCetakDefault, getNilaiFn } = ctx;
    const kelas = Utils.getSiswaKelas(siswa);
    const nisn = Utils.getSiswaNISN(siswa);
    const namaUpper = Utils.getSiswaNama(siswa).toUpperCase();

    const umumList = mapelSusunan.filter(m => m.kelompok === 'A');
    const kejuruanList = mapelSusunan.filter(m => m.kelompok === 'B');

    let nomorUrut = 1;
    const renderRowsMapel = (list) => list.map(m => {
      const nObj = getNilaiFn(tahun, semester, kelas, nisn, m.kode_mapel, m.nama_mapel_cetak);
      const nilaiAkhir = nObj?.nilai_akhir_bulat ? nObj.nilai_akhir_bulat : '-';
      const capaian = nObj?.capaian_kompetensi || '-';
      return `
        <tr>
          <td style="text-align:center; width: 32px;">${nomorUrut++}</td>
          <td style="width: 210px;">${m.nama_mapel_cetak}</td>
          <td style="text-align:center; width: 65px; font-weight:bold;">${nilaiAkhir}</td>
          <td>${capaian}</td>
        </tr>
      `;
    }).join('');

    const pklRows = (pelengkap?.data_pkl?.length ? pelengkap.data_pkl : [{ mitra: '-', lokasi: '-', lamanya: '-', keterangan: '-' }])
      .map((p, i) => `
        <tr>
          <td style="text-align:center; width:35px;">${i + 1}.</td>
          <td>${p.mitra || '-'}</td>
          <td>${p.lokasi || '-'}</td>
          <td>${p.lamanya || '-'}</td>
          <td>${p.keterangan || '-'}</td>
        </tr>
      `).join('');

    const ekskulRows = (pelengkap?.data_ekskul?.length ? pelengkap.data_ekskul : [{ kegiatan: '-', keterangan: '-' }])
      .map((e, i) => `
        <tr>
          <td style="text-align:center; width:35px;">${i + 1}.</td>
          <td>${e.kegiatan || '-'}</td>
          <td>${e.keterangan || '-'}</td>
        </tr>
      `).join('');

    const namaWalas = walasObj?.nama_wali_kelas || '........................................';
    const nipWalas = walasObj?.nip_wali_kelas || '-';
    const tglCetak = pelengkap?.tanggal_cetak || tglCetakDefault;

    const page1 = `
      <div class="f4-page">
        <div>
          ${this.buildIdentitasHeaderHTML(siswa, kelas, semester, tahun, alamatSekolah)}
          <div style="font-weight:bold; margin-top:6px; margin-bottom:2px;">A. Nilai Akademik</div>
          <table class="rapor-table">
            <thead>
              <tr>
                <th style="width:32px;">No</th>
                <th style="width:210px;">Mata Pelajaran</th>
                <th style="width:65px;">Nilai Akhir</th>
                <th>Capaian Kompetensi</th>
              </tr>
            </thead>
            <tbody>
              <tr class="rapor-group-row"><td colspan="4">A. Kelompok Mata Pelajaran Umum</td></tr>
              ${renderRowsMapel(umumList)}
              <tr class="rapor-group-row"><td colspan="4">B. Kelompok Mata Pelajaran Kejuruan</td></tr>
              ${renderRowsMapel(kejuruanList)}
            </tbody>
          </table>
        </div>
        <div class="page-footer">
          <span>${namaUpper} &nbsp;|&nbsp; ${kelas}</span>
          <span>Halaman 1</span>
        </div>
      </div>
    `;

    const page2 = `
      <div class="f4-page">
        <div>
          ${this.buildIdentitasHeaderHTML(siswa, kelas, semester, tahun, alamatSekolah)}

          <div style="font-weight:bold; margin-top:8px;">B. Praktik Kerja Lapangan</div>
          <table class="rapor-table">
            <thead>
              <tr>
                <th style="width:35px;">No</th>
                <th>Mitra DU/DI</th>
                <th>Lokasi</th>
                <th>Lamanya</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>${pklRows}</tbody>
          </table>

          <div style="font-weight:bold; margin-top:10px;">C. Ekstrakurikuler</div>
          <table class="rapor-table">
            <thead>
              <tr>
                <th style="width:35px;">No</th>
                <th style="width:45%;">Kegiatan Ekstrakurikuler</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>${ekskulRows}</tbody>
          </table>

          <div style="font-weight:bold; margin-top:10px;">D. Ketidakhadiran</div>
          <table class="rapor-table" style="width: 48%;">
            <tr><td style="width: 55%;">Sakit</td><td>: ${absAuto.sakit} hari</td></tr>
            <tr><td>Izin</td><td>: ${absAuto.izin} hari</td></tr>
            <tr><td>Tanpa Keterangan</td><td>: ${absAuto.alpa} hari</td></tr>
          </table>

          <table style="width:100%; margin-top:26px; font-size:10.5pt; border-collapse:collapse;">
            <tr>
              <td style="width:38%; vertical-align:top;">
                Orang Tua/Wali
                <div style="height:64px;"></div>
                ........................................
              </td>
              <td style="width:24%;"></td>
              <td style="width:38%; vertical-align:top;">
                ${tglCetak}<br>
                Wali Kelas
                <div style="height:52px;"></div>
                <b><u>${namaWalas}</u></b><br>
                NIP. ${nipWalas}
              </td>
            </tr>
            <tr>
              <td colspan="3" style="padding-top:18px;">
                <div style="width:45%; margin:0 auto; text-align:left;">
                  Mengetahui,<br>
                  Plt. Kepala Sekolah
                  <div style="height:54px;"></div>
                  <b><u>${kepalaSekolah.nama}</u></b><br>
                  NIP. ${kepalaSekolah.nip}
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div class="page-footer">
          <span>${namaUpper} &nbsp;|&nbsp; ${kelas}</span>
          <span>Halaman 2</span>
        </div>
      </div>
    `;

    return page1 + page2;
  }
};
