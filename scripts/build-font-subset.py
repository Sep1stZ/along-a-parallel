"""Rebuild the local OFL font: Python + fontTools[woff] required.

Usage: python scripts/build-font-subset.py /path/to/NotoSansSC-wght.ttf
The pinned upstream file is intentionally not vendored (17 MB).
"""
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
expected = "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise SystemExit("Unexpected upstream font SHA-256; verify provenance before updating.")
characters = set()
for path in (root / "src").rglob("*"):
    if path.suffix in {".tsx", ".ts", ".css", ".json"}:
        characters.update(path.read_text(encoding="utf-8"))
font = TTFont(source)
original_map = font.getBestCmap()
requested = {ord(c) for c in characters} | set(range(0x20, 0x250)) | set(range(0x2000, 0x2070))
supported = requested.intersection(original_map)
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
options.name_legacy = True
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=supported)
subsetter.subset(font)
font = instantiateVariableFont(font, {"wght": (400, 400, 700)}, inplace=True)
for record in font["name"].names:
    if record.nameID in {1, 4, 16}:
        record.string = "Parallel Sans SC".encode(record.getEncoding())
    elif record.nameID == 6:
        record.string = "ParallelSansSC-Regular".encode(record.getEncoding())
    elif record.nameID == 3:
        record.string = "Parallel Sans SC; 2.004; subset".encode(record.getEncoding())
font.flavor = "woff2"
output = root / "public/fonts/noto-sans-sc-latin-cjk.woff2"
font.save(output)
checked = TTFont(output)
missing_cjk = [c for c in characters if 0x3400 <= ord(c) <= 0x9FFF and ord(c) not in checked.getBestCmap()]
if missing_cjk:
    raise SystemExit(f"Missing Chinese characters: {''.join(sorted(missing_cjk))}")
info = {
    "family": "Parallel Sans SC", "derivedFrom": "Noto Sans SC",
    "fontVersion": "Version 2.004-H2", "file": output.name,
    "cssWeightRange": "400 700", "unicodeCount": len(checked.getBestCmap()),
    "sourceCharacterCount": len(characters),
    "axes": [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue} for a in checked["fvar"].axes],
    "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "sourceSha256": expected,
    "fallbackRequiredForActualText": sorted(c for c in characters if ord(c) > 0x20 and ord(c) not in checked.getBestCmap()),
    "generatedAt": str(date.today()),
    "note": "Subset includes the complete local catalog and current UI/editorial copy. Chinese glyph coverage verified. Other scripts use system font fallbacks. Rebuild with scripts/build-font-subset.py after content changes.",
}
(output.parent / "subset-info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: info[k] for k in ["unicodeCount", "bytes", "sha256"]}))
