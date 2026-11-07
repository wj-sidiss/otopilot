#!/bin/bash
# Yatay anlatım videosunu 1000 karelik sessiz parçalar halinde render eder (her parça 3 deneme),
# assets/<ad>/anlatim.wav ile birleştirip teslim klasörüne yazar.
# Kullanım: bash scripts/yatay-render.sh <ad> <Composition> "<teslim klasörü>" <DOSYA.mp4>
cd "$(dirname "$0")/.."
AD=$1; COMP=$2; D=$3; DOSYA=$4
O=renders/$AD/parca; P=renders/$AD/pub; mkdir -p $O $P
[ -d $P/fonts ] || cp -r assets/fonts $P/fonts
TOP=$(.venv/Scripts/python -c "import json,math;print(math.ceil(json.load(open('assets/$AD/zaman.json',encoding='utf-8'))['toplamSn']*30))")
ADIM=1000
echo "$COMP: $TOP kare"
for ((b=0; b<TOP; b+=ADIM)); do
  s=$((b+ADIM-1)); [ $s -ge $TOP ] && s=$((TOP-1))
  f=$O/v$(printf %05d $b).mp4
  [ -s $f ] && continue
  for d in 1 2 3; do
    timeout 3000 npx remotion render src/index.ts $COMP $f --public-dir=$P --frames=$b-$s --muted --concurrency=4 > $O/log-$b.txt 2>&1 && break
    rm -f $f; echo "parça $b deneme $d düştü"
  done
  [ -s $f ] || { echo "PARÇA $b BAŞARISIZ"; exit 1; }
  echo "parça $b tamam"
done
ls $O/v*.mp4 | sed "s#.*/#file '#; s#\$#'#" > $O/liste.txt
ffmpeg -v error -y -f concat -safe 0 -i $O/liste.txt -c copy $O/video.mp4 || exit 1
mkdir -p "$D"
ffmpeg -v error -y -i $O/video.mp4 -i assets/$AD/anlatim.wav -map 0:v -map 1:a -c:v libx264 -preset medium -crf 18 \
  -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -color_range tv -af loudnorm=I=-14:TP=-1.5:LRA=11 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$D/$DOSYA" || exit 1
echo BITTI "$D/$DOSYA"
