#!/usr/bin/env python3
"""Build compact HSP2 monthly payloads from verbose monthly JSON.

Run after process_firms.py:
  python scripts/build_web_payload.py --data data
"""
import argparse
import base64
import gzip
import json
import struct
from pathlib import Path

LAT_BASE = -11.875
LON_BASE = 90.125
GRID = 0.25
PART_CHARS = 8000


def grid_index(value: float, base: float) -> int:
    idx = round((value - base) / GRID)
    if not 0 <= idx <= 255:
        raise ValueError(f"Grid index di luar uint8: value={value}, base={base}, idx={idx}")
    return idx


def encode_month(month_file: Path) -> bytes:
    payload = json.loads(month_file.read_text(encoding="utf-8"))
    month = int(payload["month"][5:7])
    days = sorted(payload["days"], key=lambda d: d["date"])
    if len(days) > 255:
        raise ValueError("Jumlah hari tidak muat uint8")

    out = bytearray(b"HSP2")
    out += struct.pack("<BB", month, len(days))
    for day in days:
        day_num = int(day["date"][8:10])
        cells = day["cells"]
        if len(cells) > 65535:
            raise ValueError(f"Terlalu banyak grid pada {day['date']}")
        out += struct.pack("<BH", day_num, len(cells))
        for cell in cells:
            count = int(cell["count"])
            active = int(cell["active_days_2026"])
            if not 0 <= count <= 65535:
                raise ValueError(f"count di luar uint16 pada {day['date']}: {count}")
            if not 1 <= active <= 255:
                raise ValueError(f"active_days di luar uint8 pada {day['date']}: {active}")
            lat_idx = grid_index(float(cell["lat"]), LAT_BASE)
            lon_idx = grid_index(float(cell["lon"]), LON_BASE)
            out += struct.pack("<BBHB", lat_idx, lon_idx, count, active)
    return bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--part-chars", type=int, default=PART_CHARS)
    args = ap.parse_args()

    months_dir = args.data / "months"
    output_dir = args.data / "months-upload"
    output_dir.mkdir(parents=True, exist_ok=True)

    for old in output_dir.glob("*.b64"):
        old.unlink()

    manifest = {}
    for month_file in sorted(months_dir.glob("2026-??.json")):
        key = month_file.stem
        binary = encode_month(month_file)
        compressed = gzip.compress(binary, compresslevel=9, mtime=0)
        encoded = base64.b64encode(compressed).decode("ascii")
        names = []
        for i in range(0, len(encoded), args.part_chars):
            name = f"{key}.part{len(names)+1:02d}.b64"
            (output_dir / name).write_text(encoded[i:i+args.part_chars], encoding="ascii")
            names.append(name)
        manifest[key] = names
        print(f"{key}: {len(binary):,} byte raw -> {len(encoded):,} chars, {len(names)} part")

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest: {len(manifest)} bulan")


if __name__ == "__main__":
    main()
