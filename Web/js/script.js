
document.addEventListener('DOMContentLoaded', () => {
    // Les variables
    window.radar = document.querySelector('.radar');
    window.dot = document.createElement('div');
    window.settings = document.querySelector('.settings');
    window.overlay = document.querySelector('.overlay');
    window.popup = document.querySelector('.popup');

    setupListener();

    // setInterval(createDot, 2000);
})

function setupListener() {
    window.settings.addEventListener('click', () => {
        window.overlay.classList.toggle('open');

    });
}

function createDot() {

    window.dot.classList.add('dot');

    const size = 400;
    const x = Math.random() * size;
    const y = Math.random() * size;

    window.dot.style.left = x + "px";
    window.dot.style.top = y + "px";

    window.radar.appendChild(window.dot);

    setTimeout(() => dot.remove(), 4000);
}


