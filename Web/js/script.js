import "./components/PulseXRadarConsole.js";
// import "./components/PulseXRadarElement.js";

document.addEventListener("DOMContentLoaded", () => {
    const radarConsole = document.querySelector("pulsex-radar-console");

    if (radarConsole) {
        // Setup les commandes
        radarConsole.commands = {
            "/scan": ["start", "stop"],
            "/speed": ["get", "set"]
        };

        // Recuperation des commandes
        radarConsole.addEventListener("command-submit", (event) => {
            console.log("Commande recue :", event.detail.command);
        });
    }
});
