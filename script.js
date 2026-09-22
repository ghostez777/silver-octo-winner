const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = {
  games: [],
  filter: "all",
  favorites: JSON.parse(localStorage.getItem("gamehub-favorites") || "[]"),
  currentGame: null
};

let timerSeconds = 300;
let timerInterval = null;


/* =========================
   INITIALIZE
========================= */

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


/* =========================
   LOAD GAMES
========================= */

async function loadGames() {
  try {
    const response = await fetch("games.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`games.json returned ${response.status}`);
    }

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error("games.json is not valid JSON.");
    }

    /*
      Supports both:

      [
        {...},
        {...}
      ]

      and:

      {
        "games": [...]
      }
    */

    state.games = Array.isArray(data)
      ? data
      : Array.isArray(data.games)
        ? data.games
        : [];

    updateGameCount();
    renderEverything();

  } catch (error) {
    console.error("Could not load games.json:", error);

    state.games = [];

    $("#gameCount").textContent = "Could not load games";

    showLoadError();
  }
}


function showLoadError() {
  const containers = [
    "#featuredGames",
    "#gamesGrid",
    "#gbaGrid",
    "#gbaPreview",
    "#favoritesGrid"
  ];

  containers.forEach(selector => {
    const element = $(selector);

    if (!element) return;

    element.innerHTML = `
      <div class="empty-state">
        <strong>Games could not be loaded</strong>
        <p>
          Make sure <b>games.json</b> is in the same folder as
          <b>index.html</b>.
        </p>
        <p>
          If you opened the site using <b>file://</b>, use GitHub Pages
          or another web server instead.
        </p>
      </div>
    `;
  });
}


/* =========================
   RENDER
========================= */

function renderEverything() {
  renderFeatured();
  renderGames();
  renderGBA();
  renderFavorites();
}


function updateGameCount() {
  const normal = state.games.filter(game => !game.gba).length;
  const gba = state.games.filter(game => game.gba).length;

  $("#gameCount").textContent =
    `${state.games.length} games · ${gba} GBA`;
}


/* =========================
   GAME CARDS
========================= */

function createGameCard(game) {
  const favorite = state.favorites.includes(game.id);

  const card = document.createElement("article");
  card.className = "game-card";

  const image = game.thumb
    ? `
      <img
        class="game-thumb"
        src="${escapeAttribute(game.thumb)}"
        alt="${escapeAttribute(game.name)}"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
      >
      <div class="game-thumb-fallback" style="display:none">
        🎮
      </div>
    `
    : `
      <div class="game-thumb-fallback">
        ${game.gba ? "🕹️" : "🎮"}
      </div>
    `;

  card.innerHTML = `
    ${image}

    <button
      class="favorite-button ${favorite ? "active" : ""}"
      title="Favorite"
      data-favorite="${escapeAttribute(game.id)}"
    >
      ${favorite ? "★" : "☆"}
    </button>

    <div class="game-info">
      <h3>${escapeHTML(game.name)}</h3>
      <p>${getGameType(game)}</p>
    </div>
  `;

  card.addEventListener("click", (event) => {
    if (event.target.closest("[data-favorite]")) return;

    launchGame(game);
  });

  const favoriteButton = card.querySelector("[data-favorite]");

  favoriteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(game.id);
  });

  return card;
}


function renderFeatured() {
  const container = $("#featuredGames");

  if (!container) return;

  const featured = state.games
    .filter(game => !game.gba)
    .slice(0, 8);

  renderCards(container, featured, "No games found.");
}


function renderGames() {
  const container = $("#gamesGrid");

  if (!container) return;

  let games = [...state.games];

  if (state.filter === "html") {
    games = games.filter(game => game.html);
  }

  if (state.filter === "swf") {
    games = games.filter(game => game.file);
  }

  if (state.filter === "gba") {
    games = games.filter(game => game.gba);
  }

  renderCards(container, games, "No games match this filter.");
}


function renderGBA() {
  const gbaGames = state.games.filter(game => game.gba);

  renderCards(
    $("#gbaGrid"),
    gbaGames,
    "No GBA games have been added yet."
  );

  renderCards(
    $("#gbaPreview"),
    gbaGames.slice(0, 8),
    "No GBA games have been added yet."
  );
}


function renderFavorites() {
  const favorites = state.games.filter(game =>
    state.favorites.includes(game.id)
  );

  renderCards(
    $("#favoritesGrid"),
    favorites,
    "You haven't added any favorites yet."
  );
}


