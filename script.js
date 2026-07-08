let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

async function loadGames() {
    const container = document.getElementById("games");
    const favContainer = document.getElementById("favorites");

    try {
        const res = await fetch("games.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const games = await res.json();
        container.innerHTML = "";
        favContainer.innerHTML = "";

        games.forEach(game => {
            const card = createGameCard(game);
            container.appendChild(card);

            if (favorites.includes(game.id)) {
                const favCard = createGameCard(game);
                favContainer.appendChild(favCard);
            }
        });

        setupSearch(games);

    } catch (err) {
        console.error("Error loading games list:", err);
        container.innerHTML =
            "<p style='text-align:center;color:red;'>Error loading games list.</p>";
    }
}

/* Create a game card (works for SWF + HTML) */
function createGameCard(game) {
    const div = document.createElement("div");
    div.className = "game";

    div.innerHTML = `
        <img src="${game.thumb}" alt="${game.name}">
        <h3>${game.name}</h3>
    `;

    // Favorite star
    const star = document.createElement("div");
    star.className = "favoriteBtn";
    star.innerHTML = favorites.includes(game.id) ? "⭐" : "☆";
    if (!favorites.includes(game.id)) star.classList.add("inactive");

    star.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(game.id);
    });

    div.appendChild(star);

    // Click to load game (SWF or HTML)
    div.addEventListener("click", () => loadGame(game));

    return div;
}

/* Toggle favorites */
function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
    } else {
        favorites.push(id);
    }

    localStorage.setItem("favorites", JSON.stringify(favorites));
    loadGames(); // refresh UI
}

/* Load game into fullscreen embedded player (SWF + HTML) */
function loadGame(game) {
    const playerContainer = document.getElementById("player");
    const closeBtn = document.getElementById("closeGameBtn");

    playerContainer.style.display = "block";
    closeBtn.style.display = "block";

    document.getElementById("games").style.display = "grid";
    document.getElementById("favorites").style.display = "grid";

    playerContainer.innerHTML = "";

    // HTML game → iframe
    if (game.html) {
        const iframe = document.createElement("iframe");
        iframe.src = game.html;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        playerContainer.appendChild(iframe);
        return;
    }

    // SWF game → Ruffle
    if (game.file) {
        try {
            const ruffle = window.RufflePlayer.newest();
            const player = ruffle.createPlayer();

            player.style.width = "100%";
            player.style.height = "100%";

            playerContainer.appendChild(player);
            player.load(game.file);

        } catch (error) {
            console.error("Ruffle error:", error);
            playerContainer.innerHTML =
                "<p style='color:white;text-align:center;padding-top:40px;'>Error loading game.</p>";
        }
    }
}

/* Close game and go back to list */
document.getElementById("closeGameBtn").onclick = () => {
    const playerContainer = document.getElementById("player");
    const closeBtn = document.getElementById("closeGameBtn");

    playerContainer.style.display = "none";
    closeBtn.style.display = "none";

    document.getElementById("games").style.display = "grid";
    document.getElementById("favorites").style.display = "grid";

    playerContainer.innerHTML = "";
};

/* Search bar */
function setupSearch(games) {
    const search = document.getElementById("search");
    const container = document.getElementById("games");

    search.addEventListener("input", () => {
        const term = search.value.toLowerCase();
        container.innerHTML = "";

        games
            .filter(g => g.name.toLowerCase().includes(term))
            .forEach(game => {
                const card = createGameCard(g);
                container.appendChild(card);
            });
    });
}

loadGames();
