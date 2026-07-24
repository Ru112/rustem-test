const menuButton = document.querySelector("#menu");
const navigation = document.querySelector("#site-navigation");
const draftForm = document.querySelector("#draft-form");
const draftFields = ["title", "story", "response"];
const status = document.querySelector("#status");
const saveState = document.querySelector("#save-state");
const storyCount = document.querySelector("#story-count");
const storageKey = "project-supernatural-private-draft";

function setMenu(open, returnFocus = false) {
  navigation.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.querySelector("span").textContent = open ? "Close" : "Menu";
  menuButton.querySelector("svg").innerHTML = open
    ? '<path d="M6 6l12 12M18 6 6 18"/>'
    : '<path d="M4 7h16M4 12h16M4 17h16"/>';
  if (returnFocus) menuButton.focus();
}

menuButton.addEventListener("click", () => setMenu(!navigation.classList.contains("open")));
navigation.addEventListener("click", event => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && navigation.classList.contains("open")) setMenu(false, true);
});
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header")) setMenu(false);
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 760) setMenu(false);
});

function draftData() {
  return Object.fromEntries(draftFields.map(id => [id, document.getElementById(id).value]));
}

function updateCount() {
  storyCount.textContent = `${document.querySelector("#story").value.length} / 5000`;
}

function saveDraft(announce = true) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({...draftData(), savedAt: Date.now()}));
    saveState.textContent = "Saved on this device";
    if (announce) status.textContent = "Private draft saved in this browser. Nothing was uploaded or published.";
  } catch {
    saveState.textContent = "Could not save";
    status.textContent = "This browser blocked local saving. Copy your text somewhere private before leaving.";
  }
}

function restoreDraft() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!data) return;
    draftFields.forEach(id => {
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
draftForm.addEventListener("input", () => {
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
  const hasContent = draftFields.some(id => document.getElementById(id).value.trim());
  if (hasContent && !window.confirm("Delete this private draft from this browser? This cannot be undone.")) return;
  localStorage.removeItem(storageKey);
  draftForm.reset();
  updateCount();
  saveState.textContent = "Nothing saved yet";
  status.textContent = "Private draft deleted from this browser.";
  document.querySelector("#title").focus();
});

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#experience-search");
const searchStatus = document.querySelector("#search-status");
const storyItems = [...document.querySelectorAll(".story-item")];
const noResults = document.querySelector("#no-results");

function filterStories(query) {
  const normalized = query.trim().toLowerCase();
  let matches = 0;
  storyItems.forEach(item => {
    const match = !normalized || item.dataset.search.includes(normalized) || item.dataset.topic.includes(normalized);
    item.hidden = !match;
    if (match) matches += 1;
  });
  noResults.hidden = matches !== 0;
  searchStatus.textContent = normalized
    ? `${matches} prototype ${matches === 1 ? "experience" : "experiences"} found for “${query.trim()}”.`
    : "Prototype search filters the examples on this page only.";
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  filterStories(searchInput.value);
  document.querySelector("#experiences-title").focus({preventScroll:true});
  document.querySelector("#experiences").scrollIntoView();
});
searchInput.addEventListener("input", () => {
  if (!searchInput.value) filterStories("");
});
document.querySelectorAll("[data-topic]").forEach(link => {
  link.addEventListener("click", () => {
    searchInput.value = link.dataset.topic;
    filterStories(link.dataset.topic);
  });
});

restoreDraft();
