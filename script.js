/* =========================================
   GAMEVAULT
   ========================================= */

const state = {
  games: [],
  favorites: JSON.parse(localStorage.getItem("gamevault-favorites") || "[]"),
  currentFilter: "all",
  currentGame: null,
  timer: null,
  timerSeconds: 300
};


/* =========================================
   ELEMENTS
   ========================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


/* =========================================
   START
   ========================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadGames();

  setupNavigation();
  setupSearch();
  setupButtons();
  setupSettings();
  setupModals();
  setupTimer();
  setupKeyboardShortcuts();

  renderAll();
}


/* =========================================
   LOAD GAMES
   ========================================= */

async function loadGames() {
  try {
    const response = await fetch("games.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load games.json");
    }

    const data = await response.json();

    state.games = Array.isArray(data) ? data : [];

  } catch (error) {
    console.error(error);

    state.games = [];

    showToast("Could not load games.json");
  }

  updateLibraryCount();
}


/* =========================================
   RENDER EVERYTHING
   ========================================= */

function renderAll() {
  renderRecent();
  renderGames();
  renderGBA();
  renderFavorites();
  updateLibraryInfo();
}


/* =========================================
   GAME CARD
   ========================================= */

function createGameCard(game) {

  const card = document.createElement("article");
  card.className = "game-card";

  const isFavorite = state.favorites.includes(game.id);

  const isGBA = Boolean(game.gba);

  const type = isGBA ? "GBA" : "BROWSER";

  const image = game.thumb
    ? `
      <img
        src="${escapeAttribute(game.thumb)}"
        alt=""
        loading="lazy"
        onerror="this.style.display='none'"
      >
    `
    : `
      <div class="game-placeholder">G</div>
    `;

  card.innerHTML = `
    <div class="game-image">

      ${image}

      <span class="game-type">${type}</span>

      <button
        class="favorite-button ${isFavorite ? "active" : ""}"
        title="Favorite"
        aria-label="Favorite ${escapeAttribute(game.name || "game")}"
      >
        ${isFavorite ? "♥" : "♡"}
      </button>

    </div>

    <div class="game-info">

      <div class="game-name">
        ${escapeHTML(game.name || "Unnamed Game")}
      </div>

      <div class="game-meta">
        <span>${type}</span>
        <span>Play →</span>
      </div>

    </div>
  `;


  /* Favorite button */

  const favoriteButton = card.querySelector(".favorite-button");

  favoriteButton.addEventListener("click", (event) => {
    event.stopPropagation();

    toggleFavorite(game.id);
  });


  /* Launch */

  card.addEventListener("click", () => {
    launchGame(game);
  });


  return card;
}


/* =========================================
   RENDER RECENT
   ========================================= */

function renderRecent() {

  const grid = $("#recentGrid");

  if (!grid) return;

  grid.innerHTML = "";

  const games = state.games.slice(0, 4);

  games.forEach((game) => {
    grid.appendChild(createGameCard(game));
  });
}


/* =========================================
   RENDER GAMES
   ========================================= */

function renderGames() {

  const grid = $("#gamesGrid");
  const empty = $("#gamesEmpty");

  if (!grid) return;

  const search = $("#searchInput")?.value
    .trim()
    .toLowerCase() || "";

  let games = state.games.filter((game) => {

    const matchesSearch =
      !search ||
      String(game.name || "")
        .toLowerCase()
        .includes(search);

    let matchesFilter = true;

    if (state.currentFilter === "gba") {
      matchesFilter = Boolean(game.gba);
    }

    if (state.currentFilter === "html") {
      matchesFilter = Boolean(game.html);
    }

    return matchesSearch && matchesFilter;
  });


  grid.innerHTML = "";

  games.forEach((game) => {
    grid.appendChild(createGameCard(game));
  });


  if (empty) {
    empty.classList.toggle("visible", games.length === 0);
  }
}


/* =========================================
   RENDER GBA
   ========================================= */

