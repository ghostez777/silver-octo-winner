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

function goFullscreen() {
    const player = document.getElementById("player");

    if (player.requestFullscreen) {
        player.requestFullscreen();
    } else if (player.webkitRequestFullscreen) {
        player.webkitRequestFullscreen();
    } else if (player.msRequestFullscreen) {
        player.msRequestFullscreen();
    }
}

document.getElementById("fullscreenBtn").onclick = goFullscreen;

loadGames();
