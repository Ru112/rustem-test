const menuButton = document.querySelector("#menu");
const nav = document.querySelector("#nav");
const form = document.querySelector("#draft-form");
const fields = ["title", "story", "response"];
const status = document.querySelector("#status");
const saveState = document.querySelector("#save-state");
const storyCount = document.querySelector("#story-count");
const storageKey = "project-supernatural-private-draft";

function setMenu(open) {
  nav.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.querySelector("[aria-hidden]").textContent = open ? "×" : "☰";
}

menuButton.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav.addEventListener("click", event => {
  if (event.target.matches("a")) setMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setMenu(false);
    menuButton.focus();
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header")) setMenu(false);
});

function draftData() {
  return Object.fromEntries(fields.map(id => [id, document.getElementById(id).value]));
}

function updateCount() {
  storyCount.textContent = `${document.querySelector("#story").value.length} / 5000`;
}

function saveDraft(announce = true) {
  try {
    const data = draftData();
    localStorage.setItem(storageKey, JSON.stringify({...data, savedAt: Date.now()}));
    saveState.textContent = "Saved on this device";
    if (announce) status.textContent = "Private draft saved. Nothing was uploaded or published.";
  } catch {
    saveState.textContent = "Could not save";
    status.textContent = "This browser blocked local saving. Copy your text somewhere private before leaving.";
  }
}

function restoreDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!data) return;
    fields.forEach(id => {
      if (typeof data[id] === "string") document.getElementById(id).value = data[id];
    });
    saveState.textContent = "Saved draft restored";
    status.textContent = "Your private draft was restored from this browser.";
  } catch {
    status.textContent = "A saved draft could not be restored.";
  }
  updateCount();
}

let autosaveTimer;
form.addEventListener("input", () => {
  updateCount();
  saveState.textContent = "Unsaved changes";
  status.textContent = "";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDraft(false), 800);
});
document.querySelector("#save").addEventListener("click", () => {
  clearTimeout(autosaveTimer);
  saveDraft(true);
});
document.querySelector("#clear").addEventListener("click", () => {
  const hasContent = fields.some(id => document.getElementById(id).value.trim());
  if (hasContent && !window.confirm("Delete this private draft from this browser? This cannot be undone.")) return;
  localStorage.removeItem(storageKey);
  form.reset();
  updateCount();
  saveState.textContent = "Nothing saved yet";
  status.textContent = "Private draft deleted from this browser.";
  document.querySelector("#title").focus();
});

restoreDraft();
