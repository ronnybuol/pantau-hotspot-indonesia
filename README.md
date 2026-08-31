# Pantau Hotspot Indonesia

Proyek data journalism untuk memvisualisasikan perubahan harian **deteksi hotspot** di Indonesia. Versi awal menggunakan NASA FIRMS VIIRS NOAA-21 untuk periode 1 Januari–30 Agustus 2026.

## Fitur
- peta Leaflet Indonesia;
- autoplay harian dan slider tanggal;
- grafik deteksi harian + rata-rata 7 hari;
- statistik harian dan akumulasi;
- anotasi puncak 29 Agustus 2026;
- filter eksploratif grid panas persisten;
- responsive untuk desktop dan mobile.

## Struktur
- `src/` — HTML/CSS/JS aplikasi
- `data/` — data siap web yang sudah dipadatkan (grid nasional 0,25°)
- `scripts/` — pipeline preprocessing NASA FIRMS
- `docs/` — metodologi editorial dan panduan deploy
- `wrangler.jsonc` — konfigurasi Cloudflare Workers Static Assets

## Menjalankan lokal

```bash
npm install
npm run build
python -m http.server 8000 --directory dist
```

Lalu buka `http://localhost:8000/`.

## Cloudflare

```bash
npm run build
npx wrangler dev
```

Deploy:

```bash
npm run deploy
```

Lihat `docs/deploy-cloudflare.md` untuk konfigurasi GitHub → Cloudflare.

## Embed WordPress

```html
<iframe src="https://URL-INTERAKTIF/" width="100%" height="900" style="border:0" loading="lazy"></iframe>
```

## Catatan editorial
Satu deteksi hotspot bukan satu kejadian kebakaran. Lihat `docs/methodology.md`.
