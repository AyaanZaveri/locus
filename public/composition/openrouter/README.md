# OpenRouter composed banner

Recreation kit for the OpenRouter banner originally used at
`public/companies/openrouter/images/composed_banner.png` (the current live
banner is now `banner.jpg`, the official X/Twitter cover).

Everything here is reproducible from `compose.py`; the wordmark is the only
external asset.

## Files

- `compose.py` — generates the banner SVG (and optionally the PNG).
- `wordmark-cloud.svg` — OpenRouter's official white horizontal wordmark, from
  `https://openrouter.ai/brand/logos/transparent/horizontal/svg/horizontal-cloud.svg`.
- `openrouter-composed-banner.svg` — the generated vector output.
- `regenerate.sh` — rebuilds the SVG here and the PNG into the company images
  folder in one step.

## Rebuild

```sh
sh regenerate.sh
```

Or manually:

```sh
python3 compose.py --png ../../companies/openrouter/images/composed_banner.png
```

PNG output requires `rsvg-convert` (librsvg), e.g. `brew install librsvg`.

## Design

- 2400×1200 (2:1), background `#0A0A0C`.
- Motif: outlined circles/squares/triangles on a 140px grid; each cell's shape
  is `(row*5 + col*3) % 3`, odd rows offset by half a cell.
- Radial purple glow (`#7C3AED` → `#5B21B6` → transparent) behind the wordmark.
- Vertical vignette fading the top and bottom edges into the background.
- Wordmark centred at 980px wide. All tokens live at the top of `compose.py`.

This is a synthetic composition (invented motif and gradients), not an official
OpenRouter-produced image.
