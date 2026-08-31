# Metodologi — Deteksi Hotspot Indonesia 2026

## Sumber
Dataset sumber: NASA FIRMS, VIIRS NOAA-21 (N21), versi 2.0NRT.
Periode prototype: 1 Januari–30 Agustus 2026.
Jumlah record: 195.722 deteksi.

## Terminologi editorial
Visual menggunakan istilah **deteksi hotspot**, bukan “jumlah kebakaran”. Satu kejadian kebakaran dapat menghasilkan lebih dari satu deteksi dan dapat teramati pada lintasan satelit yang berbeda. Anomali termal juga dapat berasal dari sumber panas persisten selain karhutla.

## Agregasi spasial
Untuk visual nasional agar lancar di web dan ponsel, latitude/longitude dikelompokkan ke grid 0,25 derajat (sekitar 25–28 km pada lintang Indonesia).

Payload peta produksi per grid per hari hanya menyimpan:
- posisi grid;
- jumlah deteksi;
- jumlah hari grid tersebut aktif sepanjang periode dataset.

FRP tetap dihitung dari seluruh record sumber dan ditampilkan sebagai statistik **harian nasional**, bukan sebagai atribut lingkaran pada peta produksi.

Jumlah deteksi harian tetap dihitung dari seluruh record sumber; agregasi grid hanya mengubah cara titik digambar pada peta, bukan total harian.

## Filter persisten
Prototype menyediakan filter eksploratif untuk menyembunyikan grid yang aktif sedikitnya 60 hari selama periode data. Filter ini dibuat untuk membantu pembaca melihat pengaruh sumber panas berulang, tetapi **bukan klasifikasi resmi karhutla** dan tidak boleh digunakan untuk menuduh lokasi tertentu sebagai sumber kebakaran atau bukan kebakaran.

## Puncak
Tanggal dengan deteksi terbanyak dalam dataset adalah 29 Agustus 2026: 10.927 deteksi.

## Quality control
`node scripts/validate_web_data.mjs` membuka kembali seluruh payload peta produksi, membandingkan jumlah grid per hari dengan ringkasan harian, memeriksa total record, tanggal, manifest, dan tanggal puncak. Pemeriksaan yang sama dijalankan otomatis oleh GitHub Actions pada setiap perubahan di `main` atau pull request.
