#!/usr/bin/env python3
"""Validate the committed web payload without needing the raw FIRMS source."""
from __future__ import annotations

import base64
import datetime as dt
import gzip
import hashlib
import json
import struct
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MONTHS = DATA / "months-upload"
LAT0 = -11.875
LON0 = 90.125
GRID = 0.25


def load_gzip_b64(path: Path) -> bytes:
    text = path.read_text(encoding="ascii").strip()
    return gzip.decompress(base64.b64decode(text, validate=True))


def parse_month(raw: bytes, key: str):
    if raw[:4] != b"HSP2":
        raise AssertionError(f"{key}: invalid HSP2 magic")
    month_expected = int(key[5:7])
    year = int(key[:4])
    offset = 4
    month, day_count = struct.unpack_from("<BB", raw, offset)
    offset += 2
    assert month == month_expected, (key, month)
    days = []
    for _ in range(day_count):
        day, cell_count = struct.unpack_from("<BH", raw, offset)
        offset += 3
        total = 0
        for _ in range(cell_count):
            lat_idx, lon_idx, count, active_days = struct.unpack_from("<BBHB", raw, offset)
            offset += 5
            assert count > 0
            assert 0 < active_days <= 255
            lat = LAT0 + lat_idx * GRID
            lon = LON0 + lon_idx * GRID
            assert -12 <= lat <= 7
            assert 90 <= lon <= 142
            total += count
        date = dt.date(year, month, day).isoformat()
        days.append((date, total))
    assert offset == len(raw), f"{key}: trailing or missing bytes ({offset} != {len(raw)})"
    return days


def main() -> None:
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))

    compact_rows = json.loads(load_gzip_b64(DATA / "summary-compact.json.gz.b64"))
    summary = {date: {"count": count, "frp": frp} for date, count, frp in compact_rows}

    # The browser currently reads the legacy object-shaped summary. Verify that it
    # is semantically identical to the canonical compact summary used by QC.
    browser_rows = json.loads(load_gzip_b64(DATA / "summary.json.gz.b64"))
    browser_summary = {row["date"]: {"count": row["count"], "frp": row["frp_sum"]} for row in browser_rows}
    assert browser_summary == summary, "Browser summary differs from canonical compact summary"

    manifest = json.loads((MONTHS / "manifest.json").read_text(encoding="utf-8"))
    checksums = json.loads((MONTHS / "checksums.json").read_text(encoding="utf-8"))

    reconstructed = {}
    for month, parts in sorted(manifest.items()):
        for part in parts:
            assert (MONTHS / part).is_file(), f"Missing payload part: {part}"
        encoded = "".join((MONTHS / p).read_text(encoding="ascii").strip() for p in parts)
        expected = checksums[month]
        assert len(encoded) == expected["chars"], f"{month}: character length mismatch"
        digest = hashlib.sha256(encoded.encode("ascii")).hexdigest()
        assert digest == expected["sha256"], f"{month}: SHA-256 mismatch"
        raw = gzip.decompress(base64.b64decode(encoded, validate=True))
        for date, count in parse_month(raw, month):
            assert date not in reconstructed, f"Duplicate date: {date}"
            reconstructed[date] = count

    assert set(reconstructed) == set(summary), "Map dates and summary dates differ"
    mismatches = [(d, reconstructed[d], summary[d]["count"]) for d in summary if reconstructed[d] != summary[d]["count"]]
    assert not mismatches, f"Daily count mismatches: {mismatches[:5]}"

    dates = sorted(summary)
    start = dt.date.fromisoformat(meta["start_date"])
    end = dt.date.fromisoformat(meta["end_date"])
    expected_dates = [(start + dt.timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    assert dates == expected_dates, "Summary dates are not contiguous"
    assert sum(x["count"] for x in summary.values()) == meta["records"]

    peak_date = max(summary, key=lambda d: summary[d]["count"])
    assert peak_date == meta["peak_date"]
    assert summary[peak_date]["count"] == meta["peak_count"]

    monthly_counts = defaultdict(int)
    monthly_frp = defaultdict(float)
    for date, row in summary.items():
        monthly_counts[date[:7]] += row["count"]
        monthly_frp[date[:7]] += row["frp"]
    for row in meta["monthly"]:
        month = row["month"]
        assert monthly_counts[month] == row["count"], month
        assert abs(round(monthly_frp[month], 2) - row["frp_sum"]) <= 0.01, month

    print("QC PASS")
    print(f"Dates: {len(dates)} ({dates[0]} to {dates[-1]})")
    print(f"Detections: {meta['records']:,}")
    print(f"Peak: {meta['peak_date']} — {meta['peak_count']:,}")
    print(f"Months validated: {len(manifest)}")


if __name__ == "__main__":
    main()
