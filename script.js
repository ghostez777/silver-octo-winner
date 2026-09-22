let favorites =
    JSON.parse(localStorage.getItem("favorites")) || [];

let allGames = [];


// ========================================
// LOAD GAMES
// ========================================

async function loadGames() {

    const gamesContainer =
        document.getElementById("games");

    try {

        const response =
            await fetch("./games.json");

        if (!response.ok) {
            throw new Error(
                `HTTP error: ${response.status}`
            );
        }

        allGames =
            await response.json();

        renderGames(allGames);

        setupSearch();

    } catch (error) {

        console.error(
            "Failed to load games:",
            error
        );

        gamesContainer.innerHTML =
            "<div class='empty-state'>Failed to load games catalog.</div>";
    }
}


// ========================================
// RENDER GAMES
// ========================================

function renderGames(gamesToRender) {

    const gamesContainer =
        document.getElementById("games");

    const favoritesContainer =
        document.getElementById("favorites");

    const favoritesSection =
        document.getElementById(
            "favorites-section"
        );

    gamesContainer.innerHTML = "";

    favoritesContainer.innerHTML = "";


    const favoriteGames =
        gamesToRender.filter(game =>
            favorites.includes(game.id)
        );


    if (favoriteGames.length > 0) {

        favoritesSection.classList.remove(
            "hidden"
        );

        favoriteGames.forEach(game => {

            favoritesContainer.appendChild(
                createGameCard(game)
            );

        });

    } else {

        favoritesSection.classList.add(
            "hidden"
        );
    }


    if (gamesToRender.length === 0) {

        gamesContainer.innerHTML =
            "<div class='empty-state'>No matching games found.</div>";

    } else {

        gamesToRender.forEach(game => {

            gamesContainer.appendChild(
                createGameCard(game)
            );

        });
    }
}


// ========================================
// CREATE GAME CARD
// ========================================

function createGameCard(game) {

    const card =
        document.createElement("div");

    card.className = "game";


    const isFav =
        favorites.includes(game.id);


    const fallbackUrl =
        `https://placehold.co/600x400/1c253e/818cf8?text=${encodeURIComponent(
            game.name
        )}`;


    let typeLabel = "Play";


    if (game.gba) {
        typeLabel = "GBA";
    }

    if (game.file) {
        typeLabel = "Flash";
    }


    card.innerHTML = `

        <img
            src="${escapeHtml(game.thumb || "")}"
            class="thumb"
            alt="${escapeHtml(game.name)}"
            loading="lazy"
            decoding="async"
            onerror="
                this.onerror=null;
                this.src='${fallbackUrl}'
            "
        >

        <div class="game-overlay">

            <div>

                <h3>
                    ${escapeHtml(game.name)}
                </h3>

                <span class="game-type">
                    ${typeLabel}
                </span>

            </div>

        </div>

        <button
            class="favoriteBtn ${isFav ? "" : "inactive"}"
            aria-label="Favorite"
            type="button"
        >
            ${isFav ? "★" : "☆"}
        </button>
    `;


    const favoriteButton =
        card.querySelector(".favoriteBtn");


    favoriteButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            toggleFavorite(game.id);
        }
    );


    card.addEventListener(
        "click",
        () => loadGame(game)
    );


    return card;
}


// ========================================
// FAVORITES
// ========================================

function toggleFavorite(id) {

    if (favorites.includes(id)) {

        favorites =
            favorites.filter(
                gameId => gameId !== id
            );

    } else {

        favorites.push(id);
    }


    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );


    const searchTerm =
        document
            .getElementById("search")
            .value
            .toLowerCase()
            .trim();


    renderGames(
        allGames.filter(game =>
            game.name
                .toLowerCase()
                .includes(searchTerm)
        )
    );
}


// ========================================
// LOAD GAME
// ========================================

