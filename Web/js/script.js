
document.addEventListener('DOMContentLoaded', () => {
    // Génération aléatoire de points (optionnel)
    const radar = document.querySelector('.radar');

    function createDot() {
        setupListener();

        const dot = document.createElement('div');
        dot.classList.add('dot');

        const size = 400;
        const x = Math.random() * size;
        const y = Math.random() * size;

        dot.style.left = x + "px";
        dot.style.top = y + "px";

        radar.appendChild(dot);

        setTimeout(() => dot.remove(), 4000);
    }

    function setupListener() {
        document.querySelector('.settings').addEventListener('click', () => {
            alert("settings");
        });
    }

    setInterval(createDot, 2000);
})
