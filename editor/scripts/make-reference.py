#!/usr/bin/env python3
"""Makes a test reference edit with known answers: 8 shots from still pictures (each slowly zooming), joined by different
transitions, text on screen in some shots, and a click track. Writes <out>.webm (VP9: open-source Chromium has no H.264) and <out>.json (the truth).
Usage: make-reference.py <images dir> <font.ttf> <out without extension>"""
import json, subprocess, sys, os

imgs_dir, font, out = sys.argv[1:4]
imgs = ['portrait.jpg', 'pose.jpg', 'cat.jpg', 'burger.jpg', 'cats_and_dogs.jpg', 'multi_objects.jpg', 'portrait.jpg', 'cat.jpg']
dur = [1.6, 1.4, 1.8, 1.5, 1.6, 1.4, 1.7, 1.6]
# transition into shot k (k >= 1): xfade name, seconds; 'cut' is a one-frame fade
trans = [None, ('cut', 0.04), ('fade', 0.5), ('fadeblack', 0.6), ('wipeleft', 0.4), ('slideleft', 0.4), ('fadewhite', 0.4), ('circleopen', 0.5)]
texts = [  # shot index, words, x (fraction of width, centre), y, size px, colour
    (1, 'BIG SALE', 0.5, 0.15, 110, 'yellow'),
    (3, 'รีวิวเบอร์เกอร์', 0.5, 0.85, 90, 'white'),
    (5, 'TOP 5', 0.5, 0.2, 130, 'white'),
]
W, H, FPS = 720, 1280, 30
args = ['ffmpeg', '-v', 'error', '-y']
for i, (f, d) in enumerate(zip(imgs, dur)):
    args += ['-loop', '1', '-t', str(d + 0.7), '-i', os.path.join(imgs_dir, f)]
parts = []
for i in range(len(imgs)):
    # fill 9:16, then a slow zoom so shots are not frozen pictures
    parts.append(f"[{i}:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},zoompan=z='1+0.0015*on':d=1:x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':s={W}x{H}:fps={FPS},format=yuv420p,setpts=PTS-STARTPTS[s{i}]")
cur, offset, truth = 's0', 0.0, []
length = dur[0]
for k in range(1, len(imgs)):
    name, td = trans[k]
    off = length - td
    x = 'fade' if name == 'cut' else name
    parts.append(f"[{cur}][s{k}]xfade=transition={x}:duration={td}:offset={off:.3f}[x{k}]")
    truth.append({'at': round(off + td / 2, 3), 'from': round(off, 3), 'to': round(off + td, 3), 'kind': name})
    cur = f'x{k}'
    length = round(off + dur[k], 3)  # shot k shows for dur[k] from the start of its mix in
total = length
starts = [0.0] + [t['at'] for t in truth]
ends = [t['at'] for t in truth] + [total]
draw = []
for (k, words, x, y, size, col) in texts:
    a, b = starts[k] + 0.25, ends[k] - 0.25
    draw.append(f"drawtext=fontfile={font}:text='{words}':fontsize={size}:fontcolor={col}:borderw={size//12}:bordercolor=black:x=(w-text_w)*{x}/0.5/2:y=h*{y}-text_h/2:enable='between(t,{a:.2f},{b:.2f})'")
parts.append(f"[{cur}]{','.join(draw)},trim=0:{total:.3f}[v]")
# a click every half second (120 BPM), first at 0.25 s
parts.append(f"aevalsrc='sin(2*PI*1200*t)*lt(mod(t-0.25+10,0.5),0.03)*gt(t,0.24)':s=44100:d={total:.3f}[a]")
args += ['-filter_complex', ';'.join(parts), '-map', '[v]', '-map', '[a]', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-deadline', 'realtime', '-cpu-used', '8', '-r', str(FPS), '-c:a', 'libopus', out + '.webm']
subprocess.run(args, check=True)
json.dump({'duration': total, 'boundaries': truth, 'texts': [{'shot': k, 'text': w, 'y': y} for (k, w, x, y, s, c) in texts], 'bpm': 120}, open(out + '.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({'duration': total, 'boundaries': [(t['at'], t['kind']) for t in truth]}, ensure_ascii=False))
