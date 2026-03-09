const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { URL } = require("node:url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4321);
const VIDEO_ROOT = path.resolve(process.env.VIDEO_LIBRARY || path.join(process.cwd(), "library"));
const PUBLIC_DIR = path.join(process.cwd(), "public");
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mov",
  ".mkv",
  ".avi"
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(text);
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function getLocalAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const iface of Object.values(interfaces)) {
    for (const entry of iface || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

async function ensureVideoRoot() {
  await fsp.mkdir(VIDEO_ROOT, { recursive: true });
}

async function walkVideos(directory, root = directory) {
  const dirents = await fsp.readdir(directory, { withFileTypes: true });
  const items = [];

  for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, dirent.name);
    if (dirent.isDirectory()) {
      items.push(...await walkVideos(fullPath, root));
      continue;
    }

    const extension = path.extname(dirent.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension)) {
      continue;
    }

    const stats = await fsp.stat(fullPath);
    const relativePath = path.relative(root, fullPath).split(path.sep).join("/");

    items.push({
      id: relativePath,
      name: path.basename(fullPath, extension),
      fileName: dirent.name,
      relativePath,
      extension,
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    });
  }

  return items;
}

async function handleLibrary(response) {
  try {
    const videos = await walkVideos(VIDEO_ROOT);
    sendJson(response, 200, {
      root: VIDEO_ROOT,
      videos
    });
  } catch (error) {
    sendJson(response, 500, {
      error: "Unable to read the video library.",
      details: error.message
    });
  }
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const [startText, endText] = rangeHeader.replace("bytes=", "").split("-");
  const start = startText === "" ? 0 : Number(startText);
  const end = endText === "" ? size - 1 : Number(endText);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= size || start > end) {
    return "invalid";
  }

  return { start, end };
}

function streamVideo(request, response, filePath) {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendText(response, 404, "Video not found.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const parsedRange = parseRange(request.headers.range, stats.size);

    if (parsedRange === "invalid") {
      response.writeHead(416, {
        "Content-Range": `bytes */${stats.size}`
      });
      response.end();
      return;
    }

    if (!parsedRange) {
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Accept-Ranges": "bytes"
      });
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    const { start, end } = parsedRange;
    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes"
    });
    fs.createReadStream(filePath, { start, end }).pipe(response);
  });
}

async function handleStream(request, response, url) {
  const requestedFile = url.searchParams.get("file");
  if (!requestedFile) {
    sendText(response, 400, "Missing file parameter.");
    return;
  }

  const normalized = requestedFile.split("/").join(path.sep);
  const absolutePath = path.resolve(VIDEO_ROOT, normalized);

  if (!isPathInside(VIDEO_ROOT, absolutePath)) {
    sendText(response, 403, "Invalid file path.");
    return;
  }

  streamVideo(request, response, absolutePath);
}

async function serveStatic(response, pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${target}`);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendText(response, 403, "Invalid path.");
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(data);
  } catch {
    sendText(response, 404, "Not found.");
  }
}

async function start() {
  await ensureVideoRoot();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method !== "GET") {
      sendText(response, 405, "Method not allowed.");
      return;
    }

    if (url.pathname === "/api/library") {
      await handleLibrary(response);
      return;
    }

    if (url.pathname === "/api/stream") {
      await handleStream(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  });

  server.listen(PORT, HOST, () => {
    const addresses = getLocalAddresses();
    console.log(`LAN Video Player running on http://localhost:${PORT}`);
    for (const address of addresses) {
      console.log(`Available on http://${address}:${PORT}`);
    }
    console.log(`Video library: ${VIDEO_ROOT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});