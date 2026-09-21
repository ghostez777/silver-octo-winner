let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let allGames = [];

async function loadGames() {
    const gamesContainer = document.getElementById("games");

    try {
        const response = await fetch("./games.json");
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        
        allGames = await response.json();
        renderGames(allGames);
        setupSearch();

    } catch (error) {
        console.error("Failed to load games:", error);
        gamesContainer.innerHTML = "<div class='empty-state'>Failed to load games catalog.</div>";
    }
}

function renderGames(gamesToRender) {
    const gamesContainer = document.getElementById("games");
    const favoritesContainer = document.getElementById("favorites");
    const favoritesSection = document.getElementById("favorites-section");

    gamesContainer.innerHTML = "";
    favoritesContainer.innerHTML = "";

    const favoriteGames = gamesToRender.filter(game => favorites.includes(game.id));

    if (favoriteGames.length > 0) {
        favoritesSection.classList.remove("hidden");
        favoriteGames.forEach(game => favoritesContainer.appendChild(createGameCard(game)));
    } else {
        favoritesSection.classList.add("hidden");
    }

    if (gamesToRender.length === 0) {
        gamesContainer.innerHTML = "<div class='empty-state'>No matching games found.</div>";
    } else {
        gamesToRender.forEach(game => gamesContainer.appendChild(createGameCard(game)));
    }
}

function createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game";
    const isFav = favorites.includes(game.id);

    card.innerHTML = `
        <img src="${game.thumb}" class="thumb" alt="${game.name}" loading="lazy" decoding="async">
        <div class="game-overlay">
            <h3>${game.name}</h3>
        </div>
        <button class="favoriteBtn ${isFav ? '' : 'inactive'}" aria-label="Favorite">
            ${isFav ? '★' : '☆'}
        </button>
    `;

    card.querySelector(".favoriteBtn").addEventListener("click", e => {
        e.stopPropagation();
        toggleFavorite(game.id);
    });

    card.addEventListener("click", () => loadGame(game));
    return card;
}

function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(gameId => gameId !== id);
    } else {
        favorites.push(id);
    }

    localStorage.setItem("favorites", JSON.stringify(favorites));
    const searchTerm = document.getElementById("search").value.toLowerCase().trim();
    renderGames(allGames.filter(game => game.name.toLowerCase().includes(searchTerm)));
}

async function loadGame(game) {
    const modal = document.getElementById("player-modal");
    const player = document.getElementById("player");
    const title = document.getElementById("player-title");

    player.innerHTML = "";
    title.textContent = game.name;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Standard HTML5 / Embedded Iframe Games
    if (game.html) {
        const iframe = document.createElement("iframe");
        iframe.src = game.html;
        iframe.allow = "autoplay; fullscreen; accelerometer; gyroscope; clipboard-read; clipboard-write";
        iframe.loading = "eager";
        player.appendChild(iframe);
        return;
    }

    // Flash Games via Ruffle Engine
    if (game.file) {
        try {
            let attempts = 0;
            while (!window.RufflePlayer && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.RufflePlayer) {
                player.innerHTML = "<div class='empty-state'>Error loading Ruffle Flash engine.</div>";
                return;
            }

            const ruffle = window.RufflePlayer.newest();
            const playerInstance = ruffle.createPlayer();
            player.appendChild(playerInstance);

            // Hardware Performance Config
            playerInstance.config = {
                autoplay: "on",
                unmuteOverlay: "hidden",
                letterbox: "on",
                forceScale: true,
                quality: "high",
                graphicsBackends: ["webgl"],
                preferredRenderer: "webgl"
            };

            playerInstance.load(game.file);

        } catch (error) {
            console.error("Error launching game:", error);
            player.innerHTML = "<div class='empty-state'>Could not load flash file.</div>";
        }
    }
}

function closeGame() {
    const modal = document.getElementById("player-modal");
    const player = document.getElementById("player");
    modal.classList.remove("active");
    player.innerHTML = "";
    document.body.style.overflow = "";
}

function toggleFullscreen() {
    const player = document.getElementById("player");
    if (!document.fullscreenElement) {
        player.requestFullscreen().catch(err => console.error(err));
    } else {
        document.exitFullscreen();
    }
}

document.getElementById("closeGameBtn").addEventListener("click", closeGame);
document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);

function setupSearch() {
    const search = document.getElementById("search");
    search.oninput = () => {
        const term = search.value.toLowerCase().trim();
        renderGames(allGames.filter(game => game.name.toLowerCase().includes(term)));
    };
}

loadGames();
