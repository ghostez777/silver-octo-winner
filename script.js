const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const state = { games: [], filter: "all", currentGame: null, favorites: loadFavorites() };
let timerSeconds = 300;
let timerInterval = null;
let toastTimeout;

function loadFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem("gamehub-favorites") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupSearch();
  setupFilters();
  setupPlayer();
  setupApps();
  setupSettings();
  setupKeyboard();
  loadNotes();
  loadGames();
});

async function loadGames() {
  const catalogUrls = [
    "games.json",
    "https://raw.githubusercontent.com/ghostez777/silver-octo-winner/main/games.json",
  ];

  let lastError = null;

  for (const url of catalogUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const text = await response.text();
      const parsed = JSON.parse(text);
      const games = Array.isArray(parsed) ? parsed : Array.isArray(parsed.games) ? parsed.games : [];

      state.games = games.filter((game) => game && typeof game === "object");
      updateGameCount();
      renderEverything();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Could not load catalog from ${url}:`, error);
    }
  }

  console.error(lastError);
  $("#gameCount").textContent = "Games could not load";
  showLoadError();
}

function showLoadError() {
  ["#gamesGrid", "#gbaGrid", "#favoritesGrid"].forEach((selector) => {
    const el = $(selector);
    if (el) {
      el.innerHTML = `<div class="empty-state"><strong>Games could not be loaded.</strong><p>Check the catalog URL or reload the page.</p></div>`;
    }
  });
}

function updateGameCount() {
  $("#gameCount").textContent = `${state.games.length} games · ${state.games.filter((game) => game.gba).length} GBA`;
}

function renderEverything() {
  renderGames();
  renderGBA();
  renderFavorites();
}

function getGameType(game) {
  return game.gba ? "Game Boy Advance" : game.file ? "Flash / Ruffle" : game.html ? "Browser Game" : "Game";
}

function createGameCard(game) {
  const favorite = state.favorites.includes(game.id);
  const card = document.createElement("article");
  card.className = "game-card";

  const image = game.thumb
    ? `<img class="game-thumb" src="${escapeAttribute(game.thumb)}" alt="${escapeAttribute(game.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
    : `<div class="game-thumb placeholder">${escapeHTML(game.name.slice(0, 1) || "G")}</div>`;

  card.innerHTML = `${image}<button class="favorite-button ${favorite ? "active" : ""}" title="Favorite" data-favorite="${escapeAttribute(game.id)}">${favorite ? "★" : "☆"}</button><div class="game-meta"><h3>${escapeHTML(game.name || "Untitled game")}</h3><span>${escapeHTML(getGameType(game))}</span></div>`;

  card.addEventListener("click", (event) => {
    if (!event.target.closest("[data-favorite]")) launchGame(game);
  });

  card.querySelector("[data-favorite]").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(game.id);
  });

  return card;
}

function renderGames() {
  let games = [...state.games];
  if (state.filter === "html") games = games.filter((game) => game.html);
  if (state.filter === "swf") games = games.filter((game) => game.file);
  if (state.filter === "gba") games = games.filter((game) => game.gba);
  renderCards($("#gamesGrid"), games, "No games match your filter.");
}

function renderGBA() {
  renderCards($("#gbaGrid"), state.games.filter((game) => game.gba), "No GBA games have been added yet.");
}

function renderFavorites() {
  renderCards($("#favoritesGrid"), state.games.filter((game) => state.favorites.includes(game.id)), "You haven't added any favorites yet.");
}

function renderCards(container, games, emptyMessage) {
  if (!container) return;

  if (!games.length) {
    container.innerHTML = `<div class="empty-state"><strong>${escapeHTML(emptyMessage)}</strong><p>Try another filter or reload the collection.</p></div>`;
    return;
  }

  container.innerHTML = "";
  games.forEach((game) => container.appendChild(createGameCard(game)));
}

function launchGame(game) {
  state.currentGame = game;
  if (game.gba) return void (window.location.href = `jsemu/?rom=${encodeURIComponent(game.gba)}`);
  if (game.html) return /^https?:\/\//i.test(game.html) ? window.open(game.html, "_blank", "noopener,noreferrer") : openPlayer(game, game.html);
  if (game.file) return openRufflePlayer(game);
  showToast("This game does not have a playable location yet.");
}

