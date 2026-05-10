export class PulseXRadarElement extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.classList.add("radar");
        this.innerHTML = `
            <div class="radar__ring radar__ring--outer"></div>
            <div class="radar__ring radar__ring--middle"></div>
            <div class="radar__ring radar__ring--inner"></div>
            <div class="radar__crosshair radar__crosshair--horizontal"></div>
            <div class="radar__crosshair radar__crosshair--vertical"></div>
            <div class="scan scan--primary"></div>
            <div class="scan scan--secondary"></div>
            <div class="radar__beam"></div>
            <div class="radar__center"></div>
        `;
    }


    addTarget(distance, angle) {
        const radarWidth = this.offsetWidth; // Largeur du radar sans les marges
        const radarHeight = this.offsetHeight;
        const maxDistance = 400; // Distance max

        const radius = (distance / maxDistance) * (radarWidth / 2);

        const x = radarWidth / 2 + radius * Math.cos(angle);
        const y = radarHeight / 2 + radius * Math.sin(angle);

        const target = document.createElement("div");
        target.classList.add("target");
        if (distance <= 100) {
            target.classList.add("warning");
        }
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;

        this.appendChild(target);

        setTimeout(() => {
            target.classList.add("targetFadeOut");
            setTimeout(() => {
                target.remove();
            }, 1000);
        }, 3000);
    }

    

    
}

customElements.define("pulsex-radar", PulseXRadarElement);