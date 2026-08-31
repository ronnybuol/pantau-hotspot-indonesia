# Metodologi — Deteksi Hotspot Indonesia 2026

## Sumber
Dataset sumber: NASA FIRMS, VIIRS NOAA-21 (N21), versi 2.0NRT.
Periode prototype: 1 Januari–30 Agustus 2026.
Jumlah record: 195.722 deteksi.

## Terminologi editorial
Visual menggunakan istilah **deteksi hotspot**, bukan “jumlah kebakaran”. Satu kejadian kebakaran dapat menghasilkan lebih dari satu deteksi dan dapat teramati pada lintasan satelit yang berbeda. Anomali termal juga dapat berasal dari sumber panas persisten selain karhutla.

## Agregasi spasial
Agar visual lancar di web dan ponsel, latitude/longitude dikelompokkan ke grid 0,05 derajat (sekitar 5–6 km, tergantung lintang). Setiap grid per hari menyimpan:
- jumlah deteksi;
- total dan maksimum FRP;
- jumlah berdasarkan confidence (low/nominal/high) dan siang/malam;
- jumlah hari grid tersebut aktif sepanjang periode dataset.

## Filter persisten
Prototype menyediakan filter eksploratif untuk menyembunyikan grid yang aktif sedikitnya 60 hari selama periode data. Filter ini dibuat untuk membantu pembaca melihat pengaruh sumber panas berulang, tetapi **bukan klasifikasi resmi karhutla** dan tidak boleh digunakan untuk menuduh lokasi tertentu sebagai sumber kebakaran atau bukan kebakaran.

## Puncak
Tanggal dengan deteksi terbanyak dalam dataset adalah 29 Agustus 2026: 10.927 deteksi.
