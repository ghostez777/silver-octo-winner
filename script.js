async function loadGames() {
    const container = document.getElementById("games");

    try {
        const res = await fetch("games.json");
        const games = await res.json();

        games.forEach(game => {
            const div = document.createElement("div");
            div.className = "game";

            div.innerHTML = `
                <img src="${game.thumb}" alt="${game.name}">
                <h3>${game.name}</h3>
            `;

            div.onclick = () => loadGame(game.file);
            container.appendChild(div);
        });

    } catch (err) {
        console.error("Error loading games list:", err);
        container.innerHTML = "<p>Error loading games list.</p>";
    }
}

function loadGame(file) {
    const player = document.getElementById("player");
    player.innerHTML = "";

    const ruffle = window.RufflePlayer.newest();
    const playerInstance = ruffle.createPlayer();
    player.appendChild(playerInstance);

    playerInstance.load(file);
}

/* ⭐ FIXED FULLSCREEN — fullscreen the actual Ruffle player */
function goFullscreen() {
    const rufflePlayer = document.querySelector("ruffle-player");
    if (!rufflePlayer) return;

    if (rufflePlayer.requestFullscreen) {
        rufflePlayer.requestFullscreen();
    } else if (rufflePlayer.webkitRequestFullscreen) {
        rufflePlayer.webkitRequestFullscreen();
    } else if (rufflePlayer.msRequestFullscreen) {
        rufflePlayer.msRequestFullscreen();
    }
}

document.getElementById("fullscreenBtn").onclick = goFullscreen;

loadGames();
