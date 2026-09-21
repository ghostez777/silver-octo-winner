let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let allGames = [];

async function loadGames() {
    const gamesContainer = document.getElementById("games");

    try {
        const response = await fetch("./games.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allGames = await response.json();

        renderGames(allGames);
        setupSearch();

    } catch (error) {
        console.error("Error loading games:", error);
        gamesContainer.innerHTML = "<div class='empty-state'>Failed to load games. Please refresh the page.</div>";
    }
}

function renderGames(gamesToRender) {
    const gamesContainer = document.getElementById("games");
    const favoritesContainer = document.getElementById("favorites");
    const favoritesSection = document.getElementById("favorites-section");

    gamesContainer.innerHTML = "";
    favoritesContainer.innerHTML = "";

    const favoriteGames = gamesToRender.filter(game => favorites.includes(game.id));

    // Favorites visibility & render
    if (favoriteGames.length > 0) {
        favoritesSection.classList.remove("hidden");
        favoriteGames.forEach(game => {
            favoritesContainer.appendChild(createGameCard(game));
        });
    } else {
        favoritesSection.classList.add("hidden");
    }

    // All Games render
    if (gamesToRender.length === 0) {
        gamesContainer.innerHTML = "<div class='empty-state'>No games found matching your search.</div>";
    } else {
        gamesToRender.forEach(game => {
            gamesContainer.appendChild(createGameCard(game));
        });
    }
}

function createGameCard(game) {
    const card = document.createElement("div");
    card.className = "game";

    const isFav = favorites.includes(game.id);

    card.innerHTML = `
        <img src="${game.thumb}" class="thumb" alt="${game.name}" loading="lazy">
        <div class="game-overlay">
            <h3>${game.name}</h3>
        </div>
        <button class="favoriteBtn ${isFav ? '' : 'inactive'}" aria-label="Favorite">
            ${isFav ? '★' : '☆'}
        </button>
    `;

    const starBtn = card.querySelector(".favoriteBtn");
    starBtn.addEventListener("click", e => {
        e.stopPropagation();
        toggleFavorite(game.id);
    });

    card.addEventListener("click", () => {
        loadGame(game);
    });

    return card;
}

function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(gameId => gameId !== id);
    } else {
        favorites.push(id);
    }

    localStorage.setItem("favorites", JSON.stringify(favorites));

    // Re-render based on current search state
    const searchVal = document.getElementById("search").value.toLowerCase().trim();
    const filtered = allGames.filter(game => game.name.toLowerCase().includes(searchVal));
    renderGames(filtered);
}

async function loadGame(game) {
    const modal = document.getElementById("player-modal");
    const player = document.getElementById("player");
    const title = document.getElementById("player-title");

    player.innerHTML = "";
    title.textContent = game.name;
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent scrolling when open

    if (game.html) {
        const iframe = document.createElement("iframe");
        iframe.src = game.html;
        iframe.allow = "fullscreen";
        player.appendChild(iframe);
        return;
    }

    if (game.file) {
        try {
            let attempts = 0;
            while (!window.RufflePlayer && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.RufflePlayer) {
                player.innerHTML = "<div class='empty-state'>Error: Flash player failed to load.</div>";
                return;
            }

            const ruffle = window.RufflePlayer.newest();
            const playerInstance = ruffle.createPlayer();
            player.appendChild(playerInstance);
            playerInstance.load(game.file);

        } catch (error) {
            console.error("Error loading game:", error);
            player.innerHTML = "<div class='empty-state'>Error launching flash game.</div>";
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

// Fullscreen capability for the modal player
function toggleFullscreen() {
    const player = document.getElementById("player");
    if (!document.fullscreenElement) {
        player.requestFullscreen().catch(err => {
            console.error(`Fullscreen error: ${err.message}`);
        });
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
        const filteredGames = allGames.filter(game => game.name.toLowerCase().includes(term));
        renderGames(filteredGames);
    };
}

loadGames();
