# Data web

Folder ini dihasilkan dari file JSON NASA FIRMS.

## Pipeline
1. `python scripts/process_firms.py /path/to/fire_nrt.json --output data`
2. `python scripts/build_web_payload.py --data data`
3. `node scripts/validate_web_data.mjs`

Output utama:
- `summary.json` / `summary.json.gz.b64` — ringkasan harian untuk grafik dan indikator;
- `meta.json` — metadata periode, sumber, dan tanggal puncak;
- `months/` — agregasi grid verbose hasil preprocessing untuk audit dan regenerasi;
- `months-upload/` — payload produksi HSP2 yang dipakai browser, dipecah menjadi beberapa file Base64 terkompresi dan direferensikan oleh `manifest.json`.

Payload produksi untuk visual nasional memakai grid 0,25° dan hanya membawa variabel yang benar-benar dibutuhkan peta: posisi grid, jumlah deteksi, dan jumlah hari grid aktif. FRP tetap tersedia di ringkasan harian nasional. Total deteksi harian tetap berasal dari seluruh record sumber.

Untuk deployment jangka panjang, payload bulanan dapat dipindahkan ke Cloudflare R2 tanpa mengubah metodologi penghitungan.
