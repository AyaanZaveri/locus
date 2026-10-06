#!/usr/bin/env python3
"""Generate the local CSC population enrichment from GeoNames (no runtime API).

Run from any directory: python3 scripts/generate-city-populations.py
Optional --archive PATH reuses an already downloaded cities500.zip.
Only same-country name/alias matches within 10 km are accepted. Unmatched
places remain in the catalog with unknown population; they are never removed.
"""

import argparse
import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import unicodedata
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://download.geonames.org/export/dump/cities500.zip"
MAX_DISTANCE_KM = 10


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c)).lower().strip()


def distance_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(a)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    # CSC 3.x ships compressed rows: name, country, state, latitude, longitude.
    cities = json.loads((ROOT / "node_modules/country-state-city/lib/assets/city.json").read_text())
    if not cities or not all(isinstance(city, list) and len(city) == 5 for city in cities):
        raise ValueError("Unexpected country-state-city dataset format; inspect the installed version before regenerating.")
    wanted = {(city[1], normalize(city[0])) for city in cities}
    if args.archive:
        archive = args.archive.read_bytes()
    else:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "Locus-city-population-generator/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response:
            archive = response.read()
    candidates = {}
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        with zipped.open("cities500.txt") as raw:
            for line in io.TextIOWrapper(raw, encoding="utf-8"):
                fields = line.rstrip("\n").split("\t")
                if len(fields) != 19:
                    raise ValueError("Unexpected GeoNames column count")
                population = int(fields[14])
                if fields[6] != "P" or population <= 0:
                    continue
                record = (int(fields[0]), float(fields[4]), float(fields[5]), population)
                names = {normalize(name) for name in [fields[1], fields[2], *fields[3].split(",")] if name}
                for name in names:
                    key = (fields[8], name)
                    if key in wanted:
                        candidates.setdefault(key, []).append(record)
    populations = {}
    for name, country, state, latitude, longitude in cities:
        if not latitude or not longitude:
            continue
        ranked = sorted((distance_km(float(latitude), float(longitude), lat, lon), geoid, pop)
                        for geoid, lat, lon, pop in candidates.get((country, normalize(name)), []))
        if ranked and ranked[0][0] <= MAX_DISTANCE_KM:
            populations[f"{country}:{state}:{name}"] = ranked[0][2]
    if len(populations) < len(cities) / 2:
        raise ValueError(f"Unexpectedly low match coverage ({len(populations)}/{len(cities)}); refusing to replace the lookup.")
    payload = {
        "source": SOURCE,
        "attribution": "GeoNames, CC BY 4.0, https://www.geonames.org/",
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sourceSha256": hashlib.sha256(archive).hexdigest(),
        "matching": "Same country and normalized city name/alias; nearest coordinate within 10 km. Unknown populations are omitted.",
        "populations": dict(sorted(populations.items())),
    }
    output = ROOT / "data/locations/city-populations.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(output), "cities": len(cities), "matched": len(populations), "bytes": output.stat().st_size}))


if __name__ == "__main__":
    main()
