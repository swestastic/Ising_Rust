import init, { Ising } from "./pkg/ising_gui_rust.js";

let wasm;
let ising;
let n = 64; // default lattice size
let temp = 2.27;
let j = 1.0;
let h = 0.0;
let canvas, ctx, imageData;
let spins = null;
let animationId;
let algorithm = "metropolis";
let sweepsPerFrame = 1;
let plotLabel, plotTypeDropdown, energyValue, magnetizationValue, acceptanceRatioValue, sweepsPerSecValue, avgEnergy30sValue, avgMagnetization30sValue, avgAbsMagnetization30sValue, livePlot, livePlotCtx;
let plotHistory = [];
const maxHistory = 400;
let plotType = "energy";
// Modal canvas references
let canvasModal, modalCanvas, modalCtx, expandedCanvasType = null;
// Top-level references for temperature controls
let tempSlider = null;
let runSweepBtn = null;
let sweepNWarmup = null;
let sweepNDecor = null;
let tempValue = null;
let downloadCsvBtn = null;
// Sweep state

let sweepState = null;
let sweepRunning = false;

// Cache algorithm function for performance
let algorithmFunc = null;

function getAlgorithmFunc(algo) {
    if (algo === "metropolis") return () => ising.metropolis_step();
    if (algo === "wolff") return () => ising.wolff_step();
    if (algo === "swendsen-wang") return () => ising.swendsen_wang_step();
    if (algo === "heat-bath") return () => ising.heatbath_step();
    if (algo === "glauber") return () => ising.glauber_step();
    if (algo === "kawasaki") return () => ising.kawasaki_step();
    return () => ising.metropolis_step();
}

