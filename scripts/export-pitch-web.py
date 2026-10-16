"""Package the original pitch renders and extract accessible text from the PPTX."""

import hashlib
import json
import re
import shutil
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/presentation/PolicyMap_final_pitch_v1.pptx"
PREVIEWS = ROOT / ".presentation-build/previews"
DEST = ROOT / "apps/web/public/pitch"
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def paragraphs(xml: bytes) -> list[str]:
    return [
        text
        for p in ET.fromstring(xml).findall(".//a:p", NS)
        if (text := "".join(t.text or "" for t in p.findall(".//a:t", NS)))
    ]


def main() -> None:
    with ZipFile(SOURCE) as package:
        names = sorted(
            (name for name in package.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda name: int(re.search(r"slide(\d+)\.xml", name)[1]),
        )
        slides = []
        for i, name in enumerate(names, 1):
            image = f"slide-{i:02d}.png"
            if not (PREVIEWS / image).is_file():
                raise FileNotFoundError(f"Original deck render is missing: {image}")
            text = paragraphs(package.read(name))
            note_path = f"ppt/notesSlides/notesSlide{i}.xml"
            notes = paragraphs(package.read(note_path)) if note_path in package.namelist() else []
            title = text[1] if i not in (1, 10) else (
                "PolicyMap: 부동산 정책 시행 전 영향 시뮬레이션" if i == 1 else "정책 시행 전에 직접효과와 부작용을 함께 검토한다"
            )
            slides.append({"title": title, "image": f"slides/{image}", "text": text, "notes": notes})
    (DEST / "slides").mkdir(parents=True, exist_ok=True)
    for slide in slides:
        shutil.copy2(PREVIEWS / Path(slide["image"]).name, DEST / slide["image"])
    shutil.copy2(SOURCE, DEST / SOURCE.name)
    manifest = {"source": SOURCE.name, "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "slides": slides}
    (DEST / "deck.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(slides)} slides to {DEST}")


if __name__ == "__main__":
    main()
