async function loadGames() {
    const container = document.getElementById("games");

    try {
        const res = await fetch("games.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const games = await res.json();
        container.innerHTML = "";

        games.forEach(game => {
            const div = document.createElement("div");
            div.className = "game";

            div.innerHTML = `
                <img src="${game.thumb}" alt="${game.name}">
                <h3>${game.name}</h3>
            `;

            div.addEventListener("click", () => openPopup(game.file));
            container.appendChild(div);
        });

        setupSearch(games);

    } catch (err) {
        console.error("Error loading games list:", err);
        container.innerHTML =
            "<p style='text-align:center;color:red;'>Error loading games list.</p>";
    }
}

/* Popup launcher – fullscreen-sized */
function openPopup(file) {
    const modal = document.getElementById("gameModal");
    const modalPlayer = document.getElementById("modalPlayer");

    modal.style.display = "block";
    modalPlayer.innerHTML = "";

    try {
        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();

        player.style.width = "100%";
        player.style.height = "100%";

        modalPlayer.appendChild(player);

        player.load(file).catch(err => {
            console.error("Ruffle load error:", err);
            modalPlayer.innerHTML =
                "<p style='color:white;text-align:center;padding-top:40px;'>Failed to load game.</p>";
        });

    } catch (error) {
        console.error("Ruffle error:", error);
        modalPlayer.innerHTML =
            "<p style='color:white;text-align:center;padding-top:40px;'>Error starting Ruffle.</p>";
    }
}

/* Close popup */
document.getElementById("closeModal").onclick = () => {
    document.getElementById("gameModal").style.display = "none";
    document.getElementById("modalPlayer").innerHTML = "";
};

/* Fullscreen button */
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

document.getElementById("fullscreenBtn").addEventListener("click", goFullscreen);

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
                const div = document.createElement("div");
                div.className = "game";

                div.innerHTML = `
                    <img src="${game.thumb}" alt="${game.name}">
                    <h3>${game.name}</h3>
                `;

                div.addEventListener("click", () => openPopup(game.file));
                container.appendChild(div);
            });
    });
}

loadGames();
