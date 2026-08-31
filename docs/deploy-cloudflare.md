# Deploy ke Cloudflare

## Tahap 1 — preview tanpa coding

Gunakan paket `hotspot-indonesia-2026-deploy.zip` untuk melihat versi hidup terlebih dahulu.

Pilihan termudah adalah **Cloudflare Drop**: unggah folder/ZIP aset statis, buka preview, lalu claim deployment ke akun Cloudflare bila sudah cocok.

Alternatif di dashboard adalah Pages Direct Upload: Workers & Pages → Create application → Get started → Drag and drop your files. Ini cocok untuk preview/manual, tetapi proyek Direct Upload tidak dapat diubah menjadi Git integration pada proyek Pages yang sama.

## Tahap 2 — produksi dari GitHub

Untuk pengembangan jangka panjang gunakan **Cloudflare Workers Static Assets + Workers Builds**.

Setelah branch prototype disetujui dan digabung ke `main`:

1. Cloudflare Dashboard → Workers & Pages → Create application.
2. Pilih **Import a repository** dan hubungkan GitHub.
3. Pilih repository `pantau-hotspot-indonesia`.
4. Worker name: `pantau-hotspot-indonesia` (harus sama dengan `name` di `wrangler.jsonc`).
5. Root directory: `.` (root repository).
6. Build command: `npm run build`.
7. Deploy command: `npx wrangler deploy`.
8. Save and Deploy.

Cloudflare akan memberi URL `*.workers.dev`. Setelah stabil, pasang custom domain/subdomain dan embed URL itu ke WordPress melalui iframe.

## Data

Untuk preview, data 2026 disertakan dalam paket deploy sebagai payload ringkas terkompresi. Untuk produksi jangka panjang dan pembaruan otomatis, data spasial sebaiknya dipindahkan ke Cloudflare R2; repository GitHub tetap menyimpan kode, pipeline, metodologi, dan konfigurasi.
