#!/usr/bin/env python3
"""
ETL script: downloads apartment snapshots from S3, builds per-apartment history,
outputs public/data.json for the web app.
"""

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import boto3

BUCKET = "domrf"
PREFIX = "dom/internal/logs/"
OUTPUT = Path(__file__).parent.parent / "public" / "data.json"
MAX_WORKERS = 32


def parse_timestamp(key: str) -> str:
    """Extract ISO timestamp from S3 key like 'dom/internal/logs/2023-07-10 12:00:15.623840.json'"""
    filename = key.split("/")[-1]
    ts_str = filename.replace(".json", "")
    # Normalize: '2023-07-10 12:00:15.623840' -> '2023-07-10T12:00:15.623840'
    ts_str = ts_str.replace(" ", "T")
    return ts_str


def normalize_entrance(entrance: str) -> str:
    """'1' and 'Б' are the same physical entrance."""
    return "main"


def download_file(s3_client, key: str) -> tuple[str, list[dict]]:
    """Download and parse a single S3 file. Returns (timestamp_iso, apartments_list)."""
    ts = parse_timestamp(key)
    try:
        response = s3_client.get_object(Bucket=BUCKET, Key=key)
        raw = response["Body"].read()
        data = json.loads(raw)
        raw_list = data.get("result", {}).get("list", [])
        # Each item has a nested "data" key containing the actual apartment fields
        apartments = [item.get("data", item) for item in raw_list if isinstance(item, dict)]
        return ts, apartments
    except Exception as e:
        print(f"  [WARN] Failed to parse {key}: {e}")
        return ts, []


def main():
    print("Connecting to S3...")
    s3 = boto3.client("s3")

    print(f"Listing objects in s3://{BUCKET}/{PREFIX} ...")
    keys = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if k.endswith(".json"):
                keys.append(k)

    print(f"Found {len(keys)} snapshot files.")

    print(f"Downloading with {MAX_WORKERS} workers...")
    snapshots: list[tuple[str, list[dict]]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(download_file, s3, k): k for k in keys}
        done = 0
        for future in as_completed(futures):
            ts, apts = future.result()
            snapshots.append((ts, apts))
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{len(keys)} downloaded...")

    # Sort by timestamp
    snapshots.sort(key=lambda x: x[0])
    print(f"Processed {len(snapshots)} snapshots.")

    # Build sorted timestamp list (all snapshots, including empties)
    snapshot_timestamps = [ts for ts, _ in snapshots]

    # Build per-apartment history
    # Key: apartment UUID -> apartment data + list of snapshot entries
    apt_map: dict[str, dict] = {}

    for ts, apartments in snapshots:
        for apt in apartments:
            apt_id = apt.get("id", "")
            if not apt_id:
                continue

            if apt_id not in apt_map:
                # First time we see this apartment — capture stable fields
                window_views = apt.get("windowViews", [])
                if isinstance(window_views, str):
                    window_views = [window_views]

                apt_map[apt_id] = {
                    "id": apt_id,
                    "number": str(apt.get("number", "")),
                    "floor": int(apt.get("floor", 0)),
                    "entrance": normalize_entrance(str(apt.get("entrance", "1"))),
                    "planningTitle": apt.get("planningTitle", ""),
                    "category": apt.get("category", ""),
                    "roomsNumber": int(apt.get("roomsNumber", 0)),
                    "areaFull": float(apt.get("areaFull", 0)),
                    "windowViews": window_views,
                    "snapshots": [],
                }

            # Track price/status per snapshot
            apt_map[apt_id]["snapshots"].append({
                "t": ts,
                "price": int((apt.get("rentPrice", 0) or 0) / 100),
                "bookingStatus": apt.get("bookingStatus", "none") or "none",
            })

    apartments_list = sorted(apt_map.values(), key=lambda a: (a["floor"], a["number"]))
    print(f"Total unique apartments: {len(apartments_list)}")

    output = {
        "snapshotTimestamps": snapshot_timestamps,
        "apartments": apartments_list,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    size_mb = OUTPUT.stat().st_size / 1024 / 1024
    print(f"Written {OUTPUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
