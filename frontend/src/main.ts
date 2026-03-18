import { SelectDirectory, GetFiles, Reorder } from "../wailsjs/go/main/App";
import "./style.css";

interface FileEntry {
  number: number;
  name: string;
  fullName: string;
}

let files: FileEntry[] = [];
let currentDir = "";

const app = document.getElementById("app")!;

// Mouse-based drag state
let dragIndex: number | null = null;
let dragEl: HTMLElement | null = null;
let placeholder: HTMLElement | null = null;
let offsetY = 0;
let listEl: HTMLElement | null = null;

function render() {
  app.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>Lecture Manager</h1>
        <button id="select-dir" class="btn">${currentDir ? "Change Folder" : "Select Folder"}</button>
      </div>
      ${currentDir ? `<div class="dir-path">${currentDir}</div>` : ""}
      ${files.length === 0 && currentDir ? `<div class="empty">No numbered files found. Files should be named like "1 - Topic".</div>` : ""}
      ${files.length === 0 && !currentDir ? `<div class="empty">Select a folder to get started.</div>` : ""}
      <ul id="file-list" class="file-list">
        ${files
          .map(
            (f, i) => `
          <li class="file-item" data-index="${i}">
            <span class="drag-handle">&#x2807;</span>
            <span class="file-number">${i + 1}</span>
            <span class="file-name">${escapeHtml(f.name)}</span>
          </li>
        `
          )
          .join("")}
      </ul>
      ${files.length > 0 ? `<button id="save-btn" class="btn btn-primary">Save Order</button>` : ""}
      <div id="status" class="status"></div>
    </div>
  `;

  document.getElementById("select-dir")!.addEventListener("click", selectDir);

  const saveBtn = document.getElementById("save-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveOrder);

  listEl = document.getElementById("file-list");
  setupMouseDrag();
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function setupMouseDrag() {
  const items = document.querySelectorAll<HTMLLIElement>(".file-item");
  items.forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragIndex = parseInt(item.dataset.index!);

      const rect = item.getBoundingClientRect();
      offsetY = e.clientY - rect.top;

      // Create floating clone
      dragEl = item.cloneNode(true) as HTMLElement;
      dragEl.classList.add("drag-clone");
      dragEl.style.width = rect.width + "px";
      dragEl.style.top = rect.top + "px";
      dragEl.style.left = rect.left + "px";
      document.body.appendChild(dragEl);

      // Replace original with placeholder
      placeholder = document.createElement("li");
      placeholder.className = "file-item placeholder";
      placeholder.style.height = rect.height + "px";
      item.parentNode!.insertBefore(placeholder, item);
      item.style.display = "none";
    });
  });
}

function getDropIndex(y: number): number {
  if (!listEl) return 0;
  const items = listEl.querySelectorAll<HTMLLIElement>(".file-item:not(.drag-clone)");
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      return i;
    }
  }
  return items.length;
}

document.addEventListener("mousemove", (e) => {
  if (dragEl === null || dragIndex === null) return;
  dragEl.style.top = e.clientY - offsetY + "px";

  // Move placeholder to the correct position
  const dropIdx = getDropIndex(e.clientY);
  if (listEl && placeholder) {
    const items = Array.from(listEl.children).filter(
      (c) => c !== placeholder
    ) as HTMLElement[];
    if (dropIdx >= items.length) {
      listEl.appendChild(placeholder);
    } else {
      listEl.insertBefore(placeholder, items[dropIdx]);
    }
  }
});

document.addEventListener("mouseup", () => {
  if (dragEl === null || dragIndex === null || !listEl || !placeholder) return;

  // Determine final position
  const children = Array.from(listEl.children);
  let dropIdx = children.indexOf(placeholder);
  // Account for the hidden original element
  const hiddenOriginal = listEl.querySelector<HTMLElement>('.file-item[style*="display: none"]');
  const hiddenIdx = hiddenOriginal ? children.indexOf(hiddenOriginal) : -1;
  if (hiddenIdx !== -1 && hiddenIdx < dropIdx) {
    dropIdx--;
  }

  // Clean up
  dragEl.remove();
  dragEl = null;
  placeholder.remove();
  placeholder = null;

  if (hiddenOriginal) {
    hiddenOriginal.style.display = "";
  }

  // Apply reorder
  if (dropIdx !== dragIndex && dropIdx >= 0) {
    const [moved] = files.splice(dragIndex, 1);
    files.splice(dropIdx, 0, moved);
    render();
  }

  dragIndex = null;
});

async function selectDir() {
  try {
    const dir = await SelectDirectory();
    if (!dir) return;
    currentDir = dir;
    await loadFiles();
  } catch (err) {
    showStatus(`Error: ${err}`, true);
  }
}

async function loadFiles() {
  try {
    files = (await GetFiles()) || [];
    render();
  } catch (err) {
    showStatus(`Error loading files: ${err}`, true);
  }
}

async function saveOrder() {
  try {
    const orderedFullNames = files.map((f) => f.fullName);
    await Reorder(orderedFullNames);
    showStatus("Files reordered successfully!");
    await loadFiles();
  } catch (err) {
    showStatus(`Error saving order: ${err}`, true);
  }
}

function showStatus(msg: string, isError = false) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = msg;
    status.className = `status ${isError ? "error" : "success"}`;
    setTimeout(() => {
      status.textContent = "";
      status.className = "status";
    }, 3000);
  }
}

render();
