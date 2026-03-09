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

## Notes

- The server binds to `0.0.0.0`, so other devices on your LAN can connect.
- Seeking works because the app supports HTTP byte-range streaming.
- Some browsers may not play every format equally well. `mp4` and `webm` are the safest options.