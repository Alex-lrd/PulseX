// CustomElements
import "./components/PulseXRadarCommandLine.js";
import "./components/PulseXRadarElement.js";

// Cahrgement du DOM
document.addEventListener("DOMContentLoaded", () => {
    window.radarCommandLine = document.querySelector("pulsex-radar-command-line");
    window.radar = document.getElementById('radar');

    window.radarCommandLine.commands = {
        "/scan": ["start", "stop"],
        "/speed": ["get", "set"],
        "/propagation": ["get", "set"],
    };
    window.radarCommandLine.addEventListener("command-submit", (event) => {
        let cmd = event.detail.command;
        console.log("Commande reçue :", cmd);
        interpreter(cmd);
    });

    updateDistance();
});


// Fonctions
async function interpreter(cmd) {
    const parts = cmd.slice(1).split(' ');
    const commandName = parts[0];
    const args = parts.slice(1);

    if (commandName === 'scan') {
        if (args[0] === 'start') {
            start();
        } else if (args[0] === 'stop') {
            stop();
        } else if (args[0] === 'restart') {
            stop();
            setTimeout(start, 500);
        } else {
            window.radarCommandLine.addError(cmd);
            return;
        }
    } 
    else if (commandName === 'speed') {
        if (args[0] === 'get') {
            const res = await fetch("/api/speed");
            const data = await res.json();
            window.radarCommandLine.addLog(`Vitesse actuelle du servo (delay) : ${data.speed} ms`);
        } else if (args[0] === 'set') {
            const val = parseInt(args[1]);
            if (isNaN(val) || val <= 0) {
                window.radarCommandLine.addError("Usage: /speed set [valeur en ms (ex: 50)]");
                return;
            }
            await fetch("/api/speed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: val })
            });
            window.radarCommandLine.addLog(`Commande envoyée : Vitesse fixée à ${val} ms`);
        } else {
            window.radarCommandLine.addError(cmd);
            return;
        }
    } 
    else if (commandName === 'propagation') {
        if (args[0] === 'get') {
            const res = await fetch("/api/propagation");
            const data = await res.json();
            window.radarCommandLine.addLog(`Facteur de propagation actuel : ${data.propagation}`);
        } else if (args[0] === 'set') {
            const val = parseFloat(args[1]);
            if (isNaN(val) || val <= 0) {
                window.radarCommandLine.addError("Usage: /propagation set [valeur (ex: 0.0343)]");
                return;
            }
            await fetch("/api/propagation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: val })
            });
            window.radarCommandLine.addLog(`Commande envoyée : Propagation fixée à ${val}`);
        } else {
            window.radarCommandLine.addError(cmd);
            return;
        }
    } else {
        window.radarCommandLine.addError(`<span class="error">Error: ${cmd} commande non reconnue</span>`);
    }
    window.radarCommandLine.addCommand(cmd);
}

function start() {
    fetch("/api/start");
}

function stop() {
    fetch("/api/stop");
}

async function updateDistance() {
    const res = await fetch("/api/distance");
    const data = await res.json();

    if (data.age !== null && data.age > 2.0) {
        console.warn(`Données obsolètes (âge : ${data.age}s).`);
    }

    if (data.angle !== null) {
        if (data.d1 !== null) {
            window.radarCommandLine.addLog(`[Angle ${data.angle}°] Capteur A: ${data.d1.toFixed(2)} cm`);
            if (typeof radar.addTarget === 'function') {
                radar.addTarget(data.d1, data.angle); 
            }
        }
        if (data.d2 !== null) {
            let angleOppose = (data.angle + 180) % 360;
            window.radarCommandLine.addLog(`[Angle ${angleOppose}°] Capteur B: ${data.d2.toFixed(2)} cm`);
            if (typeof radar.addTarget === 'function') {
                radar.addTarget(data.d2, angleOppose);
            }
        }
    }
    setTimeout(updateDistance, 100);
}

