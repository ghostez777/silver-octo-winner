const gameListEl = document.getElementById("game-list");
const gameFrame = document.getElementById("game-frame");
const gameTitleEl = document.getElementById("game-title");
const refreshBtn = document.getElementById("refresh-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");

let games = [];
let currentGame = null;

async function loadGames() {
  try {
    const res = await fetch("games.json");
    games = await res.json();
    renderGameList();
  } catch (err) {
    console.error("Failed to load games.json", err);
    gameTitleEl.textContent = "Error loading games list";
  }
}

function renderGameList() {
  gameListEl.innerHTML = "";
  games.forEach((game) => {
    const li = document.createElement("li");
    li.dataset.id = game.id;

    // Thumbnail
    const img = document.createElement("img");
    img.src = `thumbnails/${game.id}.png`;
    img.className = "game-thumb";

    const title = document.createElement("span");
    title.textContent = game.title;

    li.appendChild(img);
    li.appendChild(title);

    li.addEventListener("click", () => selectGame(game.id));
    gameListEl.appendChild(li);
  });
}

function selectGame(id) {
  const game = games.find((g) => g.id === id);
  if (!game) return;

  currentGame = game;
  gameTitleEl.textContent = game.title;
  gameFrame.src = game.url;

  [...gameListEl.children].forEach((li) => {
    li.classList.toggle("active", li.dataset.id === id);
  });
}

refreshBtn.addEventListener("click", () => {
  if (!currentGame || !gameFrame.src) return;
  gameFrame.src = gameFrame.src;
});

fullscreenBtn.addEventListener("click", () => {
  const iframe = document.getElementById("game-frame");

  if (iframe.requestFullscreen) iframe.requestFullscreen();
  else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
  else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
});

loadGames();