async function run() {
    downloadCsvBtn = document.getElementById("download-csv-btn");
    downloadCsvBtn.disabled = true;
    downloadCsvBtn.style.background = "#444";
    downloadCsvBtn.style.color = "#ccc";
    downloadCsvBtn.style.cursor = "not-allowed";

    downloadCsvBtn.addEventListener("click", () => {
        if (!sweepState || !sweepState.results || sweepState.results.length === 0) return;
        let csv = "T,Energy,Energy_SEM,Magnetization,Magnetization_SEM,Acceptance,Acceptance_SEM,Energy2,Energy2_SEM,Magnetization2,Magnetization2_SEM,SpecificHeat,MagneticSusceptibility\n";
        for (const row of sweepState.results) {
            csv += `${row.temp},${row.energy},${row.energy_sem},${row.magnetization},${row.magnetization_sem},${row.acceptance},${row.acceptance_sem},${row.energy2},${row.energy2_sem},${row.magnetization2},${row.magnetization2_sem},${row.specific_heat},${row.susceptibility}\n`;
        }
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        let algoName = algorithm;
        if (algoName === "heat-bath") algoName = "heatbath";
        a.href = url;
        a.download = `ising_${algoName}_results.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    });
    // Sweep controls
    const sweepTInit = document.getElementById("sweep-t-init");
    const sweepTFinal = document.getElementById("sweep-t-final");
    const sweepTStep = document.getElementById("sweep-t-step");
    const sweepNSweeps = document.getElementById("sweep-n-sweeps");
    runSweepBtn = document.getElementById("run-sweep-btn");
    sweepNDecor = document.getElementById("sweep-n-decor");
    sweepNWarmup = document.getElementById("sweep-n-warmup");

    runSweepBtn.addEventListener("click", () => {
        if (sweepRunning) {
            // Stop sweep
            sweepRunning = false;
            if (sweepState) sweepState.active = false;
            runSweepBtn.textContent = "Run T Sweep";
            runSweepBtn.disabled = false;
            return;
        }
        let tInit = parseFloat(sweepTInit.value);
        let tFinal = parseFloat(sweepTFinal.value);
        let tStep = parseFloat(sweepTStep.value);
        let nSweeps = parseInt(sweepNSweeps.value);
        let nDecor = parseInt(sweepNDecor.value);
        let nWarmup = parseInt(sweepNWarmup.value);
        if (isNaN(tInit) || isNaN(tFinal) || isNaN(tStep) || isNaN(nSweeps) || nSweeps < 1) {
            alert("Invalid sweep parameters.");
            return;
        }
        let tVals = [];
        if (tStep === 0) return;
        if ((tStep > 0 && tInit > tFinal) || (tStep < 0 && tInit < tFinal)) {
            alert("Step direction does not match range.");
            return;
        }
        let t = tInit;
        if (tStep > 0) {
            while (t <= tFinal) {
                tVals.push(Number(t.toFixed(6)));
                t += tStep;
            }
            if (tVals[tVals.length - 1] < tFinal) {
                tVals.push(Number(tFinal.toFixed(6)));
            }
        } else {
            while (t >= tFinal) {
                tVals.push(Number(t.toFixed(6)));
                t += tStep;
            }
            if (tVals[tVals.length - 1] > tFinal) {
                tVals.push(Number(tFinal.toFixed(6)));
            }
        }
        sweepState = {
            active: true,
            tVals,
            tIndex: 0,
            nSweeps,
            nDecor,
            nWarmup,
            sweepCount: 0,
            decorCount: 0,
            warmupCount: 0,
            batchSize: sweepsPerFrame, // sweeps per frame from slider
            results: [],
            phase: "warmup", // "warmup", "decor", "meas"
            // Store all measurement values for binning
            binData: tVals.map(() => ({ energy: [], magnetization: [], acceptance: [], energy2: [], magnetization2: [] }))
        };
        sweepRunning = true;
        runSweepBtn.textContent = "Stop T Sweep";
        runSweepBtn.disabled = false;
    });
    // Slider for external field h
    const hSlider = document.getElementById("h-slider");
    const hValue = document.getElementById("h-value");
    hSlider.addEventListener("input", () => {
        h = parseFloat(hSlider.value);
        hValue.value = h.toFixed(2);
        ising.set_h(h);
    });
    hValue.addEventListener("change", () => {
        let val = parseFloat(hValue.value);
        if (isNaN(val) || val < -2.0 || val > 2.0) {
            hValue.value = h.toFixed(2);
            return;
        }
        h = val;
        hSlider.value = h;
        ising.set_h(h);
    });
    wasm = await init();

    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    // Energy plot setup
    plotLabel = document.getElementById("plot-label");
    plotTypeDropdown = document.getElementById("plot-type");
    energyValue = document.getElementById("energy-value");
    magnetizationValue = document.getElementById("magnetization-value");
    acceptanceRatioValue = document.getElementById("acceptance-ratio");
    sweepsPerSecValue = document.getElementById("sweeps-per-sec");
    avgEnergy30sValue = document.getElementById("avg-energy-30s");
    avgMagnetization30sValue = document.getElementById("avg-magnetization-30s");
    avgAbsMagnetization30sValue = document.getElementById("avg-abs-magnetization-30s");
    plotTypeDropdown.addEventListener("change", () => {
        plotType = plotTypeDropdown.value;
        plotHistory = [];
    });
    livePlot = document.getElementById("live-plot");
    livePlotCtx = livePlot.getContext("2d");

    setupIsing(n);

    // Slider for temperature
    tempSlider = document.getElementById("temp-slider");
    tempValue = document.getElementById("temp-value");
    tempSlider.addEventListener("input", () => {
        temp = parseFloat(tempSlider.value);
        tempValue.value = temp.toFixed(2);
        ising.set_temp(temp);
    });

    tempValue.addEventListener("change", () => {
        let val = parseFloat(tempValue.value);
        if (isNaN(val) || val < 0.1 || val > 5.0) {
            tempValue.value = temp.toFixed(2);
            return;
        }
        temp = val;
        tempSlider.value = temp;
        ising.set_temp(temp);
    });

    // Slider for coupling constant J
    const jSlider = document.getElementById("j-slider");
    const jValue = document.getElementById("j-value");
    jSlider.addEventListener("input", () => {
        j = parseFloat(jSlider.value);
        jValue.value = j.toFixed(2);
        ising.set_j(j);
    });

    jValue.addEventListener("change", () => {
        let val = parseFloat(jValue.value);
        if (isNaN(val) || val < -2.0 || val > 2.0) {
            jValue.value = j.toFixed(2);
            return;
        }
        j = val;
        jSlider.value = j;
        ising.set_j(j);
    });

    // Dropdown for lattice size
    const latticeDropdown = document.getElementById("lattice-size");
    latticeDropdown.addEventListener("change", () => {
        n = parseInt(latticeDropdown.value);
        setupIsing(n);
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });

    // Algorithm dropdown
    const algorithmDropdown = document.getElementById("algorithm");
    algorithmDropdown.addEventListener("change", () => {
        algorithm = algorithmDropdown.value;
        algorithmFunc = getAlgorithmFunc(algorithm);
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });
    
    // Initialize algorithm function
    algorithmFunc = getAlgorithmFunc(algorithm);

    // Sweeps per frame slider
    const skipSlider = document.getElementById("skip-slider");
    const skipInput = document.getElementById("skip-input");
    skipSlider.addEventListener("input", () => {
        sweepsPerFrame = parseInt(skipSlider.value);
        skipInput.value = sweepsPerFrame;
        if (sweepState && sweepState.active) {
            sweepState.batchSize = sweepsPerFrame;
        }
    });
    skipInput.addEventListener("change", () => {
        let val = parseInt(skipInput.value);
        if (isNaN(val) || val < parseInt(skipSlider.min) || val > parseInt(skipSlider.max)) {
            skipInput.value = sweepsPerFrame;
            return;
        }
        sweepsPerFrame = val;
        skipSlider.value = val;
        if (sweepState && sweepState.active) {
            sweepState.batchSize = sweepsPerFrame;
        }
    });
    skipInput.value = sweepsPerFrame;

    // Modal functionality for canvas expansion
    canvasModal = document.getElementById("canvas-modal");
    modalCanvas = document.getElementById("modal-canvas");
    modalCtx = modalCanvas.getContext("2d");
    const modalClose = canvasModal.querySelector(".modal-close");

    function openModal(canvasType) {
        expandedCanvasType = canvasType;
        canvasModal.classList.add("active");
        
        // Set modal canvas size to be larger (80% of viewport)
        const maxSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8);
        
        if (canvasType === "sim") {
            // For simulation canvas, match the aspect ratio of the lattice
            modalCanvas.width = n;
            modalCanvas.height = n;
            modalCanvas.style.width = maxSize + "px";
            modalCanvas.style.height = maxSize + "px";
            modalCanvas.style.imageRendering = "pixelated";
            
            // Copy current simulation state
            if (spins) {
                const modalImageData = modalCtx.createImageData(n, n);
                const data32 = new Uint32Array(modalImageData.data.buffer);
                for (let i = 0; i < n * n; i++) {
                    data32[i] = spins[i] === 1 ? 0xFFFFFFFF : 0xFF000000;
                }
                modalCtx.putImageData(modalImageData, 0, 0);
            }
        } else if (canvasType === "plot") {
            // For plot canvas, use a larger resolution
            modalCanvas.width = 800;
            modalCanvas.height = 800;
            modalCanvas.style.width = maxSize + "px";
            modalCanvas.style.height = maxSize + "px";
            modalCanvas.style.imageRendering = "auto";
            
            // Redraw the plot at higher resolution
            drawPlotToCanvas(modalCtx, modalCanvas.width, modalCanvas.height);
        }
    }

    function closeModal() {
        canvasModal.classList.remove("active");
        expandedCanvasType = null;
    }

    // Click handlers for canvases
    canvas.addEventListener("click", () => openModal("sim"));
    livePlot.addEventListener("click", () => openModal("plot"));
    
    // Close modal on click
    canvasModal.addEventListener("click", closeModal);
    modalClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeModal();
    });
    
    // Prevent closing when clicking on the canvas itself
    modalCanvas.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Reset button logic
    const resetBtn = document.getElementById("reset-btn");
    resetBtn.addEventListener("click", () => {
        setupIsing(n);
        plotHistory = [];
        lastTime = performance.now();
        lastSweepCount = 0;
        render.sweepCount = 0;
        sweepsHistory = [];
        timeHistory = [];
        historyStartIndex = 0;
        energySamples = [];
        magnetizationSamples = [];
        absMagnetizationSamples = [];
        energyStartIndex = 0;
        magnetizationStartIndex = 0;
        absMagnetizationStartIndex = 0;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });

    const resetDataBtn = document.getElementById("reset-data-btn");
    resetDataBtn.addEventListener("click", () => {
        ising.reset_data();
        plotHistory = [];
        lastTime = performance.now();
        lastSweepCount = 0;
        render.sweepCount = 0;
        sweepsHistory = [];
        timeHistory = [];
        historyStartIndex = 0;
        energySamples = [];
        magnetizationSamples = [];
        absMagnetizationSamples = [];
        energyStartIndex = 0;
        magnetizationStartIndex = 0;
        absMagnetizationStartIndex = 0;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });

    render();
}

function setupIsing(size) {
    ising = new Ising(size, temp, j);
    ising.set_h(h);
    canvas.width = size;
    canvas.height = size;
    // Keep the canvas display size constant
    canvas.style.width = "400px";
    canvas.style.height = "400px";
    ctx = canvas.getContext("2d");
    imageData = ctx.createImageData(size, size);
    // Create/reuse spins typed array
    const ptr = ising.spins_ptr;
    spins = new Int8Array(wasm.memory.buffer, ptr, size * size);
}

let lastTime = performance.now();
let lastSweepCount = 0;
let sweepsHistory = [];
let timeHistory = [];
let historyStartIndex = 0; // Track start index instead of shifting
let energySamples = []; // {t, e} samples for 30s rolling average
let magnetizationSamples = []; // {t, m} samples for 30s rolling average
let absMagnetizationSamples = []; // {t, absM} samples for 30s rolling average
let energyStartIndex = 0;
let magnetizationStartIndex = 0;
let absMagnetizationStartIndex = 0;

// Helper function to draw plot to any canvas context
function drawPlotToCanvas(ctx, width, height) {
    if (plotType === "no_plot" || plotHistory.length === 0) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate margins based on canvas size
    const leftMargin = width * 0.1;
    const rightMargin = width * 0.025;
    const topMargin = height * 0.05;
    const bottomMargin = height * 0.05;
    
    // Axes
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Y axis
    ctx.moveTo(leftMargin, topMargin);
    ctx.lineTo(leftMargin, height - bottomMargin);
    // X axis
    ctx.moveTo(leftMargin, height - bottomMargin);
    ctx.lineTo(width - rightMargin, height - bottomMargin);
    ctx.stroke();
    
    // Y labels
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.floor(height * 0.02)}px Arial`;
    ctx.textAlign = "right";
    let yMin, yMax;
    if (plotType === "energy") {
        yMin = -2 * Math.abs(j) - Math.abs(h);
        yMax = 2 * Math.abs(j) + Math.abs(h);
        ctx.fillText(yMin.toFixed(2), leftMargin - 5, height - bottomMargin);
        ctx.fillText("0", leftMargin - 5, height / 2);
        ctx.fillText(yMax.toFixed(2), leftMargin - 5, topMargin);
    } else {
        yMin = -1;
        yMax = 1;
        ctx.fillText("-1", leftMargin - 5, height - bottomMargin);
        ctx.fillText("0", leftMargin - 5, height / 2);
        ctx.fillText("1", leftMargin - 5, topMargin);
    }
    
    // X label
    ctx.textAlign = "center";
    ctx.font = `${Math.floor(height * 0.025)}px Arial`;
    ctx.fillText("Frame", width / 2, height - 5);
    
    // Y axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = `${Math.floor(height * 0.025)}px Arial`;
    if (plotType === "acceptance_ratio") {
        ctx.fillText("Acceptance Ratio", 0, 0);
    } else if (plotType === "magnetization") {
        ctx.fillText("Magnetization", 0, 0);
    } else if (plotType === "abs_magnetization") {
        ctx.fillText("Absolute Magnetization", 0, 0);
    } else if (plotType === "energy") {
        ctx.fillText("Energy", 0, 0);
    }
    ctx.restore();
    ctx.restore();
    
    // Plot line
    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    const plotLeft = leftMargin;
    const plotRight = width - rightMargin;
    const plotTop = topMargin;
    const plotBottom = height - bottomMargin;
    
    for (let i = 0; i < plotHistory.length; i++) {
        const x = plotLeft + ((plotRight - plotLeft) * i) / maxHistory;
        let y = plotBottom - ((plotHistory[i] - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

function render() {
    // No scaling needed for square aspect ratio, use default transform
    livePlotCtx.setTransform(1, 0, 0, 1, 0, 0);
    // Track actual sweeps performed this frame
    let sweepsThisFrame = 0;
    // If a sweep is active, run it in sync with animation frames
    if (sweepState && sweepState.active) {
        // If finished with all temps, end sweep
        if (sweepState.tIndex >= sweepState.tVals.length) {
            sweepState.active = false;
            sweepRunning = false;
            runSweepBtn.textContent = "Run T Sweep";
            runSweepBtn.disabled = false;
            // Enable CSV download button
            downloadCsvBtn.disabled = false;
            downloadCsvBtn.style.background = "#2a7";
            downloadCsvBtn.style.color = "#fff";
            downloadCsvBtn.style.cursor = "pointer";
            console.log("Sweep results:", sweepState.results);
            alert("Sweep complete! See console for results.");
        } else {
            // Set temp for this step
            let t = sweepState.tVals[sweepState.tIndex];
            ising.set_temp(t);
            temp = t;
            tempSlider.value = t;
            tempValue.value = t.toFixed(2);
            if (sweepState.phase === "warmup") {
                // Run warmup sweeps
                let batch = Math.min(sweepState.batchSize, sweepState.nWarmup - sweepState.warmupCount);
                for (let s = 0; s < batch; s++) {
                    algorithmFunc();
                }
                sweepsThisFrame += batch;
                sweepState.warmupCount += batch;
                if (sweepState.warmupCount >= sweepState.nWarmup) {
                    sweepState.phase = "decor";
                    sweepState.warmupCount = 0;
                }
            } else if (sweepState.phase === "decor") {
                // Run decorrelation sweeps
                let batch = Math.min(sweepState.batchSize, sweepState.nDecor - sweepState.decorCount);
                for (let s = 0; s < batch; s++) {
                    algorithmFunc();
                }
                sweepsThisFrame += batch;
                sweepState.decorCount += batch;
                if (sweepState.decorCount >= sweepState.nDecor) {
                    sweepState.phase = "meas";
                    sweepState.decorCount = 0;
                }
            } else {
                // Run measurement sweeps
                let batch = Math.min(sweepState.batchSize, sweepState.nSweeps - sweepState.sweepCount);
                for (let s = 0; s < batch; s++) {
                    algorithmFunc();
                    // Store measurement values for binning
                    const idx = sweepState.tIndex;
                    sweepState.binData[idx].energy.push(ising.energy);
                    sweepState.binData[idx].magnetization.push(ising.magnetization);
                    sweepState.binData[idx].acceptance.push(ising.accepted / ising.attempted);
                    sweepState.binData[idx].energy2.push(ising.energy * ising.energy);
                    sweepState.binData[idx].magnetization2.push(ising.magnetization * ising.magnetization);
                }
                sweepsThisFrame += batch;
                sweepState.sweepCount += batch;
                // If finished sweeps for this temp, record and move to next
                if (sweepState.sweepCount >= sweepState.nSweeps) {
                    // Calculate mean and SEM using bin averages
                    function binStats(arr, nBins = 10) {
                        const binSize = Math.max(1, Math.floor(arr.length / nBins));
                        const bins = [];
                        for (let i = 0; i < arr.length; i += binSize) {
                            const bin = arr.slice(i, i + binSize);
                            if (bin.length > 0) {
                                const mean = bin.reduce((a, b) => a + b, 0) / bin.length;
                                bins.push(mean);
                            }
                        }
                        const mean = bins.reduce((a, b) => a + b, 0) / bins.length;
                        const variance = bins.reduce((a, b) => a + (b - mean) ** 2, 0) / bins.length;
                        const sem = Math.sqrt(variance / bins.length);
                        return { mean, sem };
                    }
                    const idx = sweepState.tIndex;
                    const eStats = binStats(sweepState.binData[idx].energy);
                    const mStats = binStats(sweepState.binData[idx].magnetization);
                    const aStats = binStats(sweepState.binData[idx].acceptance);
                    const e2Stats = binStats(sweepState.binData[idx].energy2);
                    const m2Stats = binStats(sweepState.binData[idx].magnetization2);
                    // Specific heat per site: C = (⟨E²⟩ - ⟨E⟩²) / (T²)
                    const tempVal = t;
                    const specificHeat = (e2Stats.mean - eStats.mean * eStats.mean) / (tempVal * tempVal);
                    // Magnetic susceptibility per site: χ = (⟨M²⟩ - ⟨M⟩²) / T
                    const susceptibility = (m2Stats.mean - mStats.mean * mStats.mean) / tempVal;
                    sweepState.results.push({
                        temp: t,
                        energy: eStats.mean,
                        energy_sem: eStats.sem,
                        magnetization: mStats.mean,
                        magnetization_sem: mStats.sem,
                        acceptance: aStats.mean,
                        acceptance_sem: aStats.sem,
                        energy2: e2Stats.mean,
                        energy2_sem: e2Stats.sem,
                        magnetization2: m2Stats.mean,
                        magnetization2_sem: m2Stats.sem,
                        specific_heat: specificHeat,
                        susceptibility: susceptibility
                    });
                    sweepState.tIndex++;
                    sweepState.sweepCount = 0;
                    sweepState.phase = "warmup";
                }
            }
        }
    } else {
        for (let sweep = 0; sweep < sweepsPerFrame; sweep++) {
            algorithmFunc();
        }
        sweepsThisFrame += sweepsPerFrame;
    }

    // Calculate sweeps per second
    const now = performance.now();
    if (!render.sweepCount) render.sweepCount = 0;
    render.sweepCount += sweepsThisFrame;
    sweepsHistory.push(render.sweepCount);
    timeHistory.push(now);
    // Keep only last 30 seconds of history - use index tracking instead of shift
    while (historyStartIndex < timeHistory.length && now - timeHistory[historyStartIndex] > 30000) {
        historyStartIndex++;
    }
    // Periodically clean up arrays when they get too large
    if (historyStartIndex > 1000) {
        timeHistory = timeHistory.slice(historyStartIndex);
        sweepsHistory = sweepsHistory.slice(historyStartIndex);
        historyStartIndex = 0;
    }
    // Trim energySamples and magnetizationSamples older than 30s
    while (energyStartIndex < energySamples.length && now - energySamples[energyStartIndex].t > 30000) {
        energyStartIndex++;
    }
    while (magnetizationStartIndex < magnetizationSamples.length && now - magnetizationSamples[magnetizationStartIndex].t > 30000) {
        magnetizationStartIndex++;
    }
    while (absMagnetizationStartIndex < absMagnetizationSamples.length && now - absMagnetizationSamples[absMagnetizationStartIndex].t > 30000) {
        absMagnetizationStartIndex++;
    }
    // Periodically clean up sample arrays
    if (energyStartIndex > 1000) {
        energySamples = energySamples.slice(energyStartIndex);
        energyStartIndex = 0;
    }
    if (magnetizationStartIndex > 1000) {
        magnetizationSamples = magnetizationSamples.slice(magnetizationStartIndex);
        magnetizationStartIndex = 0;
    }
    if (absMagnetizationStartIndex > 1000) {
        absMagnetizationSamples = absMagnetizationSamples.slice(absMagnetizationStartIndex);
        absMagnetizationStartIndex = 0;
    }
    if (timeHistory.length - historyStartIndex > 1) {
        const dt = (timeHistory[timeHistory.length - 1] - timeHistory[historyStartIndex]) / 1000;
        const dsweeps = sweepsHistory[sweepsHistory.length - 1] - sweepsHistory[historyStartIndex];
        const sweepsPerSecAvg = dsweeps / dt;
        sweepsPerSecValue.textContent = sweepsPerSecAvg.toFixed(1);
    }
    // If the buffer address or size changes (e.g., after lattice size change), recreate spins array
    const ptr = ising.spins_ptr;
    if (!spins || spins.buffer !== wasm.memory.buffer || spins.byteOffset !== ptr || spins.length !== n * n) {
        spins = new Int8Array(wasm.memory.buffer, ptr, n * n);
    }
    const buf32 = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < spins.length; i++) {
        buf32[i] = spins[i] === 1 ? 0xffffffff : 0xff000000; // white : black
    }
    ctx.putImageData(imageData, 0, 0);

    // Update plot value and history
    // Always calculate both <E> and <M>
    const energy = ising.energy;
    const magnetization = ising.magnetization;
    const acceptanceRatio = ising.accepted / ising.attempted;
    energyValue.textContent = energy.toFixed(4);
    magnetizationValue.textContent = (magnetization >= 0 ? "+" : "") + magnetization.toFixed(4);
    acceptanceRatioValue.textContent = acceptanceRatio.toFixed(4);
    // Record timestamped energy and magnetization samples
    energySamples.push({ t: now, e: energy });
    magnetizationSamples.push({ t: now, m: magnetization });
    absMagnetizationSamples.push({ t: now, absM: Math.abs(magnetization) });
    // Compute rolling average over energySamples (only valid samples)
    if (energySamples.length - energyStartIndex > 0) {
        let sum = 0;
        let count = 0;
        for (let i = energyStartIndex; i < energySamples.length; i++) {
            const v = energySamples[i].e;
            if (!Number.isFinite(v)) continue;
            sum += v;
            count++;
        }
        if (count > 0 && avgEnergy30sValue) {
            const avg = sum / count;
            avgEnergy30sValue.textContent = avg.toFixed(4);
        }
    }
    // Compute rolling average over magnetizationSamples (only valid samples)
    if (magnetizationSamples.length - magnetizationStartIndex > 0 && avgMagnetization30sValue) {
        let sumM = 0;
        let countM = 0;
        for (let i = magnetizationStartIndex; i < magnetizationSamples.length; i++) {
            const v = magnetizationSamples[i].m;
            if (!Number.isFinite(v)) continue;
            sumM += v;
            countM++;
        }
        if (countM > 0) {
            const avgM = sumM / countM;
            avgMagnetization30sValue.textContent = avgM.toFixed(4);
        }
    }
    // Compute rolling average over absMagnetizationSamples (only valid samples)
    if (absMagnetizationSamples.length - absMagnetizationStartIndex > 0 && avgAbsMagnetization30sValue) {
        let sumAbsM = 0;
        let countAbsM = 0;
        for (let i = absMagnetizationStartIndex; i < absMagnetizationSamples.length; i++) {
            const v = absMagnetizationSamples[i].absM;
            if (!Number.isFinite(v)) continue;
            sumAbsM += v;
            countAbsM++;
        }
        if (countAbsM > 0) {
            const avgAbsM = sumAbsM / countAbsM;
            avgAbsMagnetization30sValue.textContent = avgAbsM.toFixed(4);
        }
    }
    let value;
    if (plotType === "energy") {
        value = energy;
    } else if (plotType === "magnetization") {
        value = magnetization;
    } else if (plotType === "acceptance_ratio") {
        value = acceptanceRatio;
    } else if (plotType === "abs_magnetization") {
        value = Math.abs(magnetization);
    } else {
        value = 0;
    }
    if (plotType !== "no_plot") {
        // Plot selected value
        plotHistory.push(value);
        if (plotHistory.length > maxHistory) plotHistory.shift();

        // Draw plot using helper function
        drawPlotToCanvas(livePlotCtx, livePlot.width, livePlot.height);
        
        // Update modal if it's showing the plot
        if (expandedCanvasType === "plot") {
            drawPlotToCanvas(modalCtx, modalCanvas.width, modalCanvas.height);
        }
    }
    
    // Update modal if it's showing the simulation
    if (expandedCanvasType === "sim" && spins) {
        const modalImageData = modalCtx.createImageData(n, n);
        const data32 = new Uint32Array(modalImageData.data.buffer);
        for (let i = 0; i < n * n; i++) {
            data32[i] = spins[i] === 1 ? 0xFFFFFFFF : 0xFF000000;
        }
        modalCtx.putImageData(modalImageData, 0, 0);
    }
    
    // Always continue animation
    animationId = requestAnimationFrame(render);
}

run();