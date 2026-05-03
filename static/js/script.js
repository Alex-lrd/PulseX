import "./components/PulseXRadarCommandLine.js";
import "./components/PulseXRadarElement.js";

document.addEventListener("DOMContentLoaded", () => {
    // const radarConsole = document.querySelector(".console-log");
    const radarCommandLine = document.querySelector("pulsex-radar-command-line");
    const radar = document.getElementById('radar');



    if (radarCommandLine) {
        // Setup les commandes
        radarCommandLine.commands = {
            "/scan": ["start", "stop", "restart"],
            "/speed": ["get", "set"],
            "/propagation": ["get", "set"],
        };

        // Recuperation des commandes
        radarCommandLine.addEventListener("command-submit", (event) => {
            let cmd = event.detail.command;

            console.log("Commande recue :", cmd);
            interpreter(cmd);
        });
    }

    function interpreter(cmd) {
        const parts = cmd.slice(1).split(' ');
        const commandName = parts[0];
        const args = parts.slice(1);

        if (commandName == 'scan') {
            if (args[0] === 'start') {
                start();
            } else if (args[0] === 'stop') {
                stop();
            } else {
                // console.log('commande inconnu');
                radarCommandLine.addError(cmd);
                return;
            }
        } else if (commandName == 'speed') {
            if (args[0] === 'get') {
                // Todo
            } else if (args[0] === 'set') {
                // Todo
            } else {
                radarCommandLine.addError(cmd);
                return;
            }
        } else if (commandName == 'propagation') {
            if (args[0] === 'get') {
                // Todo
            } else if (args[0] === 'set') {
                // Todo
            } else {
                radarCommandLine.addError(cmd);
                return;
            }
        } else {
            radarCommandLine.addError(`<span class"error">Error: ${cmd} commande non reconnu</span>`);
        }
        radarCommandLine.addCommand(cmd);
    }

    function start() {
        fetch("/api/start");
    }

    function stop() {
        fetch("/api/stop");
    }

    async function updateDistance() {
        try {
            const res = await fetch("/api/distance");
            const data = await res.json();

            // console.log("DATA:", data);

            if (data.distance !== null) {
                // console.log(data.distance);
                radarCommandLine.addLog(data.distance);

                radar.addTarget(data.distance);



                // document.getElementById("distance").innerText =
                //     "Distance: " + data.distance.toFixed(2) + " cm";
            }
        } catch (e) {}

        setTimeout(updateDistance, 500);
    }

    updateDistance();
});
