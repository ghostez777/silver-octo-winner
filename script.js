let games = [];

let favorites =
    JSON.parse(
        localStorage.getItem("ghostezFavorites")
    ) || [];


// ========================================
// LOAD GAMES
// ========================================

async function loadGames() {

    try {

        const response =
            await fetch("games.json");

        if (!response.ok) {
            throw new Error("Could not load games.json");
        }

        games =
            await response.json();

        renderAll();

    } catch (error) {

        console.error(error);

        document.getElementById(
            "gamesGrid"
        ).innerHTML =
            `
            <div class="empty-state">
                Could not load games.json.
            </div>
            `;
    }
}


// ========================================
// NAVIGATION
// ========================================

document
    .querySelectorAll(".nav-item[data-section]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showPage(
                    button.dataset.section
                );

            }
        );

    });


document
    .querySelectorAll("[data-goto]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showPage(
                    button.dataset.goto
                );

            }
        );

    });


function showPage(pageName) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });


    const page =
        document.getElementById(
            pageName
        );


    if (page) {

        page.classList.add("active");

    }


    document
        .querySelectorAll(".nav-item[data-section]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === pageName
            );

        });

}


// ========================================
// GAME CARDS
// ========================================

function createGameCard(game) {

    const card =
        document.createElement("article");

    card.className =
        "game";


    const favorite =
        favorites.includes(game.id);


    let type =
        "GAME";


    if (game.gba) {
        type = "GBA";
    }

    if (game.file) {
        type = "FLASH";
    }


    const image =
        game.thumb ||
        `https://placehold.co/600x400/181a20/7c5cff?text=${encodeURIComponent(
            game.name
        )}`;


    card.innerHTML = `

        <img
            class="thumb"
            src="${escapeHtml(image)}"
            alt="${escapeHtml(game.name)}"
            loading="lazy"
            onerror="
                this.onerror=null;
                this.src='https://placehold.co/600x400/181a20/7c5cff?text=Game';
            "
        >

        <div class="game-overlay">

            <h3>
                ${escapeHtml(game.name)}
            </h3>

            <span class="game-type">
                ${type}
            </span>

        </div>

        <button
            class="favoriteBtn ${favorite ? "" : "inactive"}"
            type="button"
            aria-label="Favorite ${escapeHtml(game.name)}"
        >
            ${favorite ? "★" : "☆"}
        </button>

    `;


    card
        .querySelector(".favoriteBtn")
        .addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleFavorite(
                    game.id
                );

            }
        );


    card.addEventListener(
        "click",
        () => {

            launchGame(game);

        }
    );


    return card;
}


// ========================================
// RENDER
// ========================================

function renderAll(
    filteredGames = games
) {

    const gamesGrid =
        document.getElementById(
            "gamesGrid"
        );


    const homeGames =
        document.getElementById(
            "homeGames"
        );


    const gbaGrid =
        document.getElementById(
            "gbaGrid"
        );


    const favoritesGrid =
        document.getElementById(
            "favoritesGrid"
        );


    gamesGrid.innerHTML = "";

    homeGames.innerHTML = "";

    gbaGrid.innerHTML = "";

    favoritesGrid.innerHTML = "";


    // All games

    if (filteredGames.length) {

        filteredGames.forEach(game => {

            gamesGrid.appendChild(
                createGameCard(game)
            );

        });

    } else {

        gamesGrid.innerHTML =
            `
            <div class="empty-state">
                No games found.
            </div>
            `;

    }


    // Home

    filteredGames
        .slice(0, 6)
        .forEach(game => {

            homeGames.appendChild(
                createGameCard(game)
            );

        });


    // GBA

    const gbaGames =
        filteredGames.filter(
            game => game.gba
        );


    if (gbaGames.length) {

        gbaGames.forEach(game => {

            gbaGrid.appendChild(
                createGameCard(game)
            );

        });

    } else {

        gbaGrid.innerHTML =
            `
            <div class="empty-state">
                No GBA games have been added yet.
            </div>
            `;

    }


    // Favorites

    const favoriteGames =
        filteredGames.filter(
            game =>
                favorites.includes(game.id)
        );


    if (favoriteGames.length) {

        favoriteGames.forEach(game => {

            favoritesGrid.appendChild(
                createGameCard(game)
            );

        });

    } else {

        favoritesGrid.innerHTML =
            `
            <div class="empty-state">
                You haven't favorited any games yet.
            </div>
            `;

    }

}


