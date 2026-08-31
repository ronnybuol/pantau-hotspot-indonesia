# Data web

Folder ini dihasilkan oleh `scripts/process_firms.py` dari file JSON NASA FIRMS.

Output:
- `summary.json` / `summary.json.gz.b64` — ringkasan harian untuk grafik dan indikator;
- `meta.json` — metadata periode, sumber, dan tanggal puncak;
- `months/` — agregasi grid verbose untuk audit/fallback lokal;
- `months-b64/` — versi verbose terkompresi;
- `months-compact-b64/` — payload produksi paling ringkas untuk peta.

Payload produksi memakai grid 0,05° dan hanya membawa variabel yang benar-benar ditampilkan peta: posisi grid, jumlah deteksi, total/maksimum FRP, dan jumlah hari grid aktif.

Untuk deployment jangka panjang, data bulanan dapat ditempatkan di Cloudflare R2 agar GitHub tetap fokus pada kode dan metodologi. Paket deploy saat ini sudah menyertakan data 1 Januari–30 Agustus 2026.
