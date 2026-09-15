"""Import the catalogued next illustrations without changing source PNGs."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CONCEPT_ALTS = {
    'word-52': 'Оптический диск',
    'word-53': 'Карта игровой местности',
    'word-54': 'Игровой бот',
    'word-55': 'Игровой пульт',
    'word-56': 'Игровая консоль',
    'word-59': 'Компьютерная мышь',
    'word-60': 'Игровой картридж',
    'word-61': 'Разъём на корпусе устройства',
    'word-62': 'Гнездо для карты или игрового картриджа',
    'word-64': 'Электронная плата',
    'word-69': 'Строительный лом',
    'word-81': 'Бак для воды',
    'word-90': 'Строительный блок для игры или конструктора',
    'word-91': 'Ключ от замка',
    'word-93': 'Папка для бумажных листов',
    'word-95': 'Рома играет на консоли',
    'word-96': 'Рома ищет карту',
    'word-97': 'Мила протирает оконную раму',
    'word-98': 'Папа несёт сумку',
    'word-99': 'Игровой бот шагает',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    catalog_path = source / 'docs/ILLUSTRATION-ASSET-CATALOG.md'
    catalog = catalog_path.read_text(encoding='utf-8-sig')
    word_section = catalog.split('## 6. ')[1].split('## 7. ')[0]
    story_section = catalog.split('## 7. ')[1].split('## 8. ')[0]
    words = []
    for line in word_section.splitlines():
        match = re.match(r'\| `(word-\d+)` — \*\*(.*?)\*\* \| (.*?) \| (.*?) \| (.*?) \|', line)
        if match:
            identifier, target, files, description, status = match.groups()
            words.append(dict(id=identifier, target=target, description=description, status=status))
    stories = []
    for line in story_section.splitlines():
        match = re.match(r'\| `(story-[a-z-]+-\d+\.png)` \| (.*?) \| (.*?) \|', line)
        if match:
            filename, series, description = match.groups()
            stories.append(dict(filename=filename, series=series, description=description))
    assert len(words) == 53 and len(stories) == 30, 'Unexpected catalog coverage'
    assert {word['id'] for word in words} == {f'word-{n}' for n in range(47, 100)}
    jobs = []
    for word in words:
        for variant in ('main', 'alternate', 'context'):
            jobs.append(('words-47-99', f"{word['id']}-{variant}.png", (320, 640), (1024, 1024)))
    for story in stories:
        jobs.append(('stories', story['filename'], (560, 320, 1120), (1600, 900)))
    sources = []
    # Validate the complete input set before writing any output.
    for folder, filename, widths, expected in jobs:
        path = source / 'materials/illustrations/incoming' / folder / filename
        with Image.open(path) as picture:
            assert picture.format == 'PNG' and picture.size == expected, str(path)
            picture.verify()
        sources.append(dict(path=path.relative_to(source).as_posix(), bytes=path.stat().st_size, sha256=digest(path)))
    outputs = []
    for (folder, filename, widths, expected), origin in zip(jobs, sources):
        path = source / origin['path']
        with Image.open(path) as picture:
            picture = picture.convert('RGB')
            for width in widths:
                name = path.stem + ('' if width == widths[0] else f'-{width}w') + '.webp'
                destination = ROOT / 'public/illustrations' / folder / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                height = round(picture.height * width / picture.width)
                picture.resize((width, height), Image.Resampling.LANCZOS).save(destination, 'WEBP', quality=78, method=6)
                with Image.open(destination) as result:
                    assert result.format == 'WEBP' and result.size == (width, height)
                    result.verify()
                outputs.append(dict(src=destination.relative_to(ROOT / 'public').as_posix(), width=width, height=height, bytes=destination.stat().st_size, sha256=digest(destination), source=origin['path']))
        assert digest(path) == origin['sha256'], f'Source changed: {path}'
    illustrations = {}
    word_map = {}
    sources_map = {}
    story_sources = {}
    frames = {}
    for word in words:
        variants = {}
        # Alt names use the exact concept from the catalogue. The full supplied
        # descriptions remain in the import manifest, including homonym rules.
        for variant in ('main', 'alternate', 'context'):
            stem = f"illustrations/words-47-99/{word['id']}-{variant}"
            alt = CONCEPT_ALTS.get(word['id'], word['target'].capitalize())
            variants[variant] = dict(src=stem + '.webp', alt=alt, width=320, height=320)
            sources_map[stem + '.webp'] = f'{stem}.webp 320w, {stem}-640w.webp 640w'
        illustrations[word['id']] = dict(target=word['target'].lower(), variants=variants)
        word_map[word['target']] = word['id']
    for story in stories:
        stem = 'illustrations/stories/' + Path(story['filename']).stem
        story_sources[stem + '.webp'] = f'{stem}-320w.webp 320w, {stem}.webp 560w, {stem}-1120w.webp 1120w'
        series_id = re.sub(r'-\d+\.png$', '', story['filename'])
        alt = story['description'].split('. ')[0].rstrip('.') + '.'
        frames.setdefault(series_id, []).append(dict(src=stem + '.webp', alt=alt, width=560, height=315))
    def export(name, value, annotation=''):
        return f'export const {name}{annotation} = ' + json.dumps(value, ensure_ascii=False, indent=2) + ';\n'
    (ROOT / 'content/next-illustrations.ts').write_text(
        '// Generated from the supplied illustration catalogue.\n' + export('nextIllustrations', illustrations)
        + '\n' + export('nextWordIllustrations', word_map, ': Record<string, keyof typeof nextIllustrations>')
        + '\n' + export('nextStoryFrames', frames), encoding='utf-8')
    (ROOT / 'content/next-illustration-sources.ts').write_text(
        export('nextIllustrationSources', sources_map, ': Record<string, string>') + '\n'
        + export('nextStorySources', story_sources, ': Record<string, string>'), encoding='utf-8')
    report = dict(catalog='docs/ILLUSTRATION-ASSET-CATALOG.md', catalogSha256=digest(catalog_path),
                  sourceProject='C:/work/app/reading-app', words=words, stories=stories,
                  verification=dict(sourceCount=len(sources), outputCount=len(outputs), allPngVerified=True,
                                    allWebpVerified=True, sourceHashesUnchanged=True, crops=False),
                  sources=sources, images=outputs)
    (ROOT / 'docs/NEXT-ILLUSTRATIONS-IMPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(sources)} PNG verified; {len(outputs)} WebP; {sum(item["bytes"] for item in outputs)} bytes')


if __name__ == '__main__':
    main()
