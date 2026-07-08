async function loadGames() {
    const container = document.getElementById("games");

    try {
        const res = await fetch("games.json");

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const games = await res.json();

        container.innerHTML = "";

        games.forEach(game => {
            const div = document.createElement("div");
            div.className = "game";

            div.innerHTML = `
                <img
                    src="${game.thumb}"
                    alt="${game.name}"
           tener("click", () => {
                loadGame(game.file);
            });

            container.appendChild(div);
        });

    } catch (err) {
        console.error("Error loading games list:", err);
        container.innerHTML =
            "<p style='text-align:center;color:red;'>Error loading games list.</p>";
    }
}

function loadGame(file) {
    const playerContainer = document.getElementById("player");

    playerContainer.innerHTML = "";

    try {
        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();

        player.style.width = "100%";
        player.style.height = "100%";

        playerContainer.appendChild(player);

        player.load(file).catch(error => {
            console.error("Failed to load SWF:", file, error);

            playerContainer.innerHTML = `
                <div style="
                    color:white;
                    text-align:center;
                    padding:40px;
                    font-size:24px;">
                    Failed to load game:<br>
                    ${file}
                </div>
            `;
        });

    } catch (error) {
        console.error(error);

        playerContainer.innerHTML = `
            <div style="
                color:red;
                text-align:center;
                padding:40px;
                font-size:24px;">
                Error starting Ruffle.
            </div>
        `;
    }
}

function goFullscreen() {
    const rufflePlayer = document.querySelector("ruffle-player");

    if (!rufflePlayer) {
        alert("Load a game first.");
        return;
    }

    if (rufflePlayer.requestFullscreen) {
        rufflePlayer.requestFullscreen();
    } else if (rufflePlayer.webkitRequestFullscreen) {
        rufflePlayer.webkitRequestFullscreen();
    } else if (rufflePlayer.msRequestFullscreen) {
        rufflePlayer.msRequestFullscreen();
    }
}

document
    .getElementById("fullscreenBtn")
    .addEventListener("click", goFullscreen);

loadGames();
