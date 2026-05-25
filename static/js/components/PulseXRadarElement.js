export class PulseXRadarElement extends HTMLElement {
    constructor() {
        super();
        this.maxDistance = 200;
    }

    connectedCallback() {
        this.classList.add("radar");
        const rings = Array.from({ length: 6 }, (_, index) => {
            return `<div class="radar__ring" style="--ring-scale: ${(index + 1) / 6}"></div>`;
        }).join("");
        const distanceMarkers = Array.from({ length: 6 }, (_, index) => {
            return `
                <div class="radar__distance-marker" style="--marker-scale: ${(index + 1) / 6}">
                    <span class="radar__distance-label" data-distance-label="${index}"></span>
                </div>
            `;
        }).join("");

        this.innerHTML = `
            <div class="radar__grid">
                ${rings}
                ${distanceMarkers}
                <div class="radar__crosshair radar__crosshair--horizontal"></div>
                <div class="radar__crosshair radar__crosshair--vertical"></div>
                <div class="radar__sweep radar__sweep--primary"></div>
                <div class="radar__sweep radar__sweep--secondary"></div>
                <div class="radar__center"></div>
            </div>
        `;

        this.updateDistanceMarkers();
        this.setSweepAngle(0);
    }

    setMaxDistance(distance) {
        if (!Number.isFinite(distance) || distance <= 0) {
            return;
        }

        this.maxDistance = distance;
        this.updateDistanceMarkers();
    }

    updateDistanceMarkers() {
        const labels = this.querySelectorAll("[data-distance-label]");

        labels.forEach((label, index) => {
            const ringValue = Math.round(((index + 1) / labels.length) * this.maxDistance);
            label.textContent = `${ringValue}`;
        });
    }

    setSweepAngle(angle) {
        const normalizedAngle = ((angle % 360) + 360) % 360;

        this.style.setProperty("--sweep-angle", `${normalizedAngle}deg`);
        this.style.setProperty("--sweep-angle-secondary", `${(normalizedAngle + 180) % 360}deg`);
    }

    addTarget(distance, angle) {
        const radarWidth = this.offsetWidth;
        const radarHeight = this.offsetHeight;
        const clampedDistance = Math.min(Math.max(distance, 0), this.maxDistance);
        const angleInRadians = (angle * Math.PI) / 180;

        const radius = (clampedDistance / this.maxDistance) * (Math.min(radarWidth, radarHeight) / 2);

        const x = radarWidth / 2 + radius * Math.cos(angleInRadians);
        const y = radarHeight / 2 - radius * Math.sin(angleInRadians);

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
