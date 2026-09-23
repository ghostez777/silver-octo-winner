const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const state = { games: [], filter: "all", currentGame: null, favorites: loadFavorites() };
let timerSeconds = 300;
let timerInterval = null;
let toastTimeout;

function loadFavorites() { try { const value = JSON.parse(localStorage.getItem("gamehub-favorites") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation(); setupSearch(); setupFilters(); setupPlayer(); setupApps(); setupSettings(); setupKeyboard(); loadNotes(); loadGames();
});

async function loadGames() {
  try {
    const response = await fetch("games.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`games.json returned ${response.status}`);
    const data = JSON.parse(await response.text());
    state.games = Array.isArray(data) ? data : Array.isArray(data.games) ? data.games : [];
    updateGameCount(); renderEverything();
  } catch (error) { console.error(error); $("#gameCount").textContent = "Games could not load"; showLoadError(); }
}
function showLoadError() { ["#gamesGrid", "#gbaGrid", "#favoritesGrid"].forEach(selector => { const el = $(selector); if (el) el.innerHTML = `<div class="empty-state"><strong>Games could not be loaded</strong><p>Make sure games.json is next to index.html and use a web server.</p></div>`; }); }
function updateGameCount() { $("#gameCount").textContent = `${state.games.length} games · ${state.games.filter(game => game.gba).length} GBA`; }
function renderEverything() { renderGames(); renderGBA(); renderFavorites(); }
function getGameType(game) { return game.gba ? "Game Boy Advance" : game.file ? "Flash / Ruffle" : game.html ? "Browser Game" : "Game"; }

function createGameCard(game) {
  const favorite = state.favorites.includes(game.id);
  const card = document.createElement("article"); card.className = "game-card";
  const image = game.thumb ? `<img class="game-thumb" src="${escapeAttribute(game.thumb)}" alt="${escapeAttribute(game.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="game-thumb-fallback" style="display:none">🎮</div>` : `<div class="game-thumb-fallback">${game.gba ? "🕹️" : "🎮"}</div>`;
  card.innerHTML = `${image}<button class="favorite-button ${favorite ? "active" : ""}" title="Favorite" data-favorite="${escapeAttribute(game.id)}">${favorite ? "★" : "☆"}</button><div class="game-info"><h3>${escapeHTML(game.name)}</h3><p>${getGameType(game)}</p></div>`;
  card.addEventListener("click", event => { if (!event.target.closest("[data-favorite]")) launchGame(game); });
  card.querySelector("[data-favorite]").addEventListener("click", event => { event.stopPropagation(); toggleFavorite(game.id); });
  return card;
}
function renderGames() { let games = [...state.games]; if (state.filter === "html") games = games.filter(game => game.html); if (state.filter === "swf") games = games.filter(game => game.file); if (state.filter === "gba") games = games.filter(game => game.gba); renderCards($("#gamesGrid"), games, "No games match this filter."); }
function renderGBA() { renderCards($("#gbaGrid"), state.games.filter(game => game.gba), "No GBA games have been added yet."); }
function renderFavorites() { renderCards($("#favoritesGrid"), state.games.filter(game => state.favorites.includes(game.id)), "You haven't added any favorites yet."); }
function renderCards(container, games, emptyMessage) { if (!container) return; container.innerHTML = games.length ? "" : `<div class="empty-state"><strong>${escapeHTML(emptyMessage)}</strong><p>Try another search or filter.</p></div>`; games.forEach(game => container.appendChild(createGameCard(game))); }

function launchGame(game) {
  state.currentGame = game;
  if (game.gba) return void (window.location.href = `jsemu/?rom=${encodeURIComponent(game.gba)}`);
  if (game.html) return /^https?:\/\//i.test(game.html) ? window.open(game.html, "_blank", "noopener,noreferrer") : openPlayer(game, game.html);
  if (game.file) return openRufflePlayer(game);
  showToast("This game does not have a playable location yet.");
}
function openPlayer(game, url) { state.currentGame = game; $("#playerTitle").textContent = game.name; $("#gameFrame").src = url; $("#gameFrame").style.display = "block"; $("#ruffleFrame").style.display = "none"; $("#playerModal").classList.add("open"); document.body.style.overflow = "hidden"; }
async function openRufflePlayer(game) { const frame = $("#gameFrame"), ruffleFrame = $("#ruffleFrame"); state.currentGame = game; $("#playerTitle").textContent = game.name; frame.src = ""; frame.style.display = "none"; ruffleFrame.innerHTML = ""; ruffleFrame.style.display = "block"; $("#playerModal").classList.add("open"); document.body.style.overflow = "hidden"; try { if (!window.RufflePlayer?.newest) throw new Error("Ruffle did not initialize."); const player = window.RufflePlayer.newest().createPlayer(); player.style.cssText = "width:100%;height:100%"; ruffleFrame.appendChild(player); await player.ruffle().load({ url: new URL(game.file, window.location.href).href, autoplay: "auto", allowNetworking: "all", allowFullscreen: true, letterbox: "fullscreen" }); } catch (error) { ruffleFrame.innerHTML = `<div class="player-error"><div><h2>Ruffle could not load this game</h2><p>${escapeHTML(error.message || String(error))}</p></div></div>`; } }
function closePlayer() { $("#playerModal").classList.remove("open"); $("#gameFrame").src = ""; $("#ruffleFrame").innerHTML = ""; document.body.style.overflow = ""; }
function setupPlayer() { $("#closePlayer").addEventListener("click", closePlayer); $("#playerModal").addEventListener("click", event => { if (event.target === $("#playerModal")) closePlayer(); }); $("#fullscreenBtn").addEventListener("click", () => $("#gameFrame").requestFullscreen?.()); $("#openNewTab").addEventListener("click", () => { const game = state.currentGame; if (!game) return; window.open(game.gba ? `jsemu/?rom=${encodeURIComponent(game.gba)}` : game.html || `ruffle/index.html?game=${encodeURIComponent(game.file)}`, "_blank"); }); }

function setupNavigation() { $$('[data-page]').forEach(button => button.addEventListener("click", () => showPage(button.dataset.page))); }
function showPage(id) { const target = $(`#${id}`); if (target) target.scrollIntoView({ behavior: "smooth", block: "start" }); }
function setupSearch() { $("#searchInput").addEventListener("input", event => { const query = event.target.value.trim().toLowerCase(); const games = query ? state.games.filter(game => String(game.name).toLowerCase().includes(query)) : state.games; renderCards($("#gamesGrid"), games, "No games found."); $("#gamesSection").scrollIntoView({ behavior: "smooth", block: "start" }); }); }
function setupFilters() { $$(".filter").forEach(button => button.addEventListener("click", () => { $$(".filter").forEach(item => item.classList.remove("active")); button.classList.add("active"); state.filter = button.dataset.filter; renderGames(); })); }
function toggleFavorite(id) { state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id]; localStorage.setItem("gamehub-favorites", JSON.stringify(state.favorites)); renderEverything(); showToast(state.favorites.includes(id) ? "Added to favorites." : "Removed from favorites."); }

function setupApps() { $("#notesBtn").addEventListener("click", () => $("#notesModal").classList.add("open")); $("#timerBtn").addEventListener("click", () => $("#timerModal").classList.add("open")); $("#randomAppBtn").addEventListener("click", randomGame); $$('[data-close]').forEach(button => button.addEventListener("click", () => $(`#${button.dataset.close}`).classList.remove("open"))); $("#saveNotes").addEventListener("click", () => { localStorage.setItem("gamehub-notes", $("#notesArea").value); $("#notesModal").classList.remove("open"); showToast("Notes saved."); }); $("#timerStart").addEventListener("click", startTimer); $("#timerReset").addEventListener("click", resetTimer); }
function loadNotes() { $("#notesArea").value = localStorage.getItem("gamehub-notes") || ""; }
function updateTimerDisplay() { $("#timerDisplay").textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`; }
function startTimer() { if (timerInterval) return; timerInterval = setInterval(() => { if (timerSeconds <= 0) { clearInterval(timerInterval); timerInterval = null; showToast("Timer finished."); return; } timerSeconds--; updateTimerDisplay(); }, 1000); }
function resetTimer() { clearInterval(timerInterval); timerInterval = null; timerSeconds = 300; updateTimerDisplay(); }
function randomGame() { if (!state.games.length) return showToast("No games are loaded."); launchGame(state.games[Math.floor(Math.random() * state.games.length)]); }
function setupSettings() { $("#animationsToggle").checked = localStorage.getItem("gamehub-animations") !== "false"; $("#compactToggle").checked = localStorage.getItem("gamehub-compact") === "true"; applySettings(); $("#animationsToggle").addEventListener("change", () => { localStorage.setItem("gamehub-animations", $("#animationsToggle").checked); applySettings(); }); $("#compactToggle").addEventListener("change", () => { localStorage.setItem("gamehub-compact", $("#compactToggle").checked); applySettings(); }); $("#resetFavorites").addEventListener("click", () => { state.favorites = []; localStorage.removeItem("gamehub-favorites"); renderEverything(); showToast("Favorites reset."); }); }
function applySettings() { document.body.classList.toggle("no-animations", !$("#animationsToggle").checked); document.body.classList.toggle("compact", $("#compactToggle").checked); }
function setupKeyboard() { document.addEventListener("keydown", event => { if (event.ctrlKey && event.key.toLowerCase() === "k") { event.preventDefault(); $("#searchInput").focus(); } if (event.key === "Escape") { closePlayer(); $$(".small-modal").forEach(modal => modal.classList.remove("open")); } }); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove("show"), 2200); }
function escapeHTML(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value) { return escapeHTML(value); }
