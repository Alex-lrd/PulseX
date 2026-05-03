class PulseXRadarCommandLine extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._commands = {};
        
        this.currentMatchIndex = 0;
        this.baseQuery = ""; 
        
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
                height: 100%;
                font-family: 'Courier New', monospace; 
            }

            .consoleDiv {
                display: flex;
                flex-direction: column;
                height: calc(100% - 42px);
                background: #091318;
            }

            #console::-webkit-scrollbar-track { background: #091318; }
            #console::-webkit-scrollbar-thumb { 
                background: #1f2a30;
            }
            #console::-webkit-scrollbar-thumb:hover { background: #133433; }
            #console { 
                scrollbar-width: thin; 
                scrollbar-color: #1f2a30 #091318; 
            }

            .consoleDiv h2 {
                font-size: 1rem;
                padding: 10px;
            }

            #console {
                flex: 1;
                overflow-y: auto;
                padding: 0 10px;
            }

            .logDiv {
                color: #a3c3ff;
            }

            .errorDiv {
                color: #ffa3a3;
            }

            .inputWrapper {
                position: relative;
                width: 100%; 
                height: 40px;
                border-top: 2px solid #133433;
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
                border: none;
                margin: 0;
            }

            #cmdInput {
                background: transparent;
                color: transparent;
                caret-color: #ffffff;
                outline: none; 
                z-index: 2;
            }

            #highlight {
                background: #0d1117;
                color: #888;
                z-index: 1;
                pointer-events: none;
                overflow: hidden;
            }
            
            .slash { color: #ffffff; font-weight: bold; }
            .cmd   { color: #5cd5f5; }
            .num   { color: #fff6a0; }
            .arg   { color: #d38cff; }
        </style>

        <div class="consoleDiv">
            <h2>Historique</h2>
            <div id="console"></div>
        </div>

        <div class="inputWrapper">
            <div id="highlight"></div>
            <input id="cmdInput" spellcheck="false" autocomplete="off" />
        </div>
        `;
    }

    highlight(text) {
        if (!text) return "";
        let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        return escaped.replace(/(\/)|(\d+)|(\w+)/g, (match, slash, num, word, offset) => {
            if (slash) return `<span class="slash">/</span>`;
            if (num) return `<span class="num">${num}</span>`;
            if (word) {
                if (offset === 1 && text.startsWith('/')) {
                    return `<span class="cmd">${word}</span>`;
                }
                
                const allArgs = Object.values(this._commands).flat();
                if (allArgs.includes(word)) {
                    return `<span class="arg">${word}</span>`;
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
            if (e.key === "Tab") {
                e.preventDefault();
                this.handleAutocomplete(input);
                display.innerHTML = this.highlight(input.value);
                
                setTimeout(() => {
                    input.setSelectionRange(input.value.length, input.value.length);
                }, 0);
            } 
            else if (e.key === "Enter") {
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
                this.currentMatchIndex = 0;
                this.baseQuery = "";
            } 
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                this.navigateHistory(e.key === "ArrowUp" ? 1 : -1, input, display);
            } 
            else if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
                this.currentMatchIndex = 0;
                this.baseQuery = "";
            }
        });
    }

    handleAutocomplete(input) {
        if (this.currentMatchIndex === 0) {
            this.baseQuery = input.value;
        }

        const fullText = this.baseQuery;
        const parts = fullText.trim().split(/\s+/);
        const isCommandOnly = !fullText.includes(" ");

        if (isCommandOnly) {
            const matches = Object.keys(this._commands).filter(c => c.startsWith(parts[0]));
            if (matches.length > 0) {
                input.value = matches[this.currentMatchIndex % matches.length];
                this.currentMatchIndex++;
            }
        } else {
            const cmd = parts[0];
            const argQuery = parts[1] || "";
            
            if (this._commands[cmd]) {
                const matches = this._commands[cmd].filter(arg => arg.startsWith(argQuery));
                if (matches.length > 0) {
                    input.value = `${cmd} ${matches[this.currentMatchIndex % matches.length]}`;
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

    isAtBottom(el) {
        return el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
    }

    scrollToBottom(el) {
        el.scrollTop = el.scrollHeight;
    }

    addCommand(cmd) {
        const consoleEl = this.shadowRoot.getElementById('console');
        const shouldScroll = this.isAtBottom(consoleEl);

        let div = document.createElement('div');
        div.innerHTML = this.highlight(cmd);

        consoleEl.appendChild(div);

        if (shouldScroll) this.scrollToBottom(consoleEl);
    }

    addLog(log) {
        const consoleEl = this.shadowRoot.getElementById('console');
        const shouldScroll = this.isAtBottom(consoleEl);

        let div = document.createElement('div');
        div.className = 'logDiv';
        div.innerHTML = `LOG: ${log}`;

        consoleEl.appendChild(div);

        if (shouldScroll) this.scrollToBottom(consoleEl);
    }

    addError(error) {
        const consoleEl = this.shadowRoot.getElementById('console');
        const shouldScroll = this.isAtBottom(consoleEl);

        let div = document.createElement('div');
        div.className = 'errorDiv';
        div.innerHTML = error;

        consoleEl.appendChild(div);

        if (shouldScroll) this.scrollToBottom(consoleEl);
    }
}

customElements.define('pulsex-radar-command-line', PulseXRadarCommandLine);