#!/bin/sh
# Full render of a Three.js episode in two segments, joined losslessly, then
# muxed with the voiceover. Segmenting only exists so a long render fits inside
# a shell timeout; the warm-up frames in render.mjs make the join seamless.
#
#   renderers/three/tools/render-full.sh episodes/s01e03-what-is-a-nic [MID=6:00]
#
# `abs compose` does the general version of this (one clip per shot, any
# renderer); this script stays as the quick path for a single-renderer film.
set -e
EP=${1:?usage: render-full.sh <episode-dir>}
TOOLS="$(cd "$(dirname "$0")" && pwd)"
ID=$(basename "$EP")
OUT="$EP/out"
AUDIO=$(ls "$EP"/audio/voiceover.* 2>/dev/null | head -1)
[ -n "$AUDIO" ] || { echo "no voiceover in $EP/audio/ (a local, gitignored input)"; exit 1; }
MID=${MID:-6:00}
mkdir -p "$OUT"
node "$TOOLS/render.mjs" --episode "$EP" --headless --no-audio --from 0    --to "$MID" --out "$OUT/.part1.mp4"
node "$TOOLS/render.mjs" --episode "$EP" --headless --no-audio --from "$MID"           --out "$OUT/.part2.mp4"
printf "file '%s'\nfile '%s'\n" "$(cd "$OUT" && pwd)/.part1.mp4" "$(cd "$OUT" && pwd)/.part2.mp4" > "$OUT/.parts.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$OUT/.parts.txt" -c copy "$OUT/.joined.mp4"
ffmpeg -y -v error -i "$OUT/.joined.mp4" -i "$AUDIO" \
  -map 0:v:0 -map 1:a:0 -c:v copy -af apad -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart "$OUT/$ID.mp4"
rm -f "$OUT/.part1.mp4" "$OUT/.part2.mp4" "$OUT/.joined.mp4" "$OUT/.parts.txt"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration,size -of default=nw=1 "$OUT/$ID.mp4"
