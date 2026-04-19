class PulseXRadarConsole extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._commands = {};
        this.currentMatchIndex = 0;
        this.searchQuery = "";

        this.history = [];
        this.historyIndex = -1;
    }

    set commands(val) {
        this._commands = val;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: block;
                width: 100%;
                font-family: 'Courier New', monospace; 
            }

            .input-wrapper {
                position: relative;
                width: 100%; 
                height: 40px;
            }
            
            #cmdInput, 
            #highlight {
                position: absolute; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%;
                padding: 10px;
                box-sizing: border-box; 
                font-size: 1.2em; 
                font-family: inherit;
                white-space: pre;
            }
            #cmdInput {
                background: transparent;
                color: transparent;
                caret-color: #ffffff;
                outline: none; 
                border: none;
                /*z-index: 2;*/
            }
            #highlight {
                /*background: #0d1117;*/
                color: #888;
                /*z-index: 1;*/
                pointer-events: none;
                overflow: hidden;
            }
            
            .slash { color: #ffffff; font-weight: bold; }
            .cmd   { color: #5cd5f5; }
            .num   { color: #fff6a0; }
            .kw    { color: #d38cff; }
        </style>
        <div class="input-wrapper">
            <div id="highlight"></div>
            <input id="cmdInput" spellcheck="false" autocomplete="off" />
        </div>
        `;
    }

    highlight(text) {
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Regex pour capturer : 
        // 1. Le slash (/)
        // 2. Les nombres (\d+)
        // 3. Les mots (\w+)
        return escaped.replace(/(\/)|(\d+)|(\w+)/g, (match, slash, num, word) => {
            if (slash) return `<span class="slash">/</span>`;
            if (num) return `<span class="num">${num}</span>`;
            if (word) {
                // Si c'est une commande (juste après le slash)
                if (text.includes('/' + word)) {
                    return `<span class="cmd">${word}</span>`;
                }
                
                // Si c'est un argument défini dans commandsTree ou un mot-clé standard
                const allPossibleArgs = Object.values(this._commands).flat();
                const keywords = ['on', 'off', 'start', 'stop', 'status'];
                
                if (allPossibleArgs.includes(word) || keywords.includes(word)) {
                    return `<span class="kw">${word}</span>`;
                }
                return word;
            }
            return match;
        });
    }

    setupEventListeners() {
        const input = this.shadowRoot.getElementById('cmdInput');
        const display = this.shadowRoot.getElementById('highlight');

        input.addEventListener('input', () => {
            display.innerHTML = this.highlight(input.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const cmd = input.value.trim();
                if (!cmd) return;

                if (this.history[this.history.length - 1] !== cmd) {
                    this.history.push(cmd);
                }
                this.historyIndex = -1;

                this.dispatchEvent(new CustomEvent('command-submit', {
                    detail: { command: cmd },
                    bubbles: true,
                    composed: true,
                }));
                input.value = "";
                display.innerHTML = "";
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                this.navigateHistory(1, input, display);
            } 
            else if (e.key === "ArrowDown") {
                e.preventDefault();
                this.navigateHistory(-1, input, display);
            } else if (e.key === "Tab") {
                e.preventDefault();
                this.handleAutocomplete(input);
                display.innerHTML = this.highlight(input.value);
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            } else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt") {
                this.searchQuery = "";
                this.currentMatchIndex = 0;
            }
        });
    }

    handleAutocomplete(input) {
        const primaryCommands = Object.keys(this._commands);
        const fullText = input.value;
        const parts = fullText.split(" ");

        if (this.searchQuery === "") {
            this.searchQuery = fullText;
        }

        if (
            !fullText.includes(" ") ||
            (fullText.includes(" ") && this.searchQuery === fullText.trim())
        ) {
            const matches = primaryCommands.filter((command) =>
                command.startsWith(this.searchQuery),
            );

            if (matches.length > 0) {
                input.value = matches[this.currentMatchIndex % matches.length];
                this.currentMatchIndex++;
            }

            return;
        }

        if (parts.length >= 2) {
            const command = parts[0];

            if (this.searchQuery.split(" ").length < 2) {
                this.searchQuery = fullText;
            }

            const argumentPart = this.searchQuery.split(" ")[1] || "";

            if (this._commands[command]) {
                const matches = this._commands[command].filter((argument) =>
                    argument.startsWith(argumentPart),
                );

                if (matches.length > 0) {
                    input.value = `${command} ${matches[this.currentMatchIndex % matches.length]}`;
                    this.currentMatchIndex++;
                }
            }
        }
    }

    navigateHistory(direction, input, display) {
        if (this.history.length === 0) return;

        if (this.historyIndex === -1) {
            this.historyIndex = this.history.length - 1;
        } else {
            this.historyIndex -= direction;
        }

        if (this.historyIndex < 0) this.historyIndex = 0;
        if (this.historyIndex >= this.history.length) {
            this.historyIndex = -1;
            input.value = "";
        } else {
            input.value = this.history[this.historyIndex];
        }

        display.innerHTML = this.highlight(input.value);
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
    }
}

customElements.define('pulsex-radar-console', PulseXRadarConsole);
