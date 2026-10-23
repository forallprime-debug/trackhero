"""Generate WebP siblings without changing the source images or dimensions."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
records = []
for source in sorted((root / 'assets').rglob('*')):
    if source.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
        continue
    target = source.with_suffix('.webp')
    with Image.open(source) as original:
        image = original.convert('RGBA' if 'A' in original.getbands() else 'RGB')
        # UI frames and atlases retain their exact pixels; opaque photographs use
        # high quality compression. Preserve alpha exactly in both cases.
        opaque = 'A' not in image.getbands() or image.getchannel('A').getextrema() == (255, 255)
        photo = opaque and source.stat().st_size > 200_000 and ('imgImage7' in source.name or 'imgImage237' in source.name or 'background' in source.name or source.suffix.lower() in ('.jpg','.jpeg') or 'bonfire' in source.name)
        if opaque: image = image.convert('RGB')
        image.save(target, 'WEBP', lossless=not photo, quality=88 if photo else 100, method=6, exact=True)
        with Image.open(target) as result:
            assert result.size == image.size
            if 'A' in image.getbands():
                assert result.convert('RGBA').getchannel('A').tobytes() == image.getchannel('A').tobytes()
        records.append({'source': str(source.relative_to(root)), 'file': str(target.relative_to(root)), 'before': source.stat().st_size, 'after': target.stat().st_size})
(root / 'tools/image-optimization.json').write_text(json.dumps(records, indent=2) + '\n')
print(f'{len(records)} images: {sum(r["before"] for r in records):,} -> {sum(r["after"] for r in records):,} bytes')
