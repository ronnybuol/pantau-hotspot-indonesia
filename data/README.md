# Data web

Folder ini dihasilkan oleh `scripts/process_firms.py` dari file JSON NASA FIRMS.

Output pipeline lengkap dapat mencakup:
- `summary.json` / `summary.json.gz.b64` — ringkasan harian untuk grafik dan indikator;
- `meta.json` — metadata periode, sumber, dan tanggal puncak;
- `months/` — agregasi grid verbose untuk audit/fallback lokal;
- `months-b64/` — versi verbose terkompresi;
- `months-compact-b64/` — payload produksi paling ringkas untuk peta.

Payload yang disimpan di repository untuk visual nasional memakai grid 0,25° dan hanya membawa variabel yang benar-benar ditampilkan peta: posisi grid, jumlah deteksi, total/maksimum FRP, dan jumlah hari grid aktif. Total deteksi harian tetap berasal dari seluruh record sumber.

Untuk deployment jangka panjang, data bulanan dapat dipindahkan ke Cloudflare R2 agar GitHub tetap fokus pada kode dan metodologi.
