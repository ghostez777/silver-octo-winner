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

            // FIXED CLICK HANDLER
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

/* ⭐ Popup Launcher */
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
        player.load(file);

    } catch (error) {
        console.error("Ruffle error:", error);
        modalPlayer.innerHTML =
            "<p style='color:white;text-align:center;'>Error loading game.</p>";
    }
}

/* ⭐ Close Popup */
document.getElementById("closeModal").onclick = () => {
    document.getElementById("gameModal").style.display = "none";
    document.getElementById("modalPlayer").innerHTML = "";
};

/* ⭐ Fullscreen Fix */
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

/* ⭐ Create Game Card (with favorite star) */
function createGameCard(game) {
    const div = document.createElement("div");
    div.className = "game";
    div.style.position = "relative";

    div.innerHTML = `
        <img src="${game.thumb}" alt="${game.name}">
        <h3>${game.name}</h3>
    `;

    // ⭐ Favorite star
    const star = document.createElement("div");
    star.className = "favoriteBtn";
    star.innerHTML = favorites.includes(game.id) ? "⭐" : "☆";
    if (!favorites.includes(game.id)) star.classList.add("inactive");

    star.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(game.id);
    });

    div.appendChild(star);

    // ⭐ Click to open popup
    div.addEventListener("click", () => openPopup(game.file));

    return div;
}

/* ⭐ Toggle Favorites */
function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
    } else {
        favorites.push(id);
    }

    localStorage.setItem("favorites", JSON.stringify(favorites));
    loadGames(); // refresh UI
}

/* ⭐ Popup Launcher */
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
        player.load(file);

    } catch (error) {
        console.error("Ruffle error:", error);
        modalPlayer.innerHTML =
            "<p style='color:white;text-align:center;'>Error loading game.</p>";
    }
}

/* ⭐ Close Popup */
document.getElementById("closeModal").onclick = () => {
    document.getElementById("gameModal").style.display = "none";
    document.getElementById("modalPlayer").innerHTML = "";
};

/* ⭐ Fullscreen Fix */
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

/* ⭐ Search Bar */
function setupSearch(games) {
    const search = document.getElementById("search");
    const container = document.getElementById("games");

    search.addEventListener("input", () => {
        const term = search.value.toLowerCase();
        container.innerHTML = "";

        games
            .filter(g => g.name.toLowerCase().includes(term))
            .forEach(game => {
                const card = createGameCard(game);
                container.appendChild(card);
            });
    });
}

loadGames();

/* ⭐ Search Bar */
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