function renderGBA() {

  const grid = $("#gbaGrid");
  const empty = $("#gbaEmpty");

  if (!grid) return;

  const gbaGames = state.games.filter(
    (game) => Boolean(game.gba)
  );

  grid.innerHTML = "";

  gbaGames.forEach((game) => {
    grid.appendChild(createGameCard(game));
  });

  if (empty) {
    empty.classList.toggle(
      "visible",
      gbaGames.length === 0
    );
  }
}


/* =========================================
   RENDER FAVORITES
   ========================================= */

function renderFavorites() {

  const grid = $("#favoritesGrid");
  const empty = $("#favoritesEmpty");

  if (!grid) return;

  const games = state.games.filter((game) =>
    state.favorites.includes(game.id)
  );

  grid.innerHTML = "";

  games.forEach((game) => {
    grid.appendChild(createGameCard(game));
  });

  if (empty) {
    empty.classList.toggle(
      "visible",
      games.length === 0
    );
  }
}


/* =========================================
   FAVORITES
   ========================================= */

function toggleFavorite(id) {

  if (state.favorites.includes(id)) {

    state.favorites =
      state.favorites.filter(
        (favoriteId) => favoriteId !== id
      );

  } else {

    state.favorites.push(id);

  }

  localStorage.setItem(
    "gamevault-favorites",
    JSON.stringify(state.favorites)
  );

  renderAll();
}


/* =========================================
   LAUNCH GAME
   ========================================= */

function launchGame(game) {

  if (!game) return;

  const overlay = $("#playerOverlay");
  const player = $("#player");
  const title = $("#playerTitle");

  if (!overlay || !player) return;

  state.currentGame = game;

  player.innerHTML = "";

  title.textContent = game.name || "Game";


  /*
    HTML GAME

    Example games.json:

    {
      "id": "2048",
      "name": "2048",
      "html": "games/2048/2048/index.html"
    }
  */

  if (game.html) {

    const iframe = document.createElement("iframe");

    iframe.src = game.html;

    iframe.allow =
      "fullscreen; autoplay; gamepad; clipboard-read; clipboard-write";

    iframe.allowFullscreen = true;

    iframe.loading = "eager";

    player.appendChild(iframe);

    openPlayer();

    return;
  }


  /*
    GBA GAME

    The gba value should point to whatever URL/path
    your existing gba player expects.

    Example:

    {
      "id": "my-gba-game",
      "name": "My GBA Game",
      "gba": "roms/my-gba-game.gba"
    }

    If your existing /gba/ player uses a different
    URL format, only this section needs adjusting.
  */

  if (game.gba) {

    const iframe = document.createElement("iframe");

    iframe.src =
      "gba/player#" +
      encodeURIComponent(game.gba);

    iframe.allow =
      "fullscreen; autoplay; gamepad";

    iframe.allowFullscreen = true;

    iframe.loading = "eager";

    player.appendChild(iframe);

    openPlayer();

    return;
  }


  /*
    Optional Flash/Ruffle support.
  */

  if (game.file) {

    if (!window.RufflePlayer) {

      showToast(
        "Ruffle is not loaded."
      );

      return;
    }

    const ruffle =
      window.RufflePlayer.newest();

    const rufflePlayer =
      ruffle.createPlayer();

    rufflePlayer.style.width = "100%";
    rufflePlayer.style.height = "100%";

    player.appendChild(
      rufflePlayer
    );

    rufflePlayer.load(
      game.file
    );

    openPlayer();

    return;
  }


  showToast(
    "This game does not have a playable file."
  );
}


/* =========================================
   PLAYER
   ========================================= */

function openPlayer() {

  const overlay = $("#playerOverlay");

  overlay.classList.add("open");

  document.body.style.overflow = "hidden";
}


function closePlayer() {

  const overlay = $("#playerOverlay");
  const player = $("#player");

  overlay.classList.remove("open");

  player.innerHTML = "";

  document.body.style.overflow = "";

  state.currentGame = null;
}


function fullscreenPlayer() {

  const player = $("#player");

  if (!document.fullscreenElement) {

    player.requestFullscreen?.();

  } else {

    document.exitFullscreen?.();

  }
}


/* =========================================
   NAVIGATION
   ========================================= */

function setupNavigation() {

  $$(".nav-item").forEach((button) => {

    button.addEventListener("click", () => {

      const page =
        button.dataset.page;

      navigate(page);

      $("#sidebar")?.classList.remove(
        "mobile-open"
      );
    });
  });


  $$("[data-page]").forEach((button) => {

    if (button.classList.contains("nav-item")) {
      return;
    }

    button.addEventListener("click", () => {

      navigate(
        button.dataset.page
      );

    });
  });
}


function navigate(page) {

  if (!page) return;

  $$(".page").forEach((section) => {
    section.classList.remove("active");
  });

  const target =
    document.querySelector(
      `#page-${page}`
    );

  if (target) {
    target.classList.add("active");
  }


  $$(".nav-item").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.page === page
    );

  });


  const names = {
    home: "Home",
    games: "Games",
    gba: "GBA",
    favorites: "Favorites",
    apps: "Apps",
    settings: "Settings"
  };

  $("#pageTitle").textContent =
    names[page] || "Home";


  if (page === "games") {
    renderGames();
  }

  if (page === "gba") {
    renderGBA();
  }

  if (page === "favorites") {
    renderFavorites();
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================
   SEARCH
   ========================================= */

function setupSearch() {

  const input = $("#searchInput");

  if (!input) return;

  input.addEventListener("input", () => {

    navigate("games");

    renderGames();

  });
}


/* =========================================
   FILTERS
   ========================================= */

$$(".filter").forEach((button) => {

  button.addEventListener("click", () => {

    $$(".filter").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    state.currentFilter =
      button.dataset.filter;

    renderGames();

  });

});


/* =========================================
   BUTTONS
   ========================================= */

function setupButtons() {

  $("#browseGames")?.addEventListener(
    "click",
    () => navigate("games")
  );


  $("#randomButton")?.addEventListener(
    "click",
    randomGame
  );


  $("#randomHero")?.addEventListener(
    "click",
    randomGame
  );


  $("#appRandom")?.addEventListener(
    "click",
    randomGame
  );


  $("#notesButton")?.addEventListener(
    "click",
    () => openModal("notesModal")
  );


  $("#appNotes")?.addEventListener(
    "click",
    () => openModal("notesModal")
  );


  $("#timerButton")?.addEventListener(
    "click",
    () => openModal("timerModal")
  );


  $("#appTimer")?.addEventListener(
    "click",
    () => openModal("timerModal")
  );


  $("#closePlayer")?.addEventListener(
    "click",
    closePlayer
  );


  $("#fullscreenButton")?.addEventListener(
    "click",
    fullscreenPlayer
  );
}


/* =========================================
   RANDOM GAME
   ========================================= */

function randomGame() {

  if (!state.games.length) {

    showToast(
      "Your library is empty."
    );

    return;
  }

  const game =
    state.games[
      Math.floor(
        Math.random() *
        state.games.length
      )
    ];

  launchGame(game);
}


/* =========================================
   MODALS
   ========================================= */

function setupModals() {

  $$("[data-close]").forEach((button) => {

    button.addEventListener("click", () => {

      closeModal(
        button.dataset.close
      );

    });

  });


  $$(".modal").forEach((modal) => {

    modal.addEventListener("click", (event) => {

      if (event.target === modal) {
        modal.classList.remove("open");
      }

    });

  });


  const savedNotes =
    localStorage.getItem(
      "gamevault-notes"
    );

  if (savedNotes) {
    $("#notesArea").value = savedNotes;
  }


  $("#saveNotes")?.addEventListener(
    "click",
    () => {

      localStorage.setItem(
        "gamevault-notes",
        $("#notesArea").value
      );

      closeModal("notesModal");

      showToast("Notes saved.");

    }
  );
}


function openModal(id) {

  document
    .getElementById(id)
    ?.classList.add("open");

}


function closeModal(id) {

  document
    .getElementById(id)
    ?.classList.remove("open");

}


/* =========================================
   TIMER
   ========================================= */

function setupTimer() {

  updateTimerDisplay();


  $("#startTimer")?.addEventListener(
    "click",
    startTimer
  );


  $("#resetTimer")?.addEventListener(
    "click",
    resetTimer
  );
}


function startTimer() {

  clearInterval(state.timer);

  const minutes =
    Math.max(
      1,
      Math.min(
        120,
        Number(
          $("#timerMinutes").value
        ) || 5
      )
    );

  state.timerSeconds =
    minutes * 60;

  updateTimerDisplay();

  state.timer =
    setInterval(() => {

      state.timerSeconds--;

      updateTimerDisplay();

      if (state.timerSeconds <= 0) {

        clearInterval(
          state.timer
        );

        showToast(
          "Timer finished."
        );

      }

    }, 1000);
}


function resetTimer() {

  clearInterval(
    state.timer
  );

  const minutes =
    Number(
      $("#timerMinutes").value
    ) || 5;

  state.timerSeconds =
    minutes * 60;

  updateTimerDisplay();
}


function updateTimerDisplay() {

  const display =
    $("#timerDisplay");

  if (!display) return;

  const minutes =
    Math.floor(
      state.timerSeconds / 60
    );

  const seconds =
    state.timerSeconds % 60;

  display.textContent =
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0");
}


/* =========================================
   SETTINGS
   ========================================= */

function setupSettings() {

  const animations =
    $("#animationsToggle");

  const compact =
    $("#compactToggle");


  const savedAnimations =
    localStorage.getItem(
      "gamevault-animations"
    );

  if (savedAnimations === "false") {

    animations.checked = false;

    document.body.classList.add(
      "no-animations"
    );

  }


  animations?.addEventListener(
    "change",
    () => {

      document.body.classList.toggle(
        "no-animations",
        !animations.checked
      );

      localStorage.setItem(
        "gamevault-animations",
        animations.checked
      );

    }
  );


  compact?.addEventListener(
    "change",
    () => {

      document.body.classList.toggle(
        "compact",
        compact.checked
      );

      localStorage.setItem(
        "gamevault-compact",
        compact.checked
      );

    }
  );


  const savedCompact =
    localStorage.getItem(
      "gamevault-compact"
    );

  if (savedCompact === "true") {

    compact.checked = true;

    document.body.classList.add(
      "compact"
    );

  }
}


function updateLibraryInfo() {

  const info =
    $("#libraryInfo");

  if (!info) return;

  const gba =
    state.games.filter(
      game => game.gba
    ).length;

  info.textContent =
    `${state.games.length} total games • ${gba} GBA games`;
}


function updateLibraryCount() {

  const count =
    $("#gameCount");

  if (!count) return;

  count.textContent =
    `${state.games.length} ${
      state.games.length === 1
        ? "game"
        : "games"
    }`;
}


/* =========================================
   KEYBOARD
   ========================================= */

function setupKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {

        event.preventDefault();

        $("#searchInput")?.focus();

      }


      if (event.key === "Escape") {

        closePlayer();

        $$(".modal.open").forEach(
          modal =>
            modal.classList.remove("open")
        );

      }

    }
  );
}


/* =========================================
   MOBILE SIDEBAR
   ========================================= */

$("#mobileMenu")?.addEventListener(
  "click",
  () => {

    $(".sidebar")?.classList.toggle(
      "mobile-open"
    );

  }
);


/* =========================================
   TOAST
   ========================================= */

function showToast(message) {

  const existing =
    document.querySelector(
      ".gamevault-toast"
    );

  existing?.remove();


  const toast =
    document.createElement("div");

  toast.className =
    "gamevault-toast";

  toast.textContent =
    message;


  Object.assign(
    toast.style,
    {
      position: "fixed",
      left: "50%",
      bottom: "25px",
      transform: "translateX(-50%)",
      zIndex: "3000",
      padding: "10px 15px",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: "8px",
      background: "#171a21",
      color: "#fff",
      fontSize: "11px",
      boxShadow: "0 15px 40px rgba(0,0,0,.4)"
    }
  );


  document.body.appendChild(
    toast
  );


  setTimeout(() => {
    toast.remove();
  }, 2500);
}


/* =========================================
   SECURITY / TEXT HELPERS
   ========================================= */

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
