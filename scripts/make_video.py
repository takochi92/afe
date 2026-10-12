#!/usr/bin/env python3
# スライド画像（slide-01.jpg…）から、縦長の動画（mp4、1080x1920、音なし）を作る。TikTok・YouTubeショート・Instagramリール用。
# 使い方: python3 scripts/make_video.py <画像のフォルダ> <出力.mp4>
# 長さ: 表紙3秒、ポイント4.5秒、まとめ4.5秒。つなぎは0.4秒のフェード。ゆっくり少しだけ拡大する。
import subprocess, sys, glob, os
import argparse
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('out'); ap.add_argument('--durs', help='各スライドの秒数（カンマ区切り）'); ap.add_argument('--audio', help='音声ファイル（mp3など）を付ける')
a = ap.parse_args(); d, out = a.dir, a.out
fs = sorted(glob.glob(os.path.join(d, 'slide-*.jpg')))
dur = [float(x) for x in a.durs.split(',')] if a.durs else [3.0] + [4.5] * (len(fs) - 1); FPS = 30; X = 0.4
cmd = ['ffmpeg', '-y', '-loglevel', 'error']
NV = len(fs)
for f, t in zip(fs, dur): cmd += ['-framerate', str(FPS), '-loop', '1', '-t', str(t + X), '-i', f]
if a.audio: cmd += ['-i', a.audio]
flt = []
for i, t in enumerate(dur):
    n = int((t + X) * FPS)
    flt.append(f"[{i}:v]scale=1188:2112,zoompan=z='1+0.04*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps={FPS},format=yuv420p,setsar=1[v{i}]")
last, off = 'v0', dur[0]
for i in range(1, len(fs)):
    nxt = f'x{i}'
    flt.append(f"[{last}][v{i}]xfade=transition=fade:duration={X}:offset={off - X + 0:.2f}[{nxt}]")
    last = nxt; off += dur[i]
cmd += ['-filter_complex', ';'.join(flt), '-map', f'[{last}]'] + (['-map', f'{NV}:a', '-c:a', 'aac', '-b:a', '160k', '-af', 'apad', '-t', f'{sum(dur):.2f}'] if a.audio else []) + ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
print('作成:', out, f'（約{sum(dur):.0f}秒）')
