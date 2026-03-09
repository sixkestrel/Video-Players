const player = document.getElementById("player");
const videoGrid = document.getElementById("videoGrid");
const emptyState = document.getElementById("emptyState");
const treeEmptyState = document.getElementById("treeEmptyState");
const treeRoot = document.getElementById("treeRoot");
const libraryRoot = document.getElementById("libraryRoot");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");
const refreshButton = document.getElementById("refreshButton");
const rootButton = document.getElementById("rootButton");
const currentFolderName = document.getElementById("currentFolderName");
const currentFolderMeta = document.getElementById("currentFolderMeta");
const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingMeta = document.getElementById("nowPlayingMeta");

let videos = [];
let activeVideoId = null;
let selectedFolderPath = "";
let expandedFolders = new Set([""]);
let folderTree = createFolderNode("", "Library");

function createFolderNode(path, name) {
  return {
    path,
    name,
    folders: [],
    videos: []
  };
}

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

function buildFolderTree(items) {
  const root = createFolderNode("", "Library");
  const foldersByPath = new Map([["", root]]);

  for (const video of items) {
    const segments = video.relativePath.split("/");
    const fileName = segments.pop();
    let currentPath = "";
    let parent = root;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let folder = foldersByPath.get(currentPath);

      if (!folder) {
        folder = createFolderNode(currentPath, segment);
        foldersByPath.set(currentPath, folder);
        parent.folders.push(folder);
      }

      parent = folder;
    }

    parent.videos.push(video);
  }

  for (const folder of foldersByPath.values()) {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name));
    folder.videos.sort((a, b) => a.name.localeCompare(b.name));
  }

  return root;
}

function getFolderByPath(path) {
  if (!path) {
    return folderTree;
  }

  const segments = path.split("/");
  let current = folderTree;

  for (const segment of segments) {
    current = current.folders.find((folder) => folder.name === segment);
    if (!current) {
      return folderTree;
    }
  }

  return current;
}

function getVisibleVideos() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedFolder = getFolderByPath(selectedFolderPath);
  let pool = selectedFolderPath ? selectedFolder.videos : videos;

  if (!query) {
    return pool;
  }

  return pool.filter((video) =>
    `${video.name} ${video.relativePath}`.toLowerCase().includes(query)
  );
}

function countVideos(folder) {
  let total = folder.videos.length;

  for (const child of folder.folders) {
    total += countVideos(child);
  }

  return total;
}

function folderMatchesQuery(folder, query) {
  if (!query) {
    return true;
  }

  if (folder.path.toLowerCase().includes(query) || folder.name.toLowerCase().includes(query)) {
    return true;
  }

  return folder.folders.some((child) => folderMatchesQuery(child, query)) ||
    folder.videos.some((video) => `${video.name} ${video.relativePath}`.toLowerCase().includes(query));
}

function selectFolder(path) {
  selectedFolderPath = path;
  const folder = getFolderByPath(path);
  const total = countVideos(folder);
  currentFolderName.textContent = path ? folder.name : "Library";
  currentFolderMeta.textContent = path
    ? `${path} • ${total} video${total === 1 ? "" : "s"}`
    : `All available videos • ${videos.length} video${videos.length === 1 ? "" : "s"}`;
  renderTree();
  renderVideos(getVisibleVideos());
}

function renderTreeNode(folder, depth, query) {
  if (folder.path && !folderMatchesQuery(folder, query)) {
    return null;
  }

  const node = document.createElement("div");
  node.className = "tree-node";
  node.style.setProperty("--depth", depth);

  if (folder.path) {
    const row = document.createElement("div");
    row.className = `tree-row${selectedFolderPath === folder.path ? " selected" : ""}`;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tree-toggle";
    toggle.textContent = expandedFolders.has(folder.path) ? "-" : "+";
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (expandedFolders.has(folder.path)) {
        expandedFolders.delete(folder.path);
      } else {
        expandedFolders.add(folder.path);
      }
      renderTree();
    });

    const label = document.createElement("button");
    label.type = "button";
    label.className = "tree-label";
    label.innerHTML = `<span>${folder.name}</span><span class="tree-count">${countVideos(folder)}</span>`;
    label.addEventListener("click", () => {
      expandedFolders.add(folder.path);
      selectFolder(folder.path);
    });

    row.append(toggle, label);
    node.appendChild(row);
  }

  if (!folder.path || expandedFolders.has(folder.path) || query) {
    for (const child of folder.folders) {
      const childNode = renderTreeNode(child, depth + 1, query);
      if (childNode) {
        node.appendChild(childNode);
      }
    }
  }

  return node;
}

function renderTree() {
  treeRoot.innerHTML = "";
  const query = searchInput.value.trim().toLowerCase();
  const visibleFolders = folderTree.folders.filter((folder) => folderMatchesQuery(folder, query));

  treeEmptyState.hidden = visibleFolders.length > 0 || videos.length > 0;
  rootButton.classList.toggle("active", selectedFolderPath === "");

  for (const folder of visibleFolders) {
    const node = renderTreeNode(folder, 0, query);
    if (node) {
      treeRoot.appendChild(node);
    }
  }
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
      renderVideos(getVisibleVideos());
    });

    videoGrid.appendChild(button);
  }
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
    folderTree = buildFolderTree(videos);
    libraryRoot.textContent = payload.root;
    updateStatus(`${videos.length} video${videos.length === 1 ? "" : "s"} available`);

    if (selectedFolderPath && getFolderByPath(selectedFolderPath) === folderTree) {
      selectedFolderPath = "";
    }

    selectFolder(selectedFolderPath);
  } catch (error) {
    updateStatus("Unable to load the library");
    libraryRoot.textContent = "Check the server terminal for details";
    treeRoot.innerHTML = "";
    videoGrid.innerHTML = "";
    treeEmptyState.hidden = false;
    emptyState.hidden = false;
    nowPlayingMeta.textContent = error.message;
  }
}

searchInput.addEventListener("input", () => {
  renderTree();
  renderVideos(getVisibleVideos());
});

refreshButton.addEventListener("click", () => {
  loadLibrary();
});

rootButton.addEventListener("click", () => {
  selectFolder("");
});

loadLibrary();