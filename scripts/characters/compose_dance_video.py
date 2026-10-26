"""Encode actual Three.js captures as a 30 fps preview (requires PyAV and Pillow)."""
from pathlib import Path

import av
from PIL import Image

root = Path(__file__).resolve().parents[2]
sources = sorted((root / 'assets/characters/validation/dance-video-frames').glob('[0-9][0-9][0-9].png'))
if len(sources) != 120:
    raise RuntimeError('Capture the complete four-second, 30 fps dance first')
destination = root / 'assets/characters/previews/victory-dance.mp4'
with Image.open(sources[0]) as first:
    width, height = first.size
with av.open(str(destination), 'w', options={'movflags': '+faststart'}) as video:
    stream = video.add_stream('libx264', rate=30)
    stream.width, stream.height = width, height
    stream.pix_fmt = 'yuv420p'
    stream.options = {'crf': '19', 'preset': 'medium'}
    for source in sources * 2:
        with Image.open(source) as image:
            frame = av.VideoFrame.from_image(image.convert('RGB'))
        for packet in stream.encode(frame):
            video.mux(packet)
    for packet in stream.encode():
        video.mux(packet)
with av.open(str(destination)) as check:
    frame_count = sum(1 for _ in check.decode(video=0))
    if frame_count != 240 or abs(float(check.duration / av.time_base) - 8) > .05:
        raise RuntimeError('Preview verification failed')
print(f'Saved {destination.name}: {width}x{height}, 30 fps, two complete loops, 8 seconds')
