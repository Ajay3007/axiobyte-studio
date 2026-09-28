#!/bin/sh
# Full render in two segments, joined losslessly, then muxed with the voiceover.
# Segmenting only exists so a long render fits inside a shell timeout; the
# warm-up frames in render.mjs make the join seamless.
set -e
cd "$(dirname "$0")/.."
MID=${MID:-6:00}
node scripts/render.mjs --headless --no-audio --from 0    --to "$MID" --out final/.part1.mp4
node scripts/render.mjs --headless --no-audio --from "$MID"           --out final/.part2.mp4
printf "file '%s'\nfile '%s'\n" "$PWD/final/.part1.mp4" "$PWD/final/.part2.mp4" > final/.parts.txt
ffmpeg -y -v error -f concat -safe 0 -i final/.parts.txt -c copy final/.joined.mp4
ffmpeg -y -v error -i final/.joined.mp4 -i content/nic/voiceover.mpeg \
  -map 0:v:0 -map 1:a:0 -c:v copy -af apad -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart final/nic-video.mp4
rm -f final/.part1.mp4 final/.part2.mp4 final/.joined.mp4 final/.parts.txt
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration,size -of default=nw=1 final/nic-video.mp4
