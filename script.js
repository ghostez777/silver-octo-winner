fetch("data/games.json")
.then(response => response.json())
.then(games => {

const container = document.getElementById("games");

games.forEach(game => {

container.innerHTML += `
<div class="card">
    <img src="${game.image}" alt="${game.title}">
    <h3>${game.title}</h3>

    <a href="game.html?game=${game.file}">
        Play
    </a>
</div>
`;

});

});
