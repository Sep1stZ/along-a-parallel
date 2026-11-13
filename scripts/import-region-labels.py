"""Build readable Chinese admin1 labels from the already pinned GeoNames snapshot.

Python 3 standard library only; never downloads or changes the place catalogue.
Run: python scripts/import-region-labels.py
Data: GeoNames contributors, CC BY 4.0. Unknown translations keep source names.
"""
from pathlib import Path
import csv
import hashlib
import io
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.data' / 'catalog-source' / '2026-11-11'
source_report = json.loads((ROOT / 'src/data/catalog-report.json').read_text(encoding='utf-8'))
source_hashes = {}
for filename in ('admin1CodesASCII.txt', 'alternateNamesV2.zip'):
    with (CACHE / filename).open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    pinned = next(item for item in source_report['sources'] if item['file'] == filename)
    if digest != pinned['sha256']:
        raise ValueError(f'{filename} changed from the pinned catalogue snapshot')
    source_hashes[filename] = digest
catalog = json.loads((ROOT / 'src/data/catalog-data.json').read_text(encoding='utf-8'))
used = {(row[4], row[8]) for row in catalog['records'] if row[8]}
regions = {}
for row in csv.reader((CACHE / 'admin1CodesASCII.txt').open(encoding='utf-8'), delimiter='\t'):
    if len(row) >= 4 and (row[0].split('.')[0], row[1]) in used:
        regions[int(row[3])] = {'countryCode': row[0].split('.')[0], 'name': row[1], 'chinese': []}
with zipfile.ZipFile(CACHE / 'alternateNamesV2.zip') as archive:
    with io.TextIOWrapper(archive.open('alternateNamesV2.txt'), encoding='utf-8') as stream:
        for line in stream:
            row = line.rstrip('\r\n').split('\t')
            region = regions.get(int(row[1])) if len(row) >= 10 else None
            if not region or not row[2].lower().startswith('zh') or row[6] == '1' or row[7] == '1' or row[9] or not row[3].strip():
                continue
            language = row[2].lower()
            if language != 'zh' and not language.startswith(('zh-', 'zh_')):
                continue
            priority = {'zh-hans': 40, 'zh-cn': 35, 'zh': 30, 'zh-sg': 25}.get(language, 10)
            region['chinese'].append((priority + (2 if row[4] == '1' else 0), -int(row[0]), row[3].strip()))
labels = {}
translated = 0
for region in regions.values():
    candidates = sorted(region['chinese'], reverse=True)
    chinese = candidates[0][2] if candidates else region['name']
    translated += bool(candidates)
    labels[f"{region['countryCode']}|{region['name']}"] = chinese
report = {
    'version': 'geonames-admin1-zh-2026-11-11',
    'accessedAt': '2026-11-11',
    'license': 'CC BY 4.0',
    'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
    'sourceUrl': 'https://download.geonames.org/export/dump/alternateNamesV2.zip',
    'sourceSha256': source_hashes['alternateNamesV2.zip'],
    'sourceHashes': source_hashes,
    'regions': len(labels),
    'translated': translated,
    'labels': dict(sorted(labels.items())),
}
output = ROOT / 'src/data/catalog-regions.json'
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'{len(labels)} readable regions; {translated} have language-tagged Chinese labels; {output.stat().st_size} bytes')
