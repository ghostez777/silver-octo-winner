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

    // Creates a fallback image URL matching your dark theme if the local file is missing
    const fallbackUrl = `https://placehold.co/600x400/1c253e/818cf8?text=${encodeURIComponent(game.name)}`;

    card.innerHTML = `
        <img src="${game.thumb}" 
             class="thumb" 
             alt="${game.name}" 
             loading="lazy" 
             decoding="async"
             onerror="this.onerror=null; this.src='${fallbackUrl}'">
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
    
    // Nuke the background UI and scrolling to save GPU
    document.body.style.overflow = "hidden";
    document.body.classList.add("playing"); 

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

            // Maximum Performance Hardware Config
            playerInstance.config = {
                autoplay: "on",
                unmuteOverlay: "hidden",
                letterbox: "on",
                forceScale: true,
                quality: "low",
                graphicsBackends: ["webgl"],
                preferredRenderer: "webgl",
                maxExecutionDuration: 15,
                allowScriptAccess: false 
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
    
    // Force iframe memory garbage collection before removing
    const iframe = player.querySelector('iframe');
    if (iframe) {
        iframe.src = "about:blank"; 
    }

    modal.classList.remove("active");
    player.innerHTML = "";
    
    // Restore the background UI
    document.body.style.overflow = "";
    document.body.classList.remove("playing");
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
