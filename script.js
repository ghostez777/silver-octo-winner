let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

async function loadGames() {

    const gamesContainer =
        document.getElementById("games");

    const favoritesContainer =
        document.getElementById("favorites");

    try {

        const response =
            await fetch("games.json");

        const games =
            await response.json();

        gamesContainer.innerHTML = "";
        favoritesContainer.innerHTML = "";

        games.forEach(game => {

            const card =
                createGameCard(game);

            gamesContainer.appendChild(card);

            if (favorites.includes(game.id)) {

                favoritesContainer.appendChild(
                    createGameCard(game)
                );
            }
        });

        setupSearch(games);

    } catch (error) {

        console.error(error);

        gamesContainer.innerHTML =
            "<p>Error loading games.</p>";
    }
}

function createGameCard(game) {

    const card =
        document.createElement("div");

    card.className = "game";

    card.innerHTML = `
        ${game.thumb}
        <h3>${game.name}</h3>
    `;

    const star =
        document.createElement("div");

    star.className =
        favorites.includes(game.id)
        ? "favoriteBtn"
        : "favoriteBtn inactive";

    star.innerHTML =
        favorites.includes(game.id)
        ? "⭐"
        : "☆";

    star.addEventListener("click", e => {

        e.stopPropagation();

        toggleFavorite(game.id);
    });

    card.appendChild(star);

    card.addEventListener("click", () => {
        loadGame(game);
    });

    return card;
}

function toggleFavorite(id) {

    if (favorites.includes(id)) {

        favorites =
            favorites.filter(
                game => game !== id
            );

    } else {

        favorites.push(id);
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    loadGames();
}

async function loadGame(game) {

    const player =
        document.getElementById("player");

    const closeButton =
        document.getElementById("closeGameBtn");

    player.innerHTML = "";

    player.style.display = "block";
    closeButton.style.display = "block";

    if (game.html) {

        const iframe =
            document.createElement("iframe");

        iframe.src = game.html;
        iframe.style.border = "none";
        iframe.style.width = "100%";
        iframe.style.height = "100%";

        player.appendChild(iframe);
        return;
    }

    if (game.file) {
        try {
            // Wait for Ruffle to be available
            let attempts = 0;
            while (!window.RufflePlayer && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.RufflePlayer) {
                player.innerHTML = "<div style='display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-size: 18px;'>Error: Flash player not loaded. Please refresh the page.</div>";
                return;
            }

            const ruffle = window.RufflePlayer.newest();
            const playerInstance = ruffle.createPlayer();

            player.appendChild(playerInstance);
            playerInstance.load(game.file);
        } catch (error) {
            console.error("Error loading game:", error);
            player.innerHTML = "<div style='display: flex; align-items: center; justify-content: center; height: 100%; color: white; font-size: 18px;'>Error loading game. Please try again.</div>";
        }
    }
}

document
    .getElementById("closeGameBtn")
    .addEventListener("click", () => {

        document
            .getElementById("player")
            .style.display = "none";

        document
            .getElementById("player")
            .innerHTML = "";

        document
            .getElementById("closeGameBtn")
            .style.display = "none";
    });

function setupSearch(games) {

    const search =
        document.getElementById("search");

    search.oninput = () => {

        const term =
            search.value
                .toLowerCase()
                .trim();

        const gamesContainer =
            document.getElementById("games");

        gamesContainer.innerHTML = "";

        games
            .filter(game =>
                game.name
                    .toLowerCase()
                    .includes(term)
            )
            .forEach(game => {

                gamesContainer.appendChild(
                    createGameCard(game)
                );
            });
    };
}

loadGames();
