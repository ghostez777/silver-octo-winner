let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

async function loadGames() {
    const gamesContainer = document.getElementById("games");
    const favoritesContainer = document.getElementById("favorites");

    try {
        const response = await fetch("games.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const games = await response.json();

        gamesContainer.innerHTML = "";
        favoritesContainer.innerHTML = "";

        games.forEach(game => {
            const card = createGameCard(game);
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

        gamesContainer.innerHTML = `
            <p style="color:red">
                Failed to load games.
            </p>
        `;
    }
}

function createGameCard(game) {

    const card = document.createElement("div");
    card.className = "game";

    card.innerHTML = `
        ${game.thumb}
        <h3>${game.name}</h3>
    `;

    const favoriteBtn = document.createElement("div");

    favoriteBtn.className =
        favorites.includes(game.id)
            ? "favoriteBtn"
            : "favoriteBtn inactive";

    favoriteBtn.innerHTML =
        favorites.includes(game.id)
            ? "⭐"
            : "☆";

    favoriteBtn.addEventListener("click", event => {
        event.stopPropagation();
        toggleFavorite(game.id);
    });

    card.appendChild(favoriteBtn);

    card.addEventListener("click", () => {
        loadGame(game);
    });

    return card;
}

function toggleFavorite(id) {

    if (favorites.includes(id)) {
        favorites = favorites.filter(
            favorite => favorite !== id
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

function loadGame(game) {

    const player = document.getElementById("player");
    const closeButton =
        document.getElementById("closeGameBtn");

    player.style.display = "block";
    closeButton.style.display = "block";

    player.innerHTML = "";

    if (game.html) {

        const iframe =
            document.createElement("iframe");

        iframe.src = game.html;
        iframe.style.border = "none";

        player.appendChild(iframe);

        return;
    }

    if (game.file) {

        try {

            const ruffle =
                window.RufflePlayer.newest();

            const playerInstance =
                ruffle.createPlayer();

            player.appendChild(playerInstance);

            playerInstance.load(game.file);

        } catch (error) {

            console.error(error);

            player.innerHTML = `
                <div style="
                    color:white;
                    padding-top:50px;
                    text-align:center;
                    font-size:24px;">
                    Failed to load game
                </div>
            `;
        }
    }
}

document
    .getElementById("closeGameBtn")
    .addEventListener("click", () => {

        const player =
            document.getElementById("player");

        player.style.display = "none";
        player.innerHTML = "";

        document
            .getElementById("closeGameBtn")
            .style.display = "none";
    });

function setupSearch(games) {

    const search =
        document.getElementById("search");

    search.oninput = () => {

        const term =
            search.value.toLowerCase();

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