async function loadGame(game) {

    const modal =
        document.getElementById(
            "player-modal"
        );

    const player =
        document.getElementById(
            "player"
        );

    const title =
        document.getElementById(
            "player-title"
        );


    player.innerHTML = "";

    title.textContent =
        game.name;


    modal.classList.add("active");

    document.body.style.overflow =
        "hidden";

    document.body.classList.add(
        "playing"
    );


    // ====================================
    // GBA EMULATOR
    // ====================================

    if (game.gba) {

        const iframe =
            document.createElement("iframe");


        /*
         * Your repository already contains
         * EmulatorJS in /jsemu/.
         *
         * The emulator accepts:
         *
         * /jsemu/index.html?rom=FILE
         *
         * and loads:
         *
         * /jsemu/roms/FILE
         */


        iframe.src =
            `jsemu/index.html?rom=${encodeURIComponent(
                game.gba
            )}`;


        iframe.allow =
            "autoplay; fullscreen; gamepad";


        iframe.setAttribute(
            "allowfullscreen",
            ""
        );


        iframe.loading =
            "eager";


        player.appendChild(
            iframe
        );


        return;
    }


    // ====================================
    // NORMAL HTML GAME
    // ====================================

    if (game.html) {

        const iframe =
            document.createElement("iframe");


        iframe.src =
            game.html;


        iframe.allow =
            "autoplay; fullscreen; accelerometer; gyroscope; clipboard-read; clipboard-write";


        iframe.setAttribute(
            "allowfullscreen",
            ""
        );


        iframe.loading =
            "eager";


        player.appendChild(
            iframe
        );


        return;
    }


    // ====================================
    // FLASH / RUFFLE
    // ====================================

    if (game.file) {

        try {

            let attempts = 0;


            while (
                !window.RufflePlayer &&
                attempts < 50
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );

                attempts++;
            }


            if (!window.RufflePlayer) {

                player.innerHTML =
                    "<div class='empty-state'>Error loading Ruffle Flash engine.</div>";

                return;
            }


            const ruffle =
                window.RufflePlayer.newest();


            const playerInstance =
                ruffle.createPlayer();


            player.appendChild(
                playerInstance
            );


            playerInstance.config = {

                autoplay: "on",

                unmuteOverlay:
                    "hidden",

                letterbox:
                    "on",

                forceScale:
                    true,

                quality:
                    "low",

                graphicsBackends:
                    ["webgl"],

                preferredRenderer:
                    "webgl",

                maxExecutionDuration:
                    15,

                allowScriptAccess:
                    false
            };


            playerInstance.load(
                game.file
            );


        } catch (error) {

            console.error(
                "Error launching Flash game:",
                error
            );


            player.innerHTML =
                "<div class='empty-state'>Could not load Flash game.</div>";
        }

        return;
    }


    // ====================================
    // UNKNOWN GAME TYPE
    // ====================================

    player.innerHTML = `
        <div class="empty-state">
            This game does not have a supported
            game type.
        </div>
    `;
}


// ========================================
// OPEN GBA EMULATOR
// ========================================

function openGbaEmulator() {

    const modal =
        document.getElementById(
            "player-modal"
        );

    const player =
        document.getElementById(
            "player"
        );

    const title =
        document.getElementById(
            "player-title"
        );


    player.innerHTML = "";


    title.textContent =
        "Game Boy Advance Emulator";


    modal.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";


    document.body.classList.add(
        "playing"
    );


    const iframe =
        document.createElement(
            "iframe"
        );


    /*
     * No ROM is specified here.
     *
     * This opens your existing
     * EmulatorJS upload screen,
     * allowing a user to select
     * a ROM locally.
     */

    iframe.src =
        "jsemu/index.html";


    iframe.allow =
        "autoplay; fullscreen; gamepad";


    iframe.setAttribute(
        "allowfullscreen",
        ""
    );


    iframe.loading =
        "eager";


    player.appendChild(
        iframe
    );
}


// ========================================
// CLOSE GAME
// ========================================

function closeGame() {

    const modal =
        document.getElementById(
            "player-modal"
        );

    const player =
        document.getElementById(
            "player"
        );


    const iframe =
        player.querySelector(
            "iframe"
        );


    if (iframe) {

        iframe.src =
            "about:blank";
    }


    modal.classList.remove(
        "active"
    );


    player.innerHTML =
        "";


    document.body.style.overflow =
        "";


    document.body.classList.remove(
        "playing"
    );
}


// ========================================
// FULLSCREEN
// ========================================

function toggleFullscreen() {

    const player =
        document.getElementById(
            "player"
        );


    if (!document.fullscreenElement) {

        player
            .requestFullscreen()
            .catch(error =>
                console.error(
                    "Fullscreen error:",
                    error
                )
            );

    } else {

        document.exitFullscreen();
    }
}


// ========================================
// RANDOM GAME
// ========================================

function playRandomGame() {

    if (!allGames.length) {
        return;
    }


    const game =
        allGames[
            Math.floor(
                Math.random() *
                allGames.length
            )
        ];


    loadGame(game);
}


// ========================================
// SEARCH
// ========================================

function setupSearch() {

    const search =
        document.getElementById(
            "search"
        );


    search.oninput = () => {

        const term =
            search.value
                .toLowerCase()
                .trim();


        renderGames(
            allGames.filter(game =>
                game.name
                    .toLowerCase()
                    .includes(term)
            )
        );
    };
}


// ========================================
// HTML ESCAPING
// ========================================

function escapeHtml(value) {

    return String(value)
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character])
        );
}


// ========================================
// BUTTONS
// ========================================

document
    .getElementById("closeGameBtn")
    .addEventListener(
        "click",
        closeGame
    );


document
    .getElementById("fullscreenBtn")
    .addEventListener(
        "click",
        toggleFullscreen
    );


document
    .getElementById("openGbaBtn")
    .addEventListener(
        "click",
        openGbaEmulator
    );


document
    .getElementById("playRandomBtn")
    .addEventListener(
        "click",
        playRandomGame
    );


// ========================================
// ESC KEY
// ========================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            document
                .getElementById(
                    "player-modal"
                )
                .classList
                .contains("active")
        ) {

            closeGame();
        }
    }
);


// ========================================
// START
// ========================================

loadGames();