function renderCards(container, games, emptyMessage) {
  if (!container) return;

  container.innerHTML = "";

  if (!games.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>${escapeHTML(emptyMessage)}</strong>
        <p>Try searching for another game.</p>
      </div>
    `;

    return;
  }

  games.forEach(game => {
    container.appendChild(createGameCard(game));
  });
}


/* =========================
   GAME TYPES
========================= */

function getGameType(game) {
  if (game.gba) return "Game Boy Advance";
  if (game.file) return "Flash / Ruffle";
  if (game.html) return "Browser Game";

  return "Game";
}


/* =========================
   GBA + GAME LAUNCHING
========================= */

function launchGame(game) {
  state.currentGame = game;

  /*
    IMPORTANT:

    Your actual /gba/index.html contains links like:

    ./player#pokemonemerald

    Therefore a GBA game must use:

    gba/player#pokemonemerald

    NOT:

    gba/roms/pokemonem.gba
  */

  if (game.gba) {
    const emulatorURL =
      `gba/player#${encodeURIComponent(game.gba)}`;

    window.location.href = emulatorURL;
    return;
  }

  /*
    HTML games can be loaded into our player.
  */

  if (game.html) {
    /*
      External browser games are often blocked when nested inside
      another iframe by their hosting site's frame/CSP rules.
      Open external games directly in a new tab instead.

      Local games stay inside GameHub's player so their relative
      JS/CSS/assets continue to resolve from their own /games/... folder.
    */
    if (/^https?:\\/\\//i.test(game.html)) {
      window.open(game.html, "_blank", "noopener,noreferrer");
    } else {
      openPlayer(game, game.html);
    }
    return;
  }

  /*
    SWF games are sent through the existing Ruffle page.
  */

  if (game.file) {
    openRufflePlayer(game);
    return;
  }

  showToast("This game doesn't have a playable location yet.");
}


/* =========================
   PLAYER
========================= */

function openPlayer(game, url) {
  state.currentGame = game;

  $("#playerTitle").textContent = game.name;
  $("#gameFrame").style.display = "block";
  $("#ruffleFrame").style.display = "none";
  $("#gameFrame").src = url;

  $("#playerModal").classList.add("open");
  document.body.style.overflow = "hidden";

  requestGameFullscreen();
}


async function openRufflePlayer(game) {
  state.currentGame = game;

  const iframe = $("#gameFrame");
  const ruffleFrame = $("#ruffleFrame");

  $("#playerTitle").textContent = game.name;

  iframe.src = "";
  iframe.style.display = "none";

  ruffleFrame.innerHTML = "";
  ruffleFrame.style.display = "block";

  $("#playerModal").classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    if (!window.RufflePlayer || !window.RufflePlayer.newest) {
      throw new Error("Ruffle did not initialize.");
    }

    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();

    player.style.width = "100%";
    player.style.height = "100%";

    ruffleFrame.appendChild(player);

    const swfUrl = new URL(game.file, window.location.href).href;

    await player.ruffle().load({
      url: swfUrl,
      autoplay: "auto",
      allowNetworking: "all",
      allowFullscreen: true,
      letterbox: "fullscreen"
    });

    requestGameFullscreen();
  } catch (error) {
    console.error("Ruffle failed to load:", error);
    ruffleFrame.innerHTML = `
      <div style="height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;color:white;background:#080b12;text-align:center;font-family:system-ui,sans-serif">
        <div>
          <h2>Ruffle could not load this game</h2>
          <p>Make sure the SWF file exists in the <code>/games/</code> folder.</p>
          <p style="opacity:.7">${escapeHTML(error.message || String(error))}</p>
        </div>
      </div>
    `;
  }
}


async function requestGameFullscreen() {
  const player = $("#playerModal");

  if (!player || !player.requestFullscreen || !document.fullscreenEnabled) {
    return;
  }

  try {
    await player.requestFullscreen({ navigationUI: "hide" });
  } catch (error) {
    // Some browsers or embedded game hosts may not permit fullscreen.
    console.debug("Fullscreen request was not allowed:", error);
  }
}


function closePlayer() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }

  $("#playerModal").classList.remove("open");

  $("#gameFrame").src = "";
  $("#gameFrame").style.display = "block";

  $("#ruffleFrame").innerHTML = "";
  $("#ruffleFrame").style.display = "none";

  document.body.style.overflow = "";
}


