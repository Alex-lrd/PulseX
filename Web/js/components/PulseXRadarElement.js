import { formatDistance } from "../utils/formatters.js";

export class PulseXRadarElement extends HTMLElement {
    constructor() {
        super();
        this.targetNodes = new Map();
        this.isReady = false;
        this.pendingSnapshot = null;
        this.pendingConnectionState = null;
    }

    connectedCallback() {
        if (this.isReady) {
            return;
        }

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

        this.beamNode = this.querySelector(".radar__beam");
        this.isReady = true;

        if (this.pendingSnapshot) {
            this.renderSnapshot(this.pendingSnapshot);
            this.pendingSnapshot = null;
        }

        if (this.pendingConnectionState) {
            this.renderConnection(this.pendingConnectionState);
            this.pendingConnectionState = null;
        }
    }

    renderSnapshot(snapshot) {
        if (!this.isReady) {
            this.pendingSnapshot = snapshot;
            return;
        }

        this.beamNode.style.transform = `translateX(-50%) rotate(${snapshot.beamRotation}deg)`;
        this._renderTargets(snapshot.targets);
    }

    renderConnection(state) {
        if (!this.isReady) {
            this.pendingConnectionState = state;
            return;
        }

        if (state.isStreaming) {
            this.removeAttribute("data-paused");
            return;
        }

        this.setAttribute("data-paused", "true");
    }

    _renderTargets(targets = []) {
        const usedKeys = new Set();

        targets.forEach((target) => {
            usedKeys.add(target.key);

            let node = this.targetNodes.get(target.key);

            if (!node) {
                node = document.createElement("div");
                this.targetNodes.set(target.key, node);
                this.appendChild(node);
            }

            node.className = target.isActive ? "radar-dot radar-dot--active" : "radar-dot";
            node.style.left = `${target.position.left}%`;
            node.style.top = `${target.position.top}%`;
            node.title = `${target.label} • ${formatDistance(target.distance)}`;
        });

        this.targetNodes.forEach((node, key) => {
            if (!usedKeys.has(key)) {
                node.remove();
                this.targetNodes.delete(key);
            }
        });
    }
}

if (!customElements.get("pulsex-radar")) {
    customElements.define("pulsex-radar", PulseXRadarElement);
}
