const player = document.getElementById("player");
const videoGrid = document.getElementById("videoGrid");
const emptyState = document.getElementById("emptyState");
const libraryRoot = document.getElementById("libraryRoot");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");
const refreshButton = document.getElementById("refreshButton");
const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingMeta = document.getElementById("nowPlayingMeta");

let videos = [];
let activeVideoId = null;

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateStatus(text) {
  statusText.textContent = text;
}

function renderVideos(items) {
  videoGrid.innerHTML = "";
  emptyState.hidden = items.length > 0;

  for (const video of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "video-card";
    if (video.id === activeVideoId) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <h3>${video.name}</h3>
      <p>${video.relativePath}</p>
      <p>${formatBytes(video.size)}</p>
    `;

    button.addEventListener("click", () => {
      activeVideoId = video.id;
      player.src = `/api/stream?file=${encodeURIComponent(video.relativePath)}`;
      nowPlayingTitle.textContent = video.name;
      nowPlayingMeta.textContent = `${video.relativePath} • ${formatBytes(video.size)}`;
      player.play().catch(() => {});
      renderVideos(filterVideos(searchInput.value));
    });

    videoGrid.appendChild(button);
  }
}

function filterVideos(query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return videos;
  }

  return videos.filter((video) =>
    `${video.name} ${video.relativePath}`.toLowerCase().includes(trimmed)
  );
}

async function loadLibrary() {
  updateStatus("Scanning your videos...");

  try {
    const response = await fetch("/api/library", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const payload = await response.json();
    videos = payload.videos;
    libraryRoot.textContent = payload.root;
    updateStatus(`${videos.length} video${videos.length === 1 ? "" : "s"} available`);
    renderVideos(filterVideos(searchInput.value));
  } catch (error) {
    updateStatus("Unable to load the library");
    libraryRoot.textContent = "Check the server terminal for details";
    videoGrid.innerHTML = "";
    emptyState.hidden = false;
    nowPlayingMeta.textContent = error.message;
  }
}

searchInput.addEventListener("input", () => {
  renderVideos(filterVideos(searchInput.value));
});

refreshButton.addEventListener("click", () => {
  loadLibrary();
});

loadLibrary();