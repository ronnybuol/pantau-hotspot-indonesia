#!/usr/bin/env python3
"""Preprocess NASA FIRMS VIIRS JSON into compact monthly web data.

Usage:
  python scripts/process_firms.py /path/to/fire_nrt.json --output data
"""
import argparse
import base64
import collections
import gzip
import json
import math
from pathlib import Path

GRID = 0.05
PERSISTENT_DAYS = 60


def center(value: float, grid: float) -> float:
    return round(math.floor(value / grid) * grid + grid / 2, 5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--output", type=Path, default=Path("data"))
    ap.add_argument("--grid", type=float, default=GRID)
    args = ap.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    with args.input.open(encoding="utf-8") as fh:
        rows = json.load(fh)

    daily = collections.defaultdict(lambda: {
        "count": 0, "frp_sum": 0.0, "frp_max": 0.0,
        "conf": collections.Counter(), "dn": collections.Counter(), "cells": {}
    })

    for row in rows:
        date = row["acq_date"]
        d = daily[date]
        d["count"] += 1
        frp = float(row.get("frp") or 0)
        d["frp_sum"] += frp
        d["frp_max"] = max(d["frp_max"], frp)
        confidence = row.get("confidence", "?")
        daynight = row.get("daynight", "?")
        d["conf"][confidence] += 1
        d["dn"][daynight] += 1

        lat = center(float(row["latitude"]), args.grid)
        lon = center(float(row["longitude"]), args.grid)
        key = (lat, lon)
        cell = d["cells"].setdefault(key, {
            "lat": lat, "lon": lon, "count": 0, "frp_sum": 0.0, "frp_max": 0.0,
            "nD": 0, "nN": 0, "lD": 0, "lN": 0, "hD": 0, "hN": 0
        })
        cell["count"] += 1
        cell["frp_sum"] += frp
        cell["frp_max"] = max(cell["frp_max"], frp)
        cross = f"{confidence}{daynight}"
        if cross in cell:
            cell[cross] += 1

    persistence = collections.Counter()
    for d in daily.values():
        for key in d["cells"]:
            persistence[key] += 1

    summary = []
    month_days = collections.defaultdict(list)
    for date in sorted(daily):
        d = daily[date]
        summary.append({
            "date": date, "count": d["count"], "frp_sum": round(d["frp_sum"], 2),
            "frp_max": round(d["frp_max"], 2),
            "confidence": {k: d["conf"][k] for k in ("n", "l", "h")},
            "daynight": {k: d["dn"][k] for k in ("D", "N")},
            "grid_cells": len(d["cells"])
        })
        cells = []
        for key, cell in d["cells"].items():
            out = dict(cell)
            out["frp_sum"] = round(out["frp_sum"], 2)
            out["frp_max"] = round(out["frp_max"], 2)
            out["active_days_2026"] = persistence[key]
            cells.append(out)
        cells.sort(key=lambda x: (x["lat"], x["lon"]))
        month_days[date[:7]].append({
            "date": date, "grid_deg": args.grid, "detections": d["count"], "cells": cells
        })

    monthly = collections.defaultdict(lambda: {"count": 0, "frp_sum": 0.0, "days": 0})
    for item in summary:
        m = item["date"][:7]
        monthly[m]["count"] += item["count"]
        monthly[m]["frp_sum"] += item["frp_sum"]
        monthly[m]["days"] += 1
    monthly_out = [
        {"month": m, "count": v["count"], "frp_sum": round(v["frp_sum"], 2),
         "days": v["days"], "avg_per_day": round(v["count"] / v["days"], 1)}
        for m, v in sorted(monthly.items())
    ]

    peak = max(summary, key=lambda x: x["count"])
    meta = {
        "title": "Deteksi Hotspot Indonesia 2026",
        "source": "NASA FIRMS VIIRS NOAA-21 (N21), 2.0NRT",
        "records": len(rows), "start_date": summary[0]["date"], "end_date": summary[-1]["date"],
        "grid_deg": args.grid, "peak_date": peak["date"], "peak_count": peak["count"],
        "persistent_threshold_days": PERSISTENT_DAYS, "monthly": monthly_out
    }

    (args.output / "months").mkdir(exist_ok=True)
    (args.output / "months-b64").mkdir(exist_ok=True)
    (args.output / "months-compact-b64").mkdir(exist_ok=True)
    summary_payload = json.dumps(summary, separators=(",", ":"), ensure_ascii=False)
    (args.output / "summary.json").write_text(summary_payload, encoding="utf-8")
    summary_gz = gzip.compress(summary_payload.encode("utf-8"), compresslevel=9, mtime=0)
    (args.output / "summary.json.gz.b64").write_text(base64.b64encode(summary_gz).decode("ascii"), encoding="ascii")
    (args.output / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    for month, days in month_days.items():
        payload = json.dumps({"month": month, "days": days}, separators=(",", ":"), ensure_ascii=False)
        (args.output / "months" / f"{month}.json").write_text(payload, encoding="utf-8")
        compressed = gzip.compress(payload.encode("utf-8"), compresslevel=9, mtime=0)
        encoded = base64.b64encode(compressed).decode("ascii")
        (args.output / "months-b64" / f"{month}.json.gz.b64").write_text(encoded, encoding="ascii")

        # Compact payload for production web: only fields used by the map.
        compact_days = []
        for day in days:
            compact_cells = [
                [round(c["lat"] * 1000), round(c["lon"] * 1000), c["count"],
                 round(c["frp_sum"] * 100), round(c["frp_max"] * 100), c["active_days_2026"]]
                for c in day["cells"]
            ]
            compact_days.append([day["date"], compact_cells])
        compact_payload = json.dumps({"m": month, "d": compact_days}, separators=(",", ":"), ensure_ascii=False)
        compact_gz = gzip.compress(compact_payload.encode("utf-8"), compresslevel=9, mtime=0)
        compact_b64 = base64.b64encode(compact_gz).decode("ascii")
        (args.output / "months-compact-b64" / f"{month}.json.gz.b64").write_text(compact_b64, encoding="ascii")

    print(f"Processed {len(rows):,} records across {len(summary)} days")
    print(f"Peak: {peak['date']} — {peak['count']:,} detections")


if __name__ == "__main__":
    main()