// ========================================
// FAVORITES
// ========================================

function toggleFavorite(id) {

    if (favorites.includes(id)) {

        favorites =
            favorites.filter(
                favoriteId =>
                    favoriteId !== id
            );

    } else {

        favorites.push(id);

    }


    localStorage.setItem(
        "ghostezFavorites",
        JSON.stringify(favorites)
    );


    renderAll(
        getFilteredGames()
    );
}


// ========================================
// SEARCH
// ========================================

const search =
    document.getElementById(
        "search"
    );


search.addEventListener(
    "input",
    () => {

        renderAll(
            getFilteredGames()
        );

    }
);


function getFilteredGames() {

    const query =
        search.value
            .trim()
            .toLowerCase();


    if (!query) {
        return games;
    }


    return games.filter(
        game =>
            game.name
                .toLowerCase()
                .includes(query)
    );

}


// ========================================
// LAUNCH GAME
// ========================================

function launchGame(game) {

    const modal =
        document.getElementById(
            "playerModal"
        );


    const player =
        document.getElementById(
            "player"
        );


    const title =
        document.getElementById(
            "playerTitle"
        );


    player.innerHTML = "";


    title.textContent =
        game.name;


    modal.classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";


    // ====================================
    // GBA
    // ====================================

    if (game.gba) {

        const iframe =
            document.createElement(
                "iframe"
            );


        /*
         * IMPORTANT:
         *
         * This uses the GBA emulator
         * already inside your /gba/
         * directory.
         *
         * Example:
         *
         * gba/player#pokemon.gba
         */

        iframe.src =
            `gba/player#${encodeURIComponent(
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
    // HTML
    // ====================================

    if (game.html) {

        const iframe =
            document.createElement(
                "iframe"
            );


        iframe.src =
            game.html;


        iframe.allow =
            "fullscreen; autoplay; gamepad";


        iframe.setAttribute(
            "allowfullscreen",
            ""
        );


        player.appendChild(
            iframe
        );


        return;
    }


    // ====================================
    // FLASH
    // ====================================

    if (game.file) {

        if (
            !window.RufflePlayer ||
            !window.RufflePlayer.newest
        ) {

            player.innerHTML =
                `
                <div class="empty-state">
                    Ruffle could not be loaded.
                </div>
                `;

            return;
        }


        try {

            const ruffle =
                window.RufflePlayer.newest();


            const rufflePlayer =
                ruffle.createPlayer();


            player.appendChild(
                rufflePlayer
            );


            rufflePlayer.load(
                game.file
            );


        } catch (error) {

            console.error(error);

            player.innerHTML =
                `
                <div class="empty-state">
                    Could not launch this game.
                </div>
                `;

        }

        return;
    }


    player.innerHTML =
        `
        <div class="empty-state">
            This game doesn't have a supported format.
        </div>
        `;

}


// ========================================
// CLOSE PLAYER
// ========================================

document
    .getElementById("closePlayer")
    .addEventListener(
        "click",
        closePlayer
    );


function closePlayer() {

    const modal =
        document.getElementById(
            "playerModal"
        );


    const player =
        document.getElementById(
            "player"
        );


    player.innerHTML = "";


    modal.classList.remove(
        "active"
    );


    document.body.style.overflow =
        "";

}


// ========================================
// FULLSCREEN
// ========================================

document
    .getElementById("fullscreenButton")
    .addEventListener(
        "click",
        () => {

            const player =
                document.getElementById(
                    "player"
                );


            if (!document.fullscreenElement) {

                player.requestFullscreen();

            } else {

                document.exitFullscreen();

            }

        }
    );


// ========================================
// RANDOM GAME
// ========================================

document
    .getElementById("randomGameButton")
    .addEventListener(
        "click",
        () => {

            if (!games.length) {
                return;
            }


            const random =
                games[
                    Math.floor(
                        Math.random() *
                        games.length
                    )
                ];


            launchGame(random);

        }
    );


// ========================================
// SETTINGS
// ========================================

function openSettings() {

    showPage(
        "settings"
    );

}


document
    .getElementById("settingsButton")
    .addEventListener(
        "click",
        openSettings
    );


document
    .getElementById("settingsTopButton")
    .addEventListener(
        "click",
        openSettings
    );


// Descriptions setting

document
    .getElementById(
        "descriptionToggle"
    )
    .addEventListener(
        "change",
        event => {

            document.body.classList.toggle(
                "hide-descriptions",
                !event.target.checked
            );

        }
    );


// Compact mode

document
    .getElementById(
        "compactToggle"
    )
    .addEventListener(
        "change",
        event => {

            document.body.classList.toggle(
                "compact",
                event.target.checked
            );

        }
    );


// ========================================
// NOTES
// ========================================

const notesModal =
    document.getElementById(
        "notesModal"
    );


const notes =
    document.getElementById(
        "notes"
    );


notes.value =
    localStorage.getItem(
        "ghostezNotes"
    ) || "";


document
    .getElementById("notesButton")
    .addEventListener(
        "click",
        () => {

            notesModal.classList.add(
                "active"
            );

        }
    );


document
    .getElementById("closeNotes")
    .addEventListener(
        "click",
        () => {

            notesModal.classList.remove(
                "active"
            );

        }
    );


document
    .getElementById("saveNotes")
    .addEventListener(
        "click",
        () => {

            localStorage.setItem(
                "ghostezNotes",
                notes.value
            );


            notesModal.classList.remove(
                "active"
            );

        }
    );


// ========================================
// TIMER
// ========================================

let timerSeconds =
    25 * 60;


let timerInterval =
    null;


const timerDisplay =
    document.getElementById(
        "timerDisplay"
    );


function updateTimer() {

    const minutes =
        Math.floor(
            timerSeconds / 60
        )
        .toString()
        .padStart(2, "0");


    const seconds =
        (timerSeconds % 60)
            .toString()
            .padStart(2, "0");


    timerDisplay.textContent =
        `${minutes}:${seconds}`;

}


document
    .getElementById("timerButton")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "timerModal"
                )
                .classList.add(
                    "active"
                );

        }
    );


document
    .getElementById("closeTimer")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "timerModal"
                )
                .classList.remove(
                    "active"
                );

        }
    );


document
    .getElementById("startTimer")
    .addEventListener(
        "click",
        () => {

            if (timerInterval) {
                return;
            }


            timerInterval =
                setInterval(
                    () => {

                        if (
                            timerSeconds <= 0
                        ) {

                            clearInterval(
                                timerInterval
                            );

                            timerInterval =
                                null;

                            return;
                        }


                        timerSeconds--;

                        updateTimer();

                    },
                    1000
                );

        }
    );


document
    .getElementById("resetTimer")
    .addEventListener(
        "click",
        () => {

            clearInterval(
                timerInterval
            );


            timerInterval =
                null;


            timerSeconds =
                25 * 60;


            updateTimer();

        }
    );


// ========================================
// ESC
// ========================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closePlayer();

            document
                .querySelectorAll(
                    ".small-modal"
                )
                .forEach(modal => {

                    modal.classList.remove(
                        "active"
                    );

                });

        }

    }
);


// ========================================
// START
// ========================================

updateTimer();

loadGames();
