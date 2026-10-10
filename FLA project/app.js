document.addEventListener('DOMContentLoaded', () => {

    // =====================================================================
    //  GLOBAL STATE
    // =====================================================================
    let machine = {
        type: 'Moore',
        startState: 'q0',
        alphabet: ['a', 'b'],
        states: ['q0', 'q1', 'q2'],
        transitions: {
            'q0': { 'a': 'q0', 'b': 'q1' },
            'q1': { 'a': 'q1', 'b': 'q2' },
            'q2': { 'a': 'q2', 'b': 'q0' }
        },
        outputs: { 'q0': '0', 'q1': '1', 'q2': '0' }
    };

    // =====================================================================
    //  TAB NAVIGATION
    // =====================================================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            stopPlay();
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            if (btn.dataset.target === 'converter') {
                if (machine.type === 'Mealy' && convMode !== 'Me2Mo') {
                    convMode = 'Me2Mo';
                    btnMe2Mo.classList.add('active');
                    btnM2M.classList.remove('active');
                } else if (machine.type === 'Moore' && convMode !== 'M2M') {
                    convMode = 'M2M';
                    btnM2M.classList.add('active');
                    btnMe2Mo.classList.remove('active');
                }
                updateConverter();
            }
        });
    });

    // =====================================================================
    //  GRAPH RENDERER  (highlighted state + highlighted edge)
    // =====================================================================
    function computePositions(stateList) {
        const n = stateList.length;
        const cx = 280, cy = 180;
        const r = Math.min(115, 55 + n * 12);
        const pos = {};
        if (n === 1) { pos[stateList[0]] = { x: cx, y: cy }; return pos; }
        if (n === 2) {
            pos[stateList[0]] = { x: cx - 90, y: cy };
            pos[stateList[1]] = { x: cx + 90, y: cy };
            return pos;
        }
        stateList.forEach((st, i) => {
            const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
            pos[st] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
        });
        return pos;
    }

    function renderGraph(m, svgEl, hlState, hlEdgeKey) {
        if (!m || !svgEl) return;
        const cx = 280, cy = 180;
        const pos = computePositions(m.states);
        const isMoore = m.type === 'Moore';
        const accent = isMoore ? '#f472b6' : '#34d399';
        const uid = svgEl.id || 'svg';

        let html = `<defs>
            <marker id="arr-${uid}" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
            </marker>
            <marker id="arr-hl-${uid}" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15"/>
            </marker>
            <filter id="glow-${uid}">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>`;

        // Collect edges
        let edges = {};
        m.states.forEach(src => {
            const tr = m.transitions[src] || {};
            m.alphabet.forEach(sym => {
                if (!tr[sym]) return;
                let dst, lbl;
                if (isMoore) { dst = tr[sym]; lbl = sym; }
                else { dst = tr[sym].next; lbl = `${sym}/${tr[sym].output}`; }
                const key = `${src}->${dst}`;
                if (!edges[key]) edges[key] = { src, dst, labels: [] };
                edges[key].labels.push(lbl);
            });
        });

        // Draw edges
        Object.entries(edges).forEach(([key, e]) => {
            const { src, dst, labels } = e;
            const p1 = pos[src], p2 = pos[dst];
            if (!p1 || !p2) return;
            let d, tx, ty;
            const isHL = (key === hlEdgeKey);

            if (src === dst) {
                // Radial self-loop pointing outward from graph center
                const dx = p1.x - cx, dy = p1.y - cy;
                const dlen = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dlen < 12 ? 0 : dx / dlen;
                const uy = dlen < 12 ? -1 : dy / dlen;
                const px = -uy, py = ux; // perpendicular vector

                const sx = p1.x + 18 * ux - 13 * px;
                const sy = p1.y + 18 * uy - 13 * py;

                const c1x = p1.x + 55 * ux - 26 * px;
                const c1y = p1.y + 55 * uy - 26 * py;
                const c2x = p1.x + 55 * ux + 26 * px;
                const c2y = p1.y + 55 * uy + 26 * py;

                d = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
                tx = p1.x + 52 * ux;
                ty = p1.y + 52 * uy;
            } else {
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const biKey = `${dst}->${src}`;
                if (edges[biKey]) {
                    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                    const nx = -dy / dist * 32, ny = dx / dist * 32;
                    d = `M ${p1.x} ${p1.y} Q ${mx + nx} ${my + ny} ${p2.x} ${p2.y}`;
                    tx = mx + nx; ty = my + ny;
                } else {
                    d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
                    tx = (p1.x + p2.x) / 2; ty = (p1.y + p2.y) / 2 - 12;
                }
            }

            const strokeColor = isHL ? '#facc15' : '#64748b';
            const strokeW = isHL ? 3.5 : 2;
            const markerRef = isHL ? `url(#arr-hl-${uid})` : `url(#arr-${uid})`;
            const extra = isHL ? `stroke-dasharray="8 4" filter="url(#glow-${uid})"` : '';

            html += `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" marker-end="${markerRef}" ${extra}/>`;

            // Edge label
            const labelText = labels.join(', ');
            const labelW = Math.max(30, labelText.length * 8 + 12);
            html += `<rect x="${tx - labelW / 2}" y="${ty - 9}" width="${labelW}" height="18" fill="#1e1e2e" rx="4" stroke="${isHL ? '#facc15' : '#333'}" stroke-width="1"/>`;
            html += `<text x="${tx}" y="${ty + 4}" fill="${isHL ? '#facc15' : '#e2e8f0'}" font-size="11" text-anchor="middle" font-weight="600">${labelText}</text>`;
        });

        // Draw nodes
        m.states.forEach(st => {
            const p = pos[st];
            if (!p) return;
            const isHL = (st === hlState);

            // Outer glow ring for highlighted
            if (isHL) {
                html += `<circle cx="${p.x}" cy="${p.y}" r="30" fill="none" stroke="#f59e0b" stroke-width="2" opacity="0.4" filter="url(#glow-${uid})">
                    <animate attributeName="r" values="28;34;28" dur="1.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.2s" repeatCount="indefinite"/>
                </circle>`;
            }

            const fill = isHL ? '#f59e0b' : '#1e1e2e';
            const stroke = isHL ? '#fbbf24' : '#475569';
            const textFill = isHL ? '#000' : '#e2e8f0';

            html += `<circle cx="${p.x}" cy="${p.y}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;

            // Start-state arrow
            if (st === m.startState) {
                html += `<line x1="${p.x - 55}" y1="${p.y}" x2="${p.x}" y2="${p.y}" stroke="${stroke}" stroke-width="2" marker-end="url(#arr-${uid})"/>`;
                html += `<text x="${p.x - 40}" y="${p.y - 8}" fill="#94a3b8" font-size="9" font-weight="600">start</text>`;
            }

            if (isMoore) {
                const out = m.outputs[st] || '-';
                const lineStroke = isHL ? 'rgba(0,0,0,0.3)' : stroke;
                const outFill = isHL ? '#000' : accent;
                html += `<text x="${p.x}" y="${p.y - 3}" fill="${textFill}" font-size="13" font-weight="700" text-anchor="middle">${st}</text>`;
                html += `<line x1="${p.x - 21}" y1="${p.y + 4}" x2="${p.x + 21}" y2="${p.y + 4}" stroke="${lineStroke}" stroke-width="1.5"/>`;
                html += `<text x="${p.x}" y="${p.y + 16}" fill="${outFill}" font-size="11" text-anchor="middle" font-weight="700">${out}</text>`;
            } else {
                html += `<text x="${p.x}" y="${p.y + 5}" fill="${textFill}" font-size="13" font-weight="700" text-anchor="middle">${st}</text>`;
            }
        });

        svgEl.innerHTML = html;
        if (svgEl.id === 'sim-svg') {
            applyZoomPan();
        }
    }

    // =====================================================================
    //  ZOOM & PAN FOR TRANSITION DIAGRAM
    // =====================================================================
    let zoomLevel = 1.25; // Default zoomed in for clear, large view
    let panX = 0, panY = 0;

    function applyZoomPan() {
        const simSvg = document.getElementById('sim-svg');
        if (!simSvg) return;
        const baseW = 560, baseH = 360;
        const w = baseW / zoomLevel;
        const h = baseH / zoomLevel;
        const x = (baseW - w) / 2 + panX;
        const y = (baseH - h) / 2 + panY;
        simSvg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    }

    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    const svgContainer = document.getElementById('svg-container');

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            zoomLevel = Math.min(3.5, zoomLevel + 0.25);
            applyZoomPan();
        });
    }
    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            zoomLevel = Math.max(0.5, zoomLevel - 0.25);
            applyZoomPan();
        });
    }
    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            zoomLevel = 1.25;
            panX = 0;
            panY = 0;
            applyZoomPan();
        });
    }

    if (svgContainer) {
        svgContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.15 : -0.15;
            zoomLevel = Math.max(0.5, Math.min(3.5, zoomLevel + delta));
            applyZoomPan();
        }, { passive: false });

        let isDragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;
        svgContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            svgContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panX = startPanX - dx / zoomLevel;
            panY = startPanY - dy / zoomLevel;
            applyZoomPan();
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                svgContainer.style.cursor = 'grab';
            }
        });
    }

    // =====================================================================
    //  SIMULATION ENGINE
    // =====================================================================
    const simInput = document.getElementById('sim-input');
    const traceBody = document.getElementById('trace-body');
    const statePathEl = document.getElementById('state-path');
    const outputStringEl = document.getElementById('output-string');
    const stepCounterEl = document.getElementById('step-counter');
    const typeBadge = document.getElementById('machine-type-badge');
    const btnPlay = document.getElementById('btn-play');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');

    let trace = [];
    let currentStep = 0;
    let playInterval = null;

    function buildTrace() {
        const inputStr = simInput.value.trim();
        trace = [];
        let state = machine.startState;
        const isMoore = machine.type === 'Moore';

        // Step 0 = initial state, no input consumed yet
        trace.push({
            step: 0,
            currentState: state,
            input: '–',
            nextState: state,   // stays at start
            output: isMoore ? (machine.outputs[state] || '–') : '–',
            edgeKey: null
        });

        for (let i = 0; i < inputStr.length; i++) {
            const sym = inputStr[i];
            const tr = machine.transitions[state];
            if (!tr || !tr[sym]) break;

            let nextState, output;
            if (isMoore) {
                nextState = tr[sym];
                output = machine.outputs[nextState] || '–';
            } else {
                nextState = tr[sym].next;
                output = tr[sym].output || '–';
            }

            trace.push({
                step: i + 1,
                currentState: state,
                input: sym,
                nextState: nextState,
                output: output,
                edgeKey: `${state}->${nextState}`
            });
            state = nextState;
        }
    }

    function renderStep(idx) {
        if (trace.length === 0) return;
        currentStep = Math.max(0, Math.min(idx, trace.length - 1));
        const t = trace[currentStep];

        // The state the machine is IN after this step
        const activeState = t.nextState;

        // Badge
        typeBadge.textContent = machine.type + ' Machine';

        // Render graph with highlighted state and edge
        renderGraph(machine, document.getElementById('sim-svg'), activeState, t.edgeKey);

        // Build trace table — show all rows, highlight current
        const isMoore = machine.type === 'Moore';
        traceBody.innerHTML = trace.map((row, i) => {
            const cls = i === currentStep ? 'active-row' : (i < currentStep ? '' : 'future-row');
            const outCls = isMoore ? 'moore-out' : 'mealy-out';
            const opacity = i > currentStep ? 'style="opacity:0.3"' : '';
            return `<tr class="${cls}" ${opacity}>
                <td>${row.step}</td>
                <td>${row.currentState}</td>
                <td>${row.input}</td>
                <td>${row.nextState}</td>
                <td class="${outCls}">${row.output}</td>
            </tr>`;
        }).join('');

        // State path: show path up to current step
        const pathParts = [trace[0].currentState];
        for (let i = 1; i <= currentStep; i++) {
            pathParts.push(trace[i].nextState);
        }
        statePathEl.textContent = pathParts.join(' → ');

        // Output string
        const outParts = [];
        for (let i = 0; i <= currentStep; i++) {
            if (trace[i].output !== '–') outParts.push(trace[i].output);
        }
        outputStringEl.textContent = outParts.length > 0 ? outParts.join('') : '–';

        // Step counter
        stepCounterEl.textContent = `${currentStep} / ${trace.length - 1}`;
    }

    function stopPlay() {
        clearInterval(playInterval);
        playInterval = null;
        btnPlay.textContent = '▶ Play';
    }

    function resetSim() {
        stopPlay();
        buildTrace();
        renderStep(0);
    }

    function stepForward() {
        if (currentStep < trace.length - 1) {
            renderStep(currentStep + 1);
        } else {
            stopPlay();
        }
    }

    // --- Button Handlers ---
    btnReset.addEventListener('click', resetSim);

    btnStep.addEventListener('click', () => {
        stopPlay();
        if (trace.length === 0) buildTrace();
        stepForward();
    });

    btnPlay.addEventListener('click', () => {
        if (playInterval) {
            stopPlay();
            return;
        }

        buildTrace();
        currentStep = 0;
        renderStep(0);
        btnPlay.textContent = '⏸ Pause';

        const speedSelect = document.getElementById('sim-speed');
        const intervalTime = speedSelect ? parseInt(speedSelect.value, 10) || 900 : 900;

        playInterval = setInterval(() => {
            if (currentStep < trace.length - 1) {
                renderStep(currentStep + 1);
            } else {
                stopPlay();
            }
        }, intervalTime);
    });

    // Typing input → jump to final state instantly
    simInput.addEventListener('input', () => {
        stopPlay();
        buildTrace();
        renderStep(trace.length - 1);
    });

    // =====================================================================
    //  CONVERTER
    // =====================================================================
    const btnM2M = document.getElementById('btn-m2m');
    const btnMe2Mo = document.getElementById('btn-me2mo');
    let convMode = 'M2M';
    let lastConvertedSrc = null;
    let lastConvertedTgt = null;

    btnM2M.addEventListener('click', () => {
        convMode = 'M2M';
        btnM2M.classList.add('active');
        btnMe2Mo.classList.remove('active');
        updateConverter();
    });
    btnMe2Mo.addEventListener('click', () => {
        convMode = 'Me2Mo';
        btnMe2Mo.classList.add('active');
        btnM2M.classList.remove('active');
        updateConverter();
    });

    function updateConverter() {
        try {
            const srcTitle = document.getElementById('conv-src-title');
            const tgtTitle = document.getElementById('conv-tgt-title');
            const srcSvg = document.getElementById('conv-src-svg');
            const tgtSvg = document.getElementById('conv-tgt-svg');

            let src, tgt;

            if (convMode === 'M2M') {
                // Moore → Mealy
                if (machine.type === 'Moore') {
                    src = JSON.parse(JSON.stringify(machine)); // deep copy
                } else {
                    src = mealyToMoore(machine);
                }
                tgt = mooreToMealy(src);
                srcTitle.textContent = '📥 Source: Moore Machine';
                tgtTitle.textContent = '📤 Result: Mealy Machine';
            } else {
                // Mealy → Moore
                if (machine.type === 'Mealy') {
                    src = JSON.parse(JSON.stringify(machine));
                } else {
                    src = mooreToMealy(machine);
                }
                tgt = mealyToMoore(src);
                srcTitle.textContent = '📥 Source: Mealy Machine';
                tgtTitle.textContent = '📤 Result: Moore Machine';
            }

            lastConvertedSrc = src;
            lastConvertedTgt = tgt;

            // Render diagrams
            renderGraph(src, srcSvg, null, null);
            renderGraph(tgt, tgtSvg, null, null);

            // Render transition tables
            renderTransTable(src, 'conv-src');
            renderTransTable(tgt, 'conv-tgt');

            // Render verification
            runVerification();

            console.log('Converter updated:', convMode, src, tgt);
        } catch (err) {
            console.error('Converter error:', err);
        }
    }

    // --- Verification: run both machines on the same input to prove equivalence ---
    function runVerification() {
        const verifyInput = document.getElementById('conv-verify-input');
        const verifyResult = document.getElementById('conv-verify-result');
        if (!verifyInput || !verifyResult || !lastConvertedSrc || !lastConvertedTgt) return;

        const inputStr = verifyInput.value.trim();
        if (!inputStr) { verifyResult.textContent = 'Enter an input string above to verify equivalence.'; return; }

        const srcOut = runMachineOnInput(lastConvertedSrc, inputStr);
        const tgtOut = runMachineOnInput(lastConvertedTgt, inputStr);

        // Moore outputs include initial state output; Mealy does not
        // So we compare the meaningful output
        const match = srcOut.output === tgtOut.output || 
                      srcOut.output.substring(1) === tgtOut.output ||
                      srcOut.output === tgtOut.output.substring(1);

        verifyResult.innerHTML = `
            <strong>Source output:</strong> <span class="${lastConvertedSrc.type === 'Moore' ? 'moore-out' : 'mealy-out'}">${srcOut.output || '(empty)'}</span>
            &nbsp;|&nbsp; <strong>Path:</strong> ${srcOut.path}<br>
            <strong>Target output:</strong> <span class="${lastConvertedTgt.type === 'Moore' ? 'moore-out' : 'mealy-out'}">${tgtOut.output || '(empty)'}</span>
            &nbsp;|&nbsp; <strong>Path:</strong> ${tgtOut.path}<br>
            <strong>Equivalent:</strong> ${match ? '✅ Yes' : '❌ No (check conversion)'}
        `;
    }

    function runMachineOnInput(m, inputStr) {
        let state = m.startState;
        let output = '';
        const isMoore = m.type === 'Moore';
        const pathParts = [state];

        if (isMoore) output += m.outputs[state] || '';

        for (let i = 0; i < inputStr.length; i++) {
            const sym = inputStr[i];
            const tr = m.transitions[state];
            if (!tr || !tr[sym]) break;
            if (isMoore) {
                state = tr[sym];
                output += m.outputs[state] || '';
            } else {
                output += tr[sym].output || '';
                state = tr[sym].next;
            }
            pathParts.push(state);
        }
        return { output, path: pathParts.join(' → ') };
    }

    function renderTransTable(m, prefix) {
        const head = document.getElementById(`${prefix}-head`);
        const body = document.getElementById(`${prefix}-body`);
        if (!head || !body) return;
        const isMoore = m.type === 'Moore';

        let hdr = '<tr><th>State</th>';
        m.alphabet.forEach(sym => { hdr += isMoore ? `<th>δ(${sym})</th>` : `<th>δ(${sym}) / λ(${sym})</th>`; });
        if (isMoore) hdr += '<th>λ (output)</th>';
        hdr += '</tr>';
        head.innerHTML = hdr;

        body.innerHTML = m.states.map(st => {
            let row = `<tr><td><strong>${st}</strong></td>`;
            m.alphabet.forEach(sym => {
                const tr = m.transitions[st];
                if (!tr || !tr[sym]) { row += '<td>–</td>'; return; }
                if (isMoore) row += `<td>${tr[sym]}</td>`;
                else row += `<td>${tr[sym].next} / ${tr[sym].output}</td>`;
            });
            if (isMoore) row += `<td class="moore-out">${m.outputs[st] || '–'}</td>`;
            row += '</tr>';
            return row;
        }).join('');
    }

    function mooreToMealy(moore) {
        const mealy = {
            type: 'Mealy',
            startState: moore.startState,
            alphabet: [...moore.alphabet],
            states: [...moore.states],
            transitions: {}
        };
        moore.states.forEach(s => {
            mealy.transitions[s] = {};
            moore.alphabet.forEach(sym => {
                const next = moore.transitions[s] ? moore.transitions[s][sym] : undefined;
                if (next !== undefined) {
                    mealy.transitions[s][sym] = { next: next, output: moore.outputs[next] || '0' };
                }
            });
        });
        return mealy;
    }

    function mealyToMoore(mealy) {
        const moore = { type: 'Moore', alphabet: [...mealy.alphabet], states: [], transitions: {}, outputs: {} };
        const map = {};

        // Step 1: For each Mealy state, find all distinct incoming outputs
        mealy.states.forEach(q => {
            const incoming = new Set();
            mealy.states.forEach(src => {
                mealy.alphabet.forEach(sym => {
                    const t = mealy.transitions[src] ? mealy.transitions[src][sym] : null;
                    if (t && t.next === q) incoming.add(t.output);
                });
            });
            if (incoming.size === 0) incoming.add('0'); // default
            map[q] = Array.from(incoming);
            map[q].forEach(o => {
                const nq = `${q}_${o}`;
                moore.states.push(nq);
                moore.outputs[nq] = o;
            });
        });

        // Step 2: Start state
        moore.startState = `${mealy.startState}_${map[mealy.startState][0]}`;

        // Step 3: Build transitions
        mealy.states.forEach(src => {
            map[src].forEach(o => {
                const ns = `${src}_${o}`;
                moore.transitions[ns] = {};
                mealy.alphabet.forEach(sym => {
                    const t = mealy.transitions[src] ? mealy.transitions[src][sym] : null;
                    if (t) {
                        moore.transitions[ns][sym] = `${t.next}_${t.output}`;
                    }
                });
            });
        });
        return moore;
    }

    // =====================================================================
    //  DEFINE MACHINE  (like the Java app)
    // =====================================================================
    const defStates = document.getElementById('def-states');
    const defAlphabet = document.getElementById('def-alphabet');
    const defTableHead = document.getElementById('def-table-head');
    const defTableBody = document.getElementById('def-table-body');
    const btnGenTable = document.getElementById('btn-generate-table');
    const btnBuild = document.getElementById('btn-build-machine');

    btnGenTable.addEventListener('click', generateDefTable);
    btnBuild.addEventListener('click', buildMachineFromEditor);

    function getSelectedType() {
        return document.querySelector('input[name="machine-type"]:checked').value;
    }

    function generateDefTable() {
        const type = getSelectedType();
        const states = defStates.value.split(',').map(s => s.trim()).filter(Boolean);
        const alpha = defAlphabet.value.split(',').map(s => s.trim()).filter(Boolean);
        if (states.length === 0 || alpha.length === 0) return;

        let hdr = '<tr><th>State</th>';
        if (type === 'Moore') {
            alpha.forEach(sym => { hdr += `<th>δ(${sym})</th>`; });
            hdr += '<th>Output λ</th>';
        } else {
            alpha.forEach(sym => { hdr += `<th>δ(${sym})</th><th>λ(${sym})</th>`; });
        }
        hdr += '</tr>';
        defTableHead.innerHTML = hdr;

        defTableBody.innerHTML = states.map(st => {
            let row = `<tr><td><strong>${st}</strong></td>`;
            if (type === 'Moore') {
                alpha.forEach(sym => {
                    row += `<td><select class="def-next" data-state="${st}" data-sym="${sym}">`;
                    states.forEach(s2 => { row += `<option value="${s2}">${s2}</option>`; });
                    row += `</select></td>`;
                });
                row += `<td><input type="text" class="def-output" data-state="${st}" value="0" style="width:60px"></td>`;
            } else {
                alpha.forEach(sym => {
                    row += `<td><select class="def-next" data-state="${st}" data-sym="${sym}">`;
                    states.forEach(s2 => { row += `<option value="${s2}">${s2}</option>`; });
                    row += `</select></td>`;
                    row += `<td><input type="text" class="def-trans-out" data-state="${st}" data-sym="${sym}" value="0" style="width:60px"></td>`;
                });
            }
            row += '</tr>';
            return row;
        }).join('');
    }

    function buildMachineFromEditor() {
        const type = getSelectedType();
        const states = defStates.value.split(',').map(s => s.trim()).filter(Boolean);
        const alpha = defAlphabet.value.split(',').map(s => s.trim()).filter(Boolean);
        if (states.length === 0 || alpha.length === 0) return;

        const newMachine = { type, startState: states[0], alphabet: alpha, states: [...states], transitions: {}, outputs: {} };

        if (type === 'Moore') {
            states.forEach(st => {
                newMachine.transitions[st] = {};
                alpha.forEach(sym => {
                    const sel = document.querySelector(`.def-next[data-state="${st}"][data-sym="${sym}"]`);
                    if (sel) newMachine.transitions[st][sym] = sel.value;
                });
                const outInp = document.querySelector(`.def-output[data-state="${st}"]`);
                newMachine.outputs[st] = outInp ? outInp.value.trim() || '0' : '0';
            });
        } else {
            states.forEach(st => {
                newMachine.transitions[st] = {};
                alpha.forEach(sym => {
                    const sel = document.querySelector(`.def-next[data-state="${st}"][data-sym="${sym}"]`);
                    const outInp = document.querySelector(`.def-trans-out[data-state="${st}"][data-sym="${sym}"]`);
                    newMachine.transitions[st][sym] = {
                        next: sel ? sel.value : states[0],
                        output: outInp ? outInp.value.trim() || '0' : '0'
                    };
                });
            });
        }

        machine = newMachine;
        // Validate simInput characters against the new alphabet
        const hasValidChars = [...simInput.value].every(ch => alpha.includes(ch));
        if (!hasValidChars || !simInput.value.trim()) {
            simInput.value = alpha.length > 1 ? `${alpha[0]}${alpha[0]}${alpha[1]}` : alpha[0];
        }

        document.querySelector('.tab-btn[data-target="simulator"]').click();
        resetSim();
    }

    // Auto-regenerate definition table when toggling Moore / Mealy radio
    document.querySelectorAll('input[name="machine-type"]').forEach(radio => {
        radio.addEventListener('change', generateDefTable);
    });

    // Generate the initial definition table
    generateDefTable();

    // =====================================================================
    //  VERIFY BUTTON
    // =====================================================================
    const btnVerify = document.getElementById('btn-verify');
    if (btnVerify) {
        btnVerify.addEventListener('click', () => {
            updateConverter();
        });
    }
    const convVerifyInput = document.getElementById('conv-verify-input');
    if (convVerifyInput) {
        convVerifyInput.addEventListener('input', () => {
            if (lastConvertedSrc && lastConvertedTgt) runVerification();
        });
    }

    // =====================================================================
    //  PRESET MACHINES
    // =====================================================================
    const PRESETS = {
        'moore-default': {
            type: 'Moore',
            startState: 'q0',
            alphabet: ['a', 'b'],
            states: ['q0', 'q1', 'q2'],
            transitions: {
                'q0': { 'a': 'q0', 'b': 'q1' },
                'q1': { 'a': 'q1', 'b': 'q2' },
                'q2': { 'a': 'q2', 'b': 'q0' }
            },
            outputs: { 'q0': '0', 'q1': '1', 'q2': '0' },
            sampleInput: 'aab'
        },
        'mealy-compl': {
            type: 'Mealy',
            startState: 'q0',
            alphabet: ['0', '1'],
            states: ['q0'],
            transitions: {
                'q0': {
                    '0': { next: 'q0', output: '1' },
                    '1': { next: 'q0', output: '0' }
                }
            },
            outputs: {},
            sampleInput: '10110'
        },
        'moore-mod3': {
            type: 'Moore',
            startState: 'q0',
            alphabet: ['1'],
            states: ['q0', 'q1', 'q2'],
            transitions: {
                'q0': { '1': 'q1' },
                'q1': { '1': 'q2' },
                'q2': { '1': 'q0' }
            },
            outputs: { 'q0': '0', 'q1': '1', 'q2': '2' },
            sampleInput: '11111'
        },
        'moore-seq101': {
            type: 'Moore',
            startState: 'q0',
            alphabet: ['0', '1'],
            states: ['q0', 'q1', 'q2', 'q3'],
            transitions: {
                'q0': { '0': 'q0', '1': 'q1' },
                'q1': { '0': 'q2', '1': 'q1' },
                'q2': { '0': 'q0', '1': 'q3' },
                'q3': { '0': 'q2', '1': 'q1' }
            },
            outputs: { 'q0': '0', 'q1': '0', 'q2': '0', 'q3': '1' },
            sampleInput: '10101'
        },
        'mealy-parity': {
            type: 'Mealy',
            startState: 'even',
            alphabet: ['0', '1'],
            states: ['even', 'odd'],
            transitions: {
                'even': {
                    '0': { next: 'even', output: '0' },
                    '1': { next: 'odd', output: '1' }
                },
                'odd': {
                    '0': { next: 'odd', output: '1' },
                    '1': { next: 'even', output: '0' }
                }
            },
            outputs: {},
            sampleInput: '1011'
        }
    };

    // Shared preset loading function
    function loadPreset(key) {
        if (!key || !PRESETS[key]) return;
        const p = PRESETS[key];
        machine = JSON.parse(JSON.stringify(p));
        simInput.value = p.sampleInput || '';

        // Sync Define Machine fields
        if (defStates) defStates.value = p.states.join(',');
        if (defAlphabet) defAlphabet.value = p.alphabet.join(',');
        const defOutputs = document.getElementById('def-outputs');
        if (defOutputs) {
            const outList = p.type === 'Moore'
                ? Array.from(new Set(Object.values(p.outputs)))
                : Array.from(new Set(Object.values(p.transitions).flatMap(tr => Object.values(tr).map(t => t.output))));
            defOutputs.value = outList.length ? outList.join(',') : '0,1';
        }
        const radio = document.querySelector(`input[name="machine-type"][value="${p.type}"]`);
        if (radio) radio.checked = true;

        generateDefTable();

        // Populate def table inputs
        p.states.forEach(st => {
            p.alphabet.forEach(sym => {
                const sel = document.querySelector(`.def-next[data-state="${st}"][data-sym="${sym}"]`);
                if (p.type === 'Moore') {
                    if (sel && p.transitions[st] && p.transitions[st][sym]) sel.value = p.transitions[st][sym];
                } else {
                    if (sel && p.transitions[st] && p.transitions[st][sym]) sel.value = p.transitions[st][sym].next;
                    const outInp = document.querySelector(`.def-trans-out[data-state="${st}"][data-sym="${sym}"]`);
                    if (outInp && p.transitions[st] && p.transitions[st][sym]) outInp.value = p.transitions[st][sym].output;
                }
            });
            if (p.type === 'Moore') {
                const outInp = document.querySelector(`.def-output[data-state="${st}"]`);
                if (outInp && p.outputs[st] !== undefined) outInp.value = p.outputs[st];
            }
        });

        const convInput = document.getElementById('conv-verify-input');
        if (convInput) convInput.value = p.sampleInput || 'aab';

        // Sync both preset dropdowns
        const ps1 = document.getElementById('preset-selector');
        const ps2 = document.getElementById('preset-selector-editor');
        if (ps1) ps1.value = key;
        if (ps2) ps2.value = key;

        resetSim();
        updateConverter();
    }

    // Wire up both preset selectors
    const presetSelector = document.getElementById('preset-selector');
    const presetSelectorEditor = document.getElementById('preset-selector-editor');
    if (presetSelector) {
        presetSelector.addEventListener('change', () => loadPreset(presetSelector.value));
    }
    if (presetSelectorEditor) {
        presetSelectorEditor.addEventListener('change', () => loadPreset(presetSelectorEditor.value));
    }

    // =====================================================================
    //  BOOT
    // =====================================================================
    loadPreset('moore-default');
});
