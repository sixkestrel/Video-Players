# LAN Video Player

This app lets you stream video files stored on your PC to any device on your local network using a browser.

## How to run

1. Put your video files in the local `library` folder, or choose any folder you want to serve.
2. Start the server:

```powershell
node server.js
```

3. Open one of the URLs shown in the terminal on any device connected to the same network.

## Optional: use a different folder

If your videos are stored somewhere else, point the app at that folder when you start it:

```powershell
$env:VIDEO_LIBRARY="D:\Videos"
node server.js
```

You can also change the port:

```powershell
$env:PORT="5000"
node server.js
```

## Optional: enable ffmpeg transcoding for MKV

If `ffmpeg` is installed and available on your `PATH`, the server will automatically transcode `.mkv` files to browser-friendly MP4 while streaming.

If `ffmpeg` is installed somewhere else, point the app at it explicitly:

```powershell
$env:FFMPEG_PATH="C:\ffmpeg\bin\ffmpeg.exe"
node server.js
```

To disable live MKV transcoding:

```powershell
$env:ENABLE_MKV_TRANSCODE="false"
node server.js
```

## Notes

- The server binds to `0.0.0.0`, so other devices on your LAN can connect.
- Direct file streaming still uses HTTP byte-range requests for seeking.
- Live MKV transcoding does not provide full byte-range seeking because the MP4 is generated on the fly.
- Some MKV files may still fail if ffmpeg is missing or the source file is damaged.
- `mp4` and `webm` remain the safest formats for widest browser compatibility.