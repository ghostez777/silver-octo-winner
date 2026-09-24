const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = {
  games: [],
  filter: "all",
  currentGame: null,
  favorites: loadFavorites()
};

let timerSeconds = 300;
let timerInterval = null;
let toastTimeout = null;

const SUPABASE_URL = "https://abmrhhqubpxmzrjvsqay.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oNPl0ont-81TGySbqG1roA_RX02JTFh";
const supabaseClient = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
let authMode = "login";


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
  setupKeyboard();
  setupAuth();
  loadNotes();
  setupNotes();
  loadGames();
});

function parseCatalog(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    // A previously edited catalog contained an unterminated GameSnacks URL.
    // Repair that one field so the remaining catalog can still be displayed.
    const repaired = text.replace(
      /(\"html\"\s*:\s*\"[^\n]*?features=\[[^\n]*?)(,\s*\"thumb\")/,
      '$1"$2'
    );

    if (repaired === text) {
      throw error;
    }

    return JSON.parse(repaired);
  }
}

async function loadGames() {
  const catalogUrls = [
    new URL("games.json", document.baseURI).href,
    "https://raw.githubusercontent.com/ghostez777/silver-octo-winner/main/games.json"
  ];

  let lastError = null;

  // Use a previously cached catalog immediately when available.
  try {
    const cached = localStorage.getItem("gamehub-games-cache");
    if (cached) {
      const parsed = parseCatalog(cached);
      const games = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.games) ? parsed.games : [];
      if (games.length) {
        state.games = games.filter((game) => game && typeof game === "object");
        updateGameCount();
        renderEverything();
      }
    }
  } catch (error) {
    console.warn("Could not use cached game catalog:", error);
  }

  for (const url of catalogUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const text = await response.text();
      const parsed = parseCatalog(text);
      const games = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.games) ? parsed.games : [];

      if (!games.length) throw new Error("Game catalog is empty.");

      state.games = games.filter((game) => game && typeof game === "object");
      try {
        localStorage.setItem("gamehub-games-cache", JSON.stringify(state.games));
      } catch (_) {}

      updateGameCount();
      renderEverything();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Could not load catalog from ${url}:`, error);
    }
  }

  if (!state.games.length) {
    console.error(lastError);
    $("#gameCount").textContent = "Games could not load";
    showLoadError();
  }
}

function showLoadError() {
  ["#gamesGrid", "#gbaGrid", "#favoritesGrid"].forEach((selector) => {
    const el = $(selector);

    if (el) {
      el.innerHTML = `
        <div class="empty-state">
          <strong>Games could not be loaded.</strong>
          <p>Check the catalog URL or reload the page.</p>
        </div>
      `;
    }
  });
}

function updateGameCount() {
  $("#gameCount").textContent =
    `${state.games.length} games · ${state.games.filter((game) => game.gba).length} GBA`;
}

function renderEverything() {
  renderGames();
}

function getGameType(game) {
  if (game.gba) return "Game Boy Advance";
  if (game.file) return "Flash / Ruffle";
  if (game.html) return "Browser Game";
  return "Game";
}

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
        ${escapeHTML(String(game.name || "G").slice(0, 1))}
      </div>
    `
    : `
      <div class="game-thumb-fallback">
        ${escapeHTML(String(game.name || "G").slice(0, 1))}
      </div>
    `;

  card.innerHTML = `
    ${image}

    <button
      class="favorite-button ${favorite ? "active" : ""}"
      title="Favorite"
      aria-label="${favorite ? "Remove favorite" : "Add favorite"}"
      data-favorite="${escapeAttribute(game.id)}"
      type="button"
    >
      ${favorite ? "★" : "☆"}
    </button>

    <div class="game-card-body">
      <h3>${escapeHTML(game.name || "Game")}</h3>
      <span>${escapeHTML(getGameType(game))}</span>
    </div>
  `;

  card.addEventListener("click", (event) => {
    if (!event.target.closest("[data-favorite]")) {
      launchGame(game);
    }
  });

  card.querySelector("[data-favorite]").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(game.id);
  });

  return card;
}

function renderGames() {
  let games = [...state.games];

  if (state.filter === "html") {
    games = games.filter((game) => game.html);
  }

  if (state.filter === "swf") {
    games = games.filter((game) => game.file);
  }

  if (state.filter === "gba") {
    games = games.filter((game) => game.gba);
  }

  renderCards(
    $("#gamesGrid"),
    games,
    "No games match your filter."
  );
}

function renderGBA() {
  renderCards(
    $("#gbaGrid"),
    state.games.filter((game) => game.gba),
    "No GBA games have been added yet."
  );
}

function renderFavorites() {
  renderCards(
    $("#favoritesGrid"),
    state.games.filter((game) =>
      state.favorites.includes(game.id)
    ),
    "You haven't added any favorites yet."
  );
}

function renderCards(container, games, emptyMessage) {
  if (!container) return;

  if (!games.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>${escapeHTML(emptyMessage)}</strong>
        <p>Try another filter or reload the collection.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  games.forEach((game) => {
    container.appendChild(createGameCard(game));
  });
}

function launchGame(game) {
  state.currentGame = game;

  if (game.gba) {
    window.location.href =
      `jsemu/?rom=${encodeURIComponent(game.gba)}`;
    return;
  }

  if (game.html) {
    openPlayer(game, game.html);
    return;
  }

  if (game.file) {
    openRufflePlayer(game);
    return;
  }

  showToast(
    "This game does not have a playable location yet."
  );
}

/* =========================================================
   HTML GAME PLAYER
   ========================================================= */

function openPlayer(game, url) {
  state.currentGame = game;

  const modal = $("#playerModal");
  const frame = $("#gameFrame");
  const ruffleFrame = $("#ruffleFrame");

  $("#playerTitle").textContent = game.name || "Game";

  // Make sure Ruffle is completely removed/hidden.
  ruffleFrame.replaceChildren();
  ruffleFrame.style.display = "none";

  // Load the HTML game.
  frame.src = new URL(url, document.baseURI).href;
  frame.style.display = "block";

  // Open the fullscreen player modal.
  modal.classList.add("open");

  // Prevent the page behind the game from scrolling.
  document.body.classList.add("player-open");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    frame.focus();
  });
}

/* =========================================================
   RUFFLE / FLASH PLAYER
   ========================================================= */

async function openRufflePlayer(game) {
  const modal = $("#playerModal");
  const frame = $("#gameFrame");
  const ruffleFrame = $("#ruffleFrame");

  state.currentGame = game;

  $("#playerTitle").textContent = game.name || "Game";

  // Completely reset the HTML iframe.
  frame.src = "about:blank";
  frame.style.display = "none";

  // Completely reset Ruffle container.
  ruffleFrame.replaceChildren();
  ruffleFrame.style.display = "block";

  // Open player.
  modal.classList.add("open");

  // Stop background page scrolling.
  document.body.classList.add("player-open");
  document.body.style.overflow = "hidden";

  try {
    /*
     * Use the modern self-hosted Ruffle API.
     *
     * Older versions used:
     *   player.load(...)
     *
     * Newer versions use:
     *   player.ruffle().load(...)
     */
    const ruffleApi =
      window.RufflePlayer &&
      typeof window.RufflePlayer.newest === "function"
        ? window.RufflePlayer.newest()
        : null;

    if (!ruffleApi) {
      throw new Error("Ruffle did not initialize.");
    }

    const player = ruffleApi.createPlayer();

    /*
     * Force the custom Ruffle player itself to fill
     * the entire available player container.
     *
     * The CSS in style.css handles the actual viewport
     * sizing and these inline values reinforce it.
     */
    player.style.display = "block";
    player.style.width = "100%";
    player.style.height = "100%";
    player.style.minWidth = "0";
    player.style.minHeight = "0";

    ruffleFrame.appendChild(player);

    const url =
      new URL(game.file, document.baseURI).href;

    await player.ruffle().load({
      url,
      autoplay: "auto",
      allowNetworking: "all",
      allowFullscreen: true,
      letterbox: "off"
    });

  } catch (error) {
    console.error(
      "Could not load Flash game:",
      error
    );

    ruffleFrame.innerHTML = `
      <div class="player-error">
        <div>
          <strong>This Flash game could not be loaded.</strong>
          <p>Check the SWF file and refresh the page.</p>
        </div>
      </div>
    `;
  }
}

/* =========================================================
   CLOSE PLAYER
   ========================================================= */

async function togglePlayerFullscreen() {
  const windowEl = $("#playerWindow");
  const button = $("#fullscreenPlayer");

  if (!document.fullscreenElement) {
    try {
      await windowEl.requestFullscreen();
    } catch (error) {
      showToast("Fullscreen is not available in this browser.");
    }
  } else {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Could not exit fullscreen:", error);
    }
  }

  syncFullscreenButton();
}

function syncFullscreenButton() {
  const button = $("#fullscreenPlayer");
  if (!button) return;

  const active = Boolean(document.fullscreenElement);
  button.textContent = active ? "×" : "⛶";
  button.title = active ? "Exit fullscreen" : "Fullscreen";
  button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
}

async function closePlayer() {
  const modal = $("#playerModal");
  const frame = $("#gameFrame");
  const ruffleFrame = $("#ruffleFrame");

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Could not exit fullscreen:", error);
    }
  }

  // Close modal.
  modal.classList.remove("open");

  // Stop HTML game.
  frame.src = "about:blank";
  frame.style.display = "none";

  // Destroy the Ruffle player.
  ruffleFrame.replaceChildren();
  ruffleFrame.style.display = "none";

  // Clear current game.
  state.currentGame = null;

  // Restore page scrolling.
  document.body.classList.remove("player-open");
  document.body.style.overflow = "";
}

/* =========================================================
   PLAYER CONTROLS
   ========================================================= */

function setupPlayer() {
  $("#closePlayer")?.addEventListener(
    "click",
    closePlayer
  );

  $("#fullscreenPlayer")?.addEventListener(
    "click",
    togglePlayerFullscreen
  );

  document.addEventListener(
    "fullscreenchange",
    syncFullscreenButton
  );

  /*
   * Open the current game in a new browser tab.
   */
  $("#openNewTab")?.addEventListener("click", () => {
    if (!state.currentGame) return;

    const game = state.currentGame;

    const url = game.gba
      ? `jsemu/?rom=${encodeURIComponent(game.gba)}`
      : game.html
        ? new URL(
            game.html,
            document.baseURI
          ).href
        : game.file
          ? new URL(
              game.file,
              document.baseURI
            ).href
          : "";

    if (url) {
      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  });

  /*
   * Close the player if the dark background itself
   * is clicked.
   */
  $("#playerModal")?.addEventListener("click", (event) => {
    if (event.target === $("#playerModal")) {
      closePlayer();
    }
  });
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {
  $$("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });
}

function showPage(id) {
  const target = $(`#${id}`);

  if (target) {
    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {
  $("#searchInput").addEventListener(
    "input",
    (event) => {
      const query =
        event.target.value
          .trim()
          .toLowerCase();

      const games = query
        ? state.games.filter((game) =>
            String(game.name || "")
              .toLowerCase()
              .includes(query)
          )
        : [...state.games];

      renderCards(
        $("#gamesGrid"),
        games,
        "No games match your search."
      );
    }
  );
}

/* =========================================================
   FILTERS
   ========================================================= */

function setupFilters() {
  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".filter").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      state.filter =
        button.dataset.filter || "all";

      renderGames();
    });
  });
}

/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(id) {
  state.favorites =
    state.favorites.includes(id)
      ? state.favorites.filter(
          (item) => item !== id
        )
      : [
          ...state.favorites,
          id
        ];

  localStorage.setItem(
    "gamehub-favorites",
    JSON.stringify(
      state.favorites
    )
  );

  renderFavorites();
  renderGames();
}

/* =========================================================
   QUICK APPS
   ========================================================= */

function setupApps() {
  $("#notesBtn").addEventListener(
    "click",
    () => {
      $("#notesModal").classList.add("open");
    }
  );

  $("#timerBtn").addEventListener(
    "click",
    () => {
      $("#timerModal").classList.add("open");
    }
  );

  $("#randomAppBtn")?.addEventListener(
    "click",
    randomGame
  );

  $("#timerStart").addEventListener(
    "click",
    startTimer
  );

  $("#timerReset").addEventListener(
    "click",
    resetTimer
  );

  document
    .querySelectorAll("[data-close]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const modal =
            document.getElementById(
              button.dataset.close
            );

          if (modal) {
            modal.classList.remove("open");
          }
        }
      );
    });
}

/* =========================================================
   NOTES
   ========================================================= */

function setupNotes() {
  $("#saveNotes").addEventListener(
    "click",
    () => {
      localStorage.setItem(
        "gamehub-notes",
        $("#notesArea").value
      );
    }
  );
}

function loadNotes() {
  $("#notesArea").value =
    localStorage.getItem(
      "gamehub-notes"
    ) || "";
}

/* =========================================================
   TIMER
   ========================================================= */

function updateTimerDisplay() {
  $("#timerDisplay").textContent =
    `${String(
      Math.floor(timerSeconds / 60)
    ).padStart(2, "0")}:${String(
      timerSeconds % 60
    ).padStart(2, "0")}`;
}

function startTimer() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;

      showToast(
        "Timer finished."
      );

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

/* =========================================================
   RANDOM GAME
   ========================================================= */

function randomGame() {
  if (!state.games.length) {
    showToast(
      "No games are loaded."
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

/* =========================================================
   SETTINGS
   ========================================================= */

function setupSettings() {
  $("#animationsToggle").checked =
    localStorage.getItem(
      "gamehub-animations"
    ) !== "false";

  $("#compactToggle").checked =
    localStorage.getItem(
      "gamehub-compact"
    ) === "true";

  $("#animationsToggle").addEventListener(
    "change",
    () => {
      localStorage.setItem(
        "gamehub-animations",
        $("#animationsToggle").checked
          ? "true"
          : "false"
      );

      applySettings();
    }
  );

  $("#compactToggle").addEventListener(
    "change",
    () => {
      localStorage.setItem(
        "gamehub-compact",
        $("#compactToggle").checked
          ? "true"
          : "false"
      );

      applySettings();
    }
  );

  $("#resetFavorites").addEventListener(
    "click",
    () => {
      state.favorites = [];

      localStorage.setItem(
        "gamehub-favorites",
        "[]"
      );

      renderFavorites();
      renderGames();
    }
  );

  applySettings();
}

function applySettings() {
  document.body.classList.toggle(
    "no-animations",
    !$("#animationsToggle").checked
  );

  document.body.classList.toggle(
    "compact",
    $("#compactToggle").checked
  );
}

/* =========================================================
   KEYBOARD
   ========================================================= */

function setupKeyboard() {
  document.addEventListener(
    "keydown",
    (event) => {
      /*
       * CTRL + K focuses the search box.
       */
      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        $("#searchInput").focus();
      }

      /*
       * ESC closes the game player.
       */
      if (event.key === "Escape") {
        closePlayer();
      }
    }
  );
}

/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

/* =========================================================
   SECURITY / HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(value) {
  return escapeHTML(value);
}


/* =========================================================
   GAMEHUB AUTH
   ========================================================= */

function setupAuth() {
  const authButton = $("#authButton");
  const authForm = $("#authForm");
  const authSwitch = $("#authSwitch");
  const authLogout = $("#authLogout");
  const authModal = $("#authModal");

  if (!supabaseClient || !authButton || !authForm) {
    console.warn("GameHub authentication could not initialize.");
    return;
  }

  authButton.addEventListener("click", async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      updateAuthUI(data.session);
      authModal.classList.add("open");
      authModal.setAttribute("aria-hidden", "false");
    } else {
      authMode = "login";
      updateAuthForm();
      authModal.classList.add("open");
      authModal.setAttribute("aria-hidden", "false");
    }
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const submit = $("#authSubmit");
    const status = $("#authStatus");

    submit.disabled = true;
    status.textContent = authMode === "login"
      ? "Logging in..."
      : "Creating your account...";

    try {
      const result = authMode === "login"
        ? await supabaseClient.auth.signInWithPassword({ email, password })
        : await supabaseClient.auth.signUp({ email, password });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        status.textContent = "Account created. Check your email to confirm it, then log in.";
        showToast("Check your email to finish signup.");
      } else {
        status.textContent = "You're logged in.";
        showToast("Logged in to GameHub.");
        authModal.classList.remove("open");
        authModal.setAttribute("aria-hidden", "true");
      }
    } catch (error) {
      console.error("GameHub auth error:", error);
      status.textContent = error?.message || "Could not complete that request.";
    } finally {
      submit.disabled = false;
    }
  });

  authSwitch.addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    updateAuthForm();
  });

  authLogout.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      $("#authStatus").textContent = error.message;
      return;
    }

    authModal.classList.remove("open");
    authModal.setAttribute("aria-hidden", "true");
    updateAuthUI(null);
    showToast("Logged out of GameHub.");
  });

  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close='authModal']");
    if (close) {
      authModal.classList.remove("open");
      authModal.setAttribute("aria-hidden", "true");
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    updateAuthUI(data.session);
  });
}

function updateAuthForm() {
  const title = $("#authTitle");
  const status = $("#authStatus");
  const submit = $("#authSubmit");
  const switchButton = $("#authSwitch");
  const logout = $("#authLogout");
  const form = $("#authForm");

  if (!title || !form) return;

  const loggedIn = Boolean(
    supabaseClient && document.body.dataset.gamehubLoggedIn === "true"
  );

  form.hidden = loggedIn;
  logout.hidden = !loggedIn;

  if (loggedIn) {
    title.textContent = "You're logged in";
    switchButton.hidden = true;
    return;
  }

  title.textContent = authMode === "login" ? "Log in" : "Create account";
  submit.textContent = authMode === "login" ? "Log in" : "Sign up";
  switchButton.textContent = authMode === "login"
    ? "Need an account? Sign up"
    : "Already have an account? Log in";
  switchButton.hidden = false;

  if (authMode === "login") {
    status.textContent = "Use your GameHub account to save your session.";
    $("#authPassword").autocomplete = "current-password";
  } else {
    status.textContent = "Create a GameHub account with your email and a password.";
    $("#authPassword").autocomplete = "new-password";
  }
}

function updateAuthUI(session) {
  const button = $("#authButton");
  const status = $("#authStatus");

  document.body.dataset.gamehubLoggedIn = session ? "true" : "false";

  if (!session) {
    button.textContent = "Login";
    if ($("#authForm")) $("#authForm").hidden = false;
    if ($("#authLogout")) $("#authLogout").hidden = true;
    if ($("#authSwitch")) $("#authSwitch").hidden = false;
    updateAuthForm();
    return;
  }

  button.textContent = "Account";
  if (status) status.textContent = session.user.email || "Signed in";
  updateAuthForm();
  updateAuthForm();
}
