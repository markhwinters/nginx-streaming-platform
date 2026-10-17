# Streamlab

Streamlab is a local HLS streaming demo built with React, Video.js, Nginx, and Varnish.

## Features

- HLS video playback with Video.js controls and audio
- Nginx delivery of `.m3u8` playlists and `.ts` segments
- Varnish cache HIT/MISS status, download speed, and buffer diagnostics

## Start the project

Requirements: Docker Desktop and FFmpeg.

From the project root, start the services:

```powershell
docker compose up -d --build
```

Open [https://localhost](https://localhost). To stop the services:

```powershell
docker compose down
```

## Create a browser-compatible HLS stream

Put your source video in a local working folder and run FFmpeg there. Replace `input.mp4` with its filename. This creates an H.264/AAC-LC stream with four-second MPEG-TS segments in the current folder:

```powershell
ffmpeg -i "input.mp4" -c:v libx264 -profile:v baseline -pix_fmt yuv420p -c:a aac -profile:a aac_low -b:a 160k -ar 48000 -ac 2 -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "segment_%03d.ts" "output.m3u8"
```

When FFmpeg finishes, manually copy `output.m3u8` and all generated `segment_*.ts` files into the project’s `media\movie001` folder, replacing the existing stream files. Restart Varnish to clear cached media:

```powershell
docker compose restart varnish
```

## Roadmap

- Replace the single-video test page with a streaming-platform UI and a browsable video catalog.
- Add a database service to Docker Compose to store video details and account data.
- Let users create and manage personal playlists.
- Support profiles linked to a primary account, with separate profile experiences.
