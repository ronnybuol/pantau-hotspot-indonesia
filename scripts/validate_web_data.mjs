import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const uploadDir = path.join(dataDir, 'months-upload');

function fail(message) {
  console.error(`QC FAIL: ${message}`);
  process.exit(1);
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readGzipB64(file) {
  const b64 = fs.readFileSync(file, 'utf8').trim();
  return zlib.gunzipSync(Buffer.from(b64, 'base64'));
}

function parseMonthBinary(buf, key) {
  if (buf.subarray(0, 4).toString('ascii') !== 'HSP2') fail(`${key}: magic header bukan HSP2`);
  let o = 4;
  const month = buf.readUInt8(o++);
  const dayCount = buf.readUInt8(o++);
  const expectedMonth = Number(key.slice(5, 7));
  if (month !== expectedMonth) fail(`${key}: nomor bulan ${month} tidak cocok`);

  const days = new Map();
  for (let di = 0; di < dayCount; di++) {
    if (o + 3 > buf.length) fail(`${key}: payload terpotong sebelum header hari`);
    const day = buf.readUInt8(o++);
    const n = buf.readUInt16LE(o); o += 2;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (o + 5 > buf.length) fail(`${key}: payload terpotong pada cell hari ${day}`);
      o += 2; // latIndex, lonIndex
      count += buf.readUInt16LE(o); o += 2;
      const activeDays = buf.readUInt8(o++);
      if (activeDays < 1 || activeDays > 242) fail(`${key}-${day}: activeDays di luar rentang`);
    }
    const iso = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (days.has(iso)) fail(`${key}: tanggal duplikat ${iso}`);
    days.set(iso, count);
  }
  if (o !== buf.length) fail(`${key}: ada ${buf.length - o} byte sisa yang tidak terbaca`);
  return days;
}

const meta = readJSON(path.join(dataDir, 'meta.json'));
const manifest = readJSON(path.join(uploadDir, 'manifest.json'));
const summary = JSON.parse(readGzipB64(path.join(dataDir, 'summary.json.gz.b64')).toString('utf8'));

if (summary.length !== 242) fail(`summary berisi ${summary.length} hari, seharusnya 242`);
if (summary[0].date !== meta.start_date) fail('tanggal awal summary tidak cocok dengan meta');
if (summary.at(-1).date !== meta.end_date) fail('tanggal akhir summary tidak cocok dengan meta');

const summaryMap = new Map(summary.map(d => [d.date, d.count]));
if (summaryMap.size !== summary.length) fail('summary memiliki tanggal duplikat');

let mapTotal = 0;
let checkedDays = 0;
for (const [key, parts] of Object.entries(manifest)) {
  if (!Array.isArray(parts) || parts.length === 0) fail(`${key}: manifest tanpa parts`);
  let joined = '';
  for (const name of parts) {
    const file = path.join(uploadDir, name);
    if (!fs.existsSync(file)) fail(`${key}: file manifest tidak ditemukan: ${name}`);
    joined += fs.readFileSync(file, 'utf8').trim();
  }
  const buf = zlib.gunzipSync(Buffer.from(joined, 'base64'));
  const days = parseMonthBinary(buf, key);
  for (const [date, count] of days) {
    const expected = summaryMap.get(date);
    if (expected === undefined) fail(`${date}: ada di payload peta tetapi tidak di summary`);
    if (count !== expected) fail(`${date}: jumlah grid ${count} != summary ${expected}`);
    mapTotal += count;
    checkedDays++;
  }
}

if (checkedDays !== summary.length) fail(`payload peta memuat ${checkedDays} hari, summary ${summary.length}`);
for (const date of summaryMap.keys()) {
  const key = date.slice(0, 7);
  if (!manifest[key]) fail(`${date}: bulan tidak ada di manifest`);
}

const summaryTotal = summary.reduce((s, d) => s + d.count, 0);
if (summaryTotal !== meta.records) fail(`total summary ${summaryTotal} != meta.records ${meta.records}`);
if (mapTotal !== meta.records) fail(`total payload peta ${mapTotal} != meta.records ${meta.records}`);

const peak = summary.reduce((a, b) => b.count > a.count ? b : a);
if (peak.date !== meta.peak_date || peak.count !== meta.peak_count) {
  fail(`peak summary ${peak.date}/${peak.count} != meta ${meta.peak_date}/${meta.peak_count}`);
}

console.log(`QC PASS: ${checkedDays} hari, ${mapTotal.toLocaleString('id-ID')} deteksi.`);
console.log(`QC PASS: puncak ${peak.date} = ${peak.count.toLocaleString('id-ID')} deteksi.`);
console.log(`QC PASS: ${Object.keys(manifest).length} bulan dan seluruh parts manifest tersedia.`);
