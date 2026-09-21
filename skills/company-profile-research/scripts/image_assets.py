#!/usr/bin/env python3
"""Deterministic image-asset fetch/validation for company-profile-research.

Deliberately requires NO image-input capability. It catches the failure modes
that otherwise tempt you to "just look at the image":

  * a truncated download, or an HTML error page saved with an image extension
  * a blank or near-uniform image -- e.g. a solid-colour social banner
  * a logo that is invisible on a light (or dark) background because the file
    is a dark (or light) mark on transparency
  * an image too small to be a usable avatar or logo

Modes:
  fetch   Download a logo per "slug=domain" pair, falling back from logo.dev to
          public favicon services, validating every candidate before keeping it.
  check   Validate one or more existing image files and print an actionable
          verdict for each.

Examples:
  python image_assets.py fetch accel=accel.com gv=gv.com --dest public/investors
  python image_assets.py check public/investors/*.png
  python image_assets.py check public/companies/*/images/*.png --json

Exit codes: 0 = every asset passed, 1 = at least one failed, 2 = usage error.

`check --contact-sheet OUT.png` additionally writes a labelled grid you can view
if the active model accepts image input. That is an optional convenience only;
the text verdicts are the actual gate and must be read either way.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

MIN_DIM = 32
BLANK_STDDEV = 2.0      # below this the surface is uniform: reject
MARGINAL_STDDEV = 12.0  # below this a mark is effectively invisible on that bg
ANALYSIS_MAX = 400  # downscale before statistics; keeps this fast on large banners

try:
    from PIL import Image, ImageDraw, ImageStat
    HAVE_PIL = True
except ImportError:  # pragma: no cover - degraded mode
    HAVE_PIL = False


def _downscaled_rgba(im):
    im = im.convert("RGBA")
    w, h = im.size
    if max(w, h) > ANALYSIS_MAX:
        scale = ANALYSIS_MAX / float(max(w, h))
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
    return im


def _stddev(im, bg):
    """Luminance stddev of `im` composited onto `bg`. Low => uniform surface."""
    canvas = Image.new("RGBA", im.size, bg)
    canvas.alpha_composite(im)
    stats = ImageStat.Stat(canvas.convert("L"))
    return stats.stddev[0], stats.mean[0]


def classify(path):
    """Return a dict verdict for one file. Never raises."""
    out = {"path": path, "status": "INVALID", "detail": "", "width": None,
           "height": None, "bytes": None, "visible_on_white": None,
           "visible_on_black": None}

    if not os.path.exists(path):
        out["detail"] = "file does not exist"
        return out
    out["bytes"] = os.path.getsize(path)
    if out["bytes"] == 0:
        out["detail"] = "zero-byte file"
        return out

    if not HAVE_PIL:
        # Degraded mode: without Pillow we can only sanity-check the container.
        try:
            desc = subprocess.run(["file", "-b", path], capture_output=True,
                                  text=True, timeout=20).stdout.strip()
        except Exception as exc:
            out["detail"] = f"file(1) failed: {exc}"
            return out
        if not any(t in desc.lower() for t in ("image", "png", "jpeg", "gif", "webp")):
            out["detail"] = f"not an image container: {desc[:60]}"
            return out
        out["status"] = "UNVERIFIED"
        out["detail"] = ("Pillow unavailable; container is an image but blank/"
                         "contrast checks were SKIPPED. Install Pillow to verify.")
        return out

    try:
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            w, h = im.size
            out["width"], out["height"] = w, h
            if w < MIN_DIM or h < MIN_DIM:
                out["detail"] = f"too small ({w}x{h}, minimum {MIN_DIM}px)"
                return out
            small = _downscaled_rgba(im)
    except Exception as exc:
        out["detail"] = f"cannot decode: {type(exc).__name__}: {exc}"
        return out

    white_sd, white_mean = _stddev(small, (255, 255, 255, 255))
    black_sd, black_mean = _stddev(small, (0, 0, 0, 255))

    out["visible_on_white"] = white_sd >= MARGINAL_STDDEV
    out["visible_on_black"] = black_sd >= MARGINAL_STDDEV

    best, worst = max(white_sd, black_sd), min(white_sd, black_sd)

    if best < BLANK_STDDEV:
        out["status"] = "BLANK"
        out["detail"] = (f"near-uniform on both backgrounds "
                         f"(stddev {white_sd:.2f}/{black_sd:.2f}); reject and "
                         f"re-source this asset")
    elif worst < MARGINAL_STDDEV:
        # One-sided: a single-polarity mark on transparency. Actionable, not fatal.
        if white_sd > black_sd:
            out["status"] = "OK_LIGHT_BG_ONLY"
            out["detail"] = ("dark mark on transparency: render on a LIGHT background "
                             "(do NOT flatten alpha onto black, it vanishes)")
        else:
            out["status"] = "OK_DARK_BG_ONLY"
            out["detail"] = ("light mark on transparency: render on a DARK background "
                             "(do NOT flatten alpha onto white, it vanishes)")
    else:
        out["status"] = "OK"
        out["detail"] = f"visible on light and dark (stddev {white_sd:.1f}/{black_sd:.1f})"
    return out


def fetch_one(slug, domain, dest, token, min_dim=MIN_DIM):
    """Try logo.dev then favicon services. Returns (path, source) or (None, None)."""
    os.makedirs(dest, exist_ok=True)

    for existing in sorted(os.listdir(dest)):
        if existing.startswith(slug + "."):
            path = os.path.join(dest, existing)
            verdict = classify(path)
            if verdict["status"].startswith("OK"):
                return path, f"reused existing ({existing})", verdict
            print(f"  ! existing {existing} failed checks "
                  f"({verdict['status']}); re-downloading", file=sys.stderr)

    candidates = []
    if token:
        candidates.append((
            "logo.dev",
            f"https://img.logo.dev/{domain}?token={token}&size=256&retina=true&format=png",
        ))
    candidates += [
        ("favicon(ddg)", f"https://icons.duckduckgo.com/ip3/{domain}.ico"),
        ("favicon(google)", f"https://www.google.com/s2/favicons?domain={domain}&sz=256"),
    ]

    for source, url in candidates:
        path = os.path.join(dest, f"{slug}.png")
        try:
            subprocess.run(["curl", "-sL", "--fail", "--max-time", "30", url, "-o", path],
                           check=True, capture_output=True)
        except Exception:
            if os.path.exists(path):
                os.remove(path)
            continue
        verdict = classify(path)
        if verdict["status"].startswith("OK"):
            return path, source, verdict
        if os.path.exists(path):
            os.remove(path)

    return None, None, None


def write_contact_sheet(items, out_path):
    """Optional grid for models that DO accept image input."""
    if not HAVE_PIL:
        print("contact sheet skipped: Pillow unavailable", file=sys.stderr)
        return
    cell = 170
    cols = min(4, max(1, len(items)))
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (235, 235, 238))
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(items):
        try:
            im = Image.open(path).convert("RGBA")
        except Exception:
            continue
        im.thumbnail((cell - 20, cell - 20))
        bg = Image.new("RGBA", (cell - 20, cell - 20), (255, 255, 255, 255))
        bg.alpha_composite(im, ((cell - 20 - im.size[0]) // 2,
                                (cell - 20 - im.size[1]) // 2))
        x, y = (i % cols) * cell + 10, (i // cols) * (cell + 18) + 10
        sheet.paste(bg.convert("RGB"), (x, y))
        draw.text((x, y + cell - 14), os.path.basename(path), fill="black")
    sheet.save(out_path)
    print(f"contact sheet written: {out_path} (view only if you accept image input)")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="mode", required=True)

    f = sub.add_parser("fetch", help="download logos for slug=domain pairs")
    f.add_argument("pairs", nargs="+", metavar="slug=domain")
    f.add_argument("--dest", default="public/investors")
    f.add_argument("--token", default=os.environ.get("LOGO_DEV_TOKEN", ""))
    f.add_argument("--contact-sheet", default=None, metavar="OUT.png")

    c = sub.add_parser("check", help="validate existing image files")
    c.add_argument("paths", nargs="+")
    c.add_argument("--json", action="store_true", help="emit machine-readable results")
    c.add_argument("--contact-sheet", default=None, metavar="OUT.png")

    args = ap.parse_args(argv)

    if not HAVE_PIL:
        print("WARNING: Pillow not installed. Blank/contrast checks are DISABLED; "
              "results will be UNVERIFIED. Install pillow for real verification.\n",
              file=sys.stderr)

    if args.mode == "fetch":
        failures = 0
        results = []
        for pair in args.pairs:
            if "=" not in pair:
                print(f"  ! skipping malformed pair {pair!r}", file=sys.stderr)
                failures += 1
                continue
            slug, domain = pair.split("=", 1)
            path, source, verdict = fetch_one(slug, domain, args.dest, args.token)
            if path:
                warn = ""
                if source.startswith("favicon") and max(verdict["width"], verdict["height"]) <= 64:
                    warn = "  [low-res fallback: pass --token / LOGO_DEV_TOKEN for a proper logo]"
                print(f"OK    {slug:<24} {source:<28} "
                      f"{verdict['width']}x{verdict['height']}  {verdict['status']}{warn}")
                results.append(verdict)
            else:
                print(f"FAIL  {slug:<24} {domain}")
                failures += 1
        if args.contact_sheet and results:
            write_contact_sheet([r["path"] for r in results], args.contact_sheet)
        print(f"\n{len(results)} fetched, {failures} failed")
        return 1 if failures else 0

    verdicts = [classify(p) for p in args.paths]
    if args.json:
        print(json.dumps(verdicts, indent=2))
    else:
        for v in verdicts:
            name = os.path.basename(v["path"])
            dim = f"{v['width']}x{v['height']}" if v["width"] else "-"
            print(f"{v['status']:<19} {name:<32} {dim:<12} {v['detail']}")

    bad = [v for v in verdicts if v["status"] in ("INVALID", "BLANK", "UNVERIFIED")]
    if args.contact_sheet:
        write_contact_sheet([v["path"] for v in verdicts], args.contact_sheet)

    print(f"\n{len(verdicts) - len(bad)}/{len(verdicts)} passed")
    if bad:
        print("FAILURES:", ", ".join(os.path.basename(v["path"]) for v in bad))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