function setupPlayer() {
  $("#closePlayer").addEventListener("click", closePlayer);

  $("#playerModal").addEventListener("click", (event) => {
    if (event.target === $("#playerModal")) {
      closePlayer();
    }
  });

  $("#fullscreenBtn").addEventListener("click", async () => {
    const frame = $("#gameFrame");

    try {
      if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      }
    } catch {
      showToast("Fullscreen isn't available here.");
    }
  });

  $("#openNewTab").addEventListener("click", () => {
    if (!state.currentGame) return;

    const game = state.currentGame;

    if (game.gba) {
      window.open(
        `jsemu/?rom=${encodeURIComponent(game.gba)}`,
        "_blank"
      );
      return;
    }

    if (game.html) {
      window.open(game.html, "_blank");
      return;
    }

    if (game.file) {
      window.open(
        `ruffle/index.html?game=${encodeURIComponent(game.file)}`,
        "_blank"
      );
    }
  });
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {
  $$("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });
}


function showPage(pageName) {
  $$(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const target = $(`#page-${pageName}`);

  if (target) {
    target.classList.add("active-page");
  }

  $$(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   SEARCH
========================= */

function setupSearch() {
  $("#searchInput").addEventListener("input", () => {
    const query =
      $("#searchInput").value
        .trim()
        .toLowerCase();

    if (!query) {
      renderGames();
      return;
    }

    showPage("games");

    const results = state.games.filter(game =>
      game.name.toLowerCase().includes(query)
    );

    renderCards(
      $("#gamesGrid"),
      results,
      "No games found."
    );
  });
}


/* =========================
   FILTERS
========================= */

function setupFilters() {
  $$(".filter").forEach(button => {
    button.addEventListener("click", () => {

      $$(".filter").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      state.filter = button.dataset.filter;

      renderGames();
    });
  });
}


/* =========================
   FAVORITES
========================= */

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites =
      state.favorites.filter(item => item !== id);

    showToast("Removed from favorites.");
  } else {
    state.favorites.push(id);

    showToast("Added to favorites.");
  }

  localStorage.setItem(
    "gamehub-favorites",
    JSON.stringify(state.favorites)
  );

  renderEverything();
}


/* =========================
   APPS
========================= */

function setupApps() {
  $("#notesBtn").addEventListener("click", () => {
    $("#notesModal").classList.add("open");
  });

  $("#timerBtn").addEventListener("click", () => {
    $("#timerModal").classList.add("open");
  });

  $("#randomAppBtn").addEventListener("click", randomGame);

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.close;

      $(`#${id}`).classList.remove("open");
    });
  });

  $("#saveNotes").addEventListener("click", () => {
    localStorage.setItem(
      "gamehub-notes",
      $("#notesArea").value
    );

    $("#notesModal").classList.remove("open");

    showToast("Notes saved.");
  });

  $("#timerStart").addEventListener("click", startTimer);
  $("#timerReset").addEventListener("click", resetTimer);
}


function loadNotes() {
  $("#notesArea").value =
    localStorage.getItem("gamehub-notes") || "";
}


/* =========================
   TIMER
========================= */

function updateTimerDisplay() {
  const minutes =
    Math.floor(timerSeconds / 60)
      .toString()
      .padStart(2, "0");

  const seconds =
    (timerSeconds % 60)
      .toString()
      .padStart(2, "0");

  $("#timerDisplay").textContent =
    `${minutes}:${seconds}`;
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

    timerSeconds--;

    updateTimerDisplay();
  }, 1000);
}


function resetTimer() {
  clearInterval(timerInterval);

  timerInterval = null;
  timerSeconds = 300;

  updateTimerDisplay();
}


/* =========================
   RANDOM GAME
========================= */

function randomGame() {
  if (!state.games.length) {
    showToast("No games are loaded.");
    return;
  }

  const game =
    state.games[
      Math.floor(Math.random() * state.games.length)
    ];

  launchGame(game);
}


$("#randomBtn").addEventListener("click", randomGame);


/* =========================
   SETTINGS
========================= */

function setupSettings() {
  const animations =
    localStorage.getItem("gamehub-animations") !== "false";

  const compact =
    localStorage.getItem("gamehub-compact") === "true";

  $("#animationsToggle").checked = animations;
  $("#compactToggle").checked = compact;

  applySettings();

  $("#animationsToggle").addEventListener("change", () => {
    localStorage.setItem(
      "gamehub-animations",
      $("#animationsToggle").checked
    );

    applySettings();
  });

  $("#compactToggle").addEventListener("change", () => {
    localStorage.setItem(
      "gamehub-compact",
      $("#compactToggle").checked
    );

    applySettings();
  });

  $("#resetFavorites").addEventListener("click", () => {
    state.favorites = [];

    localStorage.removeItem("gamehub-favorites");

    renderEverything();

    showToast("Favorites reset.");
  });
}


function applySettings() {
  const animations = $("#animationsToggle").checked;
  const compact = $("#compactToggle").checked;

  document.body.classList.toggle(
    "no-animations",
    !animations
  );

  document.body.classList.toggle(
    "compact",
    compact
  );
}


/* =========================
   KEYBOARD SHORTCUTS
========================= */

function setupKeyboard() {
  document.addEventListener("keydown", event => {

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();

      $("#searchInput").focus();
    }

    if (event.key === "Escape") {
      closePlayer();

      $$(".small-modal").forEach(modal => {
        modal.classList.remove("open");
      });
    }
  });
}


/* =========================
   TOAST
========================= */

let toastTimeout;

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


/* =========================
   SECURITY / HTML HELPERS
========================= */

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
