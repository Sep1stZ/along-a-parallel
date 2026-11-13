"""Safely extract Chinese lead paragraphs from cached Wikimedia Parsoid HTML.

Run after the Node downloader: python -X utf8 scripts/extract-city-articles.py
Uses Python's HTML tokenizer, so quoted attributes and nested tables cannot leak
template JSON/CSS into prose. Raw HTML stays under ignored .data/.
"""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.data' / 'city-articles' / '2026-11-13'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
SKIP = {'table', 'figure', 'style', 'script', 'sup', 'aside', 'noscript'}


class LeadParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_lead = False
        self.sections = 0
        self.frames = []
        self.skipped = 0
        self.current = None
        self.paragraphs = []

    def flush(self):
        if self.current is not None:
            text = re.sub(r'\s+', ' ', ''.join(self.current)).strip()
            text = re.sub(r'\[\d+(?:,\s*\d+)*\]', '', text)
            if len(text) >= 35 and re.search(r'[\u3400-\u9fff]', text):
                self.paragraphs.append(text)
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'section':
            if not self.in_lead and attrs.get('data-mw-section-id') == '0':
                self.in_lead = True
                self.sections = 0
            if self.in_lead:
                self.sections += 1
        if not self.in_lead:
            return
        hidden = bool(re.search(r'display\s*:\s*none', attrs.get('style', ''), re.I))
        skip = tag in SKIP or hidden
        if tag == 'p' and self.skipped == 0 and not skip:
            self.flush()
            self.current = []
        if tag in VOID:
            if tag == 'br' and self.current is not None and self.skipped == 0:
                self.current.append(' ')
            return
        self.frames.append((tag, skip))
        self.skipped += int(skip)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.in_lead:
            return
        if tag == 'p' and self.skipped == 0:
            self.flush()
        for position in range(len(self.frames) - 1, -1, -1):
            if self.frames[position][0] == tag:
                self.skipped -= sum(int(skip) for _, skip in self.frames[position:])
                self.frames = self.frames[:position]
                break
        if tag == 'section':
            self.sections -= 1
            if self.sections <= 0:
                self.flush()
                self.in_lead = False
                self.frames = []
                self.skipped = 0

    def handle_data(self, data):
        if self.in_lead and self.current is not None and self.skipped == 0:
            self.current.append(data)


def extract_lead(html):
    parser = LeadParser()
    parser.feed(html)
    parser.close()
    parser.flush()
    return parser.paragraphs


def main():
    candidate_file = CACHE / 'candidates.json'
    candidates = json.loads(candidate_file.read_text(encoding='utf-8'))
    accepted = []
    failures = []
    for candidate in candidates:
        source = json.loads((CACHE / f"{candidate['geonamesId']}.json").read_text(encoding='utf-8'))
        paragraphs = extract_lead(source['html'])
        if not paragraphs:
            failures.append({'geonamesId': candidate['geonamesId'], 'title': source['title'], 'error': 'No readable lead paragraphs'})
            continue
        accepted.append({**candidate, 'paragraphs': paragraphs})
    candidate_file.write_text(json.dumps(accepted, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (CACHE / 'extraction-failures.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Safely extracted {len(accepted)} leads; {len(failures)} have no readable lead.")


if __name__ == '__main__':
    main()
