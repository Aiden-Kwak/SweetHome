"""Package the original pitch renders and extract accessible text from the PPTX."""

import hashlib
import argparse
import json
import posixpath
import shutil
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/presentation/SweetHome_final_pitch_v3_EN.pptx"
PREVIEWS = ROOT / ".presentation-build/sweethome-previews"
DEST = ROOT / "apps/web/public/pitch"
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def paragraphs(xml: bytes) -> list[str]:
    return [
        text
        for p in ET.fromstring(xml).findall(".//a:p", NS)
        if (text := "".join(t.text or "" for t in p.findall(".//a:t", NS)))
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--previews', type=Path, default=PREVIEWS)
    parser.add_argument('--pdf', type=Path, help='Matching PPTX PDF export for vector slide images')
    args = parser.parse_args()
    source, previews = args.source, args.previews
    with ZipFile(source) as package:
        rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(package.read('ppt/_rels/presentation.xml.rels'))}
        presentation = ET.fromstring(package.read('ppt/presentation.xml'))
        names = [posixpath.normpath(posixpath.join('ppt', rels[node.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]))
                 for node in presentation.findall('.//{http://schemas.openxmlformats.org/presentationml/2006/main}sldId')]
        slides = []
        for i, name in enumerate(names, 1):
            image = f"slide-{i:02d}.png"
            if not (previews / image).is_file():
                raise FileNotFoundError(f"Original deck render is missing: {image}")
            text = paragraphs(package.read(name))
            rel_path = posixpath.join(posixpath.dirname(name), '_rels', posixpath.basename(name) + '.rels')
            notes = []
            if rel_path in package.namelist():
                for rel in ET.fromstring(package.read(rel_path)):
                    if rel.get('Type', '').endswith('/notesSlide'):
                        note_path = posixpath.normpath(posixpath.join(posixpath.dirname(name), rel.get('Target')))
                        notes = paragraphs(package.read(note_path))
            title = next((line for line in text if len(line) > 25 and not line.startswith('SweetHome |')), text[0])
            if i == 1:
                title = 'SweetHome: Housing policy simulation for lawmakers'
            thumbnail = image
            if args.pdf:
                image = f"slide-{i:02d}.svg"
                subprocess.run(['pdftocairo', '-svg', '-f', str(i), '-l', str(i), str(args.pdf), str(previews / image)], check=True)
            slides.append({"title": title, "image": f"slides/{image}", "thumbnail": f"slides/{thumbnail}", "text": text, "notes": notes})
    (DEST / "slides").mkdir(parents=True, exist_ok=True)
    for slide in slides:
        shutil.copy2(previews / Path(slide["image"]).name, DEST / slide["image"])
        if slide['thumbnail'] != slide['image']:
            shutil.copy2(previews / Path(slide['thumbnail']).name, DEST / slide['thumbnail'])
    shutil.copy2(source, DEST / source.name)
    manifest = {"source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "slides": slides}
    (DEST / "deck.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(slides)} slides to {DEST}")


if __name__ == "__main__":
    main()