function openPlayer(game, url) {
  state.currentGame = game;
  $("#playerTitle").textContent = game.name;
  $("#gameFrame").src = url;
  $("#gameFrame").style.display = "block";
  $("#ruffleFrame").style.display = "none";
  $("#playerModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

async function openRufflePlayer(game) {
  const frame = $("#gameFrame");
  const ruffleFrame = $("#ruffleFrame");
  state.currentGame = game;
  $("#playerTitle").textContent = game.name;
  frame.src = "";
  frame.style.display = "none";
  ruffleFrame.innerHTML = "";
  $("#playerModal").classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    const ruffle = window.RufflePlayer;
    if (!ruffle) {
      showToast("Ruffle failed to load.");
      return;
    }
    const player = ruffle.createPlayer();
    ruffleFrame.appendChild(player);
    await player.load({ url: game.file });
    player.style.width = "100%";
    player.style.height = "100%";
    ruffleFrame.style.display = "block";
  } catch (error) {
    console.error("Could not load Flash game:", error);
    showToast("This Flash game could not be loaded.");
  }
}

function closePlayer() {
  $("#playerModal").classList.remove("open");
  $("#gameFrame").src = "";
  $("#ruffleFrame").innerHTML = "";
  document.body.style.overflow = "";
}

function setupPlayer() {
  $("#closePlayer").addEventListener("click", closePlayer);
  $("#playerModal").addEventListener("click", (event) => {
    if (event.target === $("#playerModal")) closePlayer();
  });
}

function setupNavigation() {
  $$('[data-page]').forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
}

function showPage(id) {
  const target = $(`#${id}`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupSearch() {
  $("#searchInput").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const games = query
      ? state.games.filter((game) => String(game.name || "").toLowerCase().includes(query))
      : [...state.games];
    renderCards($("#gamesGrid"), games, "No games match your search.");
  });
}

function setupFilters() {
  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter || "all";
      renderGames();
    });
  });
}

function toggleFavorite(id) {
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((item) => item !== id)
    : [...state.favorites, id];
  localStorage.setItem("gamehub-favorites", JSON.stringify(state.favorites));
  renderFavorites();
  renderGames();
}

function setupApps() {
  $("#notesBtn").addEventListener("click", () => $("#notesModal").classList.add("open"));
  $("#timerBtn").addEventListener("click", () => $("#timerModal").classList.add("open"));
  $("#randomAppBtn").addEventListener("click", () => randomGame());
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(button.dataset.close);
      if (modal) modal.classList.remove("open");
    });
  });
}

function loadNotes() {
  $("#notesArea").value = localStorage.getItem("gamehub-notes") || "";
}

function updateTimerDisplay() {
  $("#timerDisplay").textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      showToast("Timer finished.");
      return;
    }
    timerSeconds -= 1;
    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 300;
  updateTimerDisplay();
}

function randomGame() {
  if (!state.games.length) return showToast("No games are loaded.");
  launchGame(state.games[Math.floor(Math.random() * state.games.length)]);
}

function setupSettings() {
  $("#animationsToggle").checked = localStorage.getItem("gamehub-animations") !== "false";
  $("#compactToggle").checked = localStorage.getItem("gamehub-compact") === "true";

  $("#animationsToggle").addEventListener("change", () => {
    localStorage.setItem("gamehub-animations", $("#animationsToggle").checked ? "true" : "false");
    applySettings();
  });
  $("#compactToggle").addEventListener("change", () => {
    localStorage.setItem("gamehub-compact", $("#compactToggle").checked ? "true" : "false");
    applySettings();
  });
  $("#resetFavorites").addEventListener("click", () => {
    state.favorites = [];
    localStorage.setItem("gamehub-favorites", "[]");
    renderFavorites();
    renderGames();
  });

  applySettings();
}

function applySettings() {
  document.body.classList.toggle("no-animations", !$("#animationsToggle").checked);
  document.body.classList.toggle("compact", $("#compactToggle").checked);
}

function setupKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput").focus();
    }
    if (event.key === "Escape") {
      closePlayer();
    }
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}
