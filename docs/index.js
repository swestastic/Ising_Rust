import init, { Ising } from "./pkg/ising_gui_rust.js";
import { renderSpins, updateModalSpins } from "./modules/colors.js";
import { initModal } from "./modules/modal.js";
import { drawPlotToCanvas, updateRollingAverages, trimOldSamples, cleanupSampleArrays } from "./modules/plotting.js";
import { initSweepControls, processSweep, calculateSweepsPerSecond } from "./modules/sweeps.js";

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
let canvasModal, modalCanvas, modalCtx;
let modalControl = null;
// Top-level references for temperature controls
let tempSlider = null;
let tempValue = null;
// Sweep controls
let sweepControl = null;

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

    // Initialize sweep controls
    const sweepElements = {
        sweepTInit: document.getElementById("sweep-t-init"),
        sweepTFinal: document.getElementById("sweep-t-final"),
        sweepTStep: document.getElementById("sweep-t-step"),
        sweepNSweeps: document.getElementById("sweep-n-sweeps"),
        runSweepBtn: document.getElementById("run-sweep-btn"),
        sweepNDecor: document.getElementById("sweep-n-decor"),
        sweepNWarmup: document.getElementById("sweep-n-warmup"),
        downloadCsvBtn: document.getElementById("download-csv-btn")
    };

    sweepControl = initSweepControls(sweepElements, {
        getAlgorithm: () => algorithm,
        getSweepsPerFrame: () => sweepsPerFrame
    });

    // Initialize download button state
    const downloadCsvBtn = sweepElements.downloadCsvBtn;
    downloadCsvBtn.disabled = true;
    downloadCsvBtn.style.background = "#444";
    downloadCsvBtn.style.color = "#ccc";
    downloadCsvBtn.style.cursor = "not-allowed";

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
        const sweepState = sweepControl?.getSweepState();
        if (sweepState && sweepState.active) {
            sweepState.batchSize = sweepsPerFrame;
        }
    });
    skipInput.value = sweepsPerFrame;

    // Initialize modal
    canvasModal = document.getElementById("canvas-modal");
    modalCanvas = document.getElementById("modal-canvas");
    modalCtx = modalCanvas.getContext("2d");
    
    modalControl = initModal({
        canvasModal,
        modalCanvas,
        modalCtx,
        canvas,
        livePlot,
        drawPlotToCanvas: (ctx, width, height) => {
            drawPlotToCanvas(ctx, width, height, plotHistory, plotType, maxHistory, j, h);
        },
        getN: () => n,
        getSpins: () => spins
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

function render() {
    livePlotCtx.setTransform(1, 0, 0, 1, 0, 0);
    let sweepsThisFrame = 0;

    // Process sweep if active
    const sweepState = sweepControl.getSweepState();
    const sweepControls = sweepControl.getSweepControls();
    
    if (sweepState && sweepState.active) {
        sweepsThisFrame = processSweep(sweepState, {
            ising,
            algorithmFunc,
            tempSlider,
            tempValue,
            runSweepBtn: sweepControls.runSweepBtn,
            downloadCsvBtn: sweepControls.downloadCsvBtn,
            setTemp: (t) => { temp = t; },
            setSweepRunning: sweepControl.setSweepRunning
        });
    } else {
        for (let sweep = 0; sweep < sweepsPerFrame; sweep++) {
            algorithmFunc();
        }
        sweepsThisFrame += sweepsPerFrame;
    }

    // Update performance tracking
    const now = performance.now();
    if (!render.sweepCount) render.sweepCount = 0;
    render.sweepCount += sweepsThisFrame;
    sweepsHistory.push(render.sweepCount);
    timeHistory.push(now);

    // Trim old history (30 seconds)
    while (historyStartIndex < timeHistory.length && now - timeHistory[historyStartIndex] > 30000) {
        historyStartIndex++;
    }
    if (historyStartIndex > 1000) {
        timeHistory = timeHistory.slice(historyStartIndex);
        sweepsHistory = sweepsHistory.slice(historyStartIndex);
        historyStartIndex = 0;
    }

    // Trim sample arrays
    const newIndices = trimOldSamples(
        { energy: energySamples, magnetization: magnetizationSamples, absMagnetization: absMagnetizationSamples },
        { energy: energyStartIndex, magnetization: magnetizationStartIndex, absMagnetization: absMagnetizationStartIndex }
    );
    energyStartIndex = newIndices.energy;
    magnetizationStartIndex = newIndices.magnetization;
    absMagnetizationStartIndex = newIndices.absMagnetization;

    // Cleanup large arrays
    const cleaned = cleanupSampleArrays(
        { energy: energySamples, magnetization: magnetizationSamples, absMagnetization: absMagnetizationSamples },
        { energy: energyStartIndex, magnetization: magnetizationStartIndex, absMagnetization: absMagnetizationStartIndex }
    );
    energySamples = cleaned.samples.energy;
    magnetizationSamples = cleaned.samples.magnetization;
    absMagnetizationSamples = cleaned.samples.absMagnetization;
    energyStartIndex = cleaned.indices.energy;
    magnetizationStartIndex = cleaned.indices.magnetization;
    absMagnetizationStartIndex = cleaned.indices.absMagnetization;

    // Calculate sweeps per second
    const sweepsPerSec = calculateSweepsPerSecond(sweepsHistory, timeHistory, historyStartIndex);
    if (sweepsPerSec > 0) {
        sweepsPerSecValue.textContent = sweepsPerSec.toFixed(1);
    }

    // Update spins buffer if needed
    const ptr = ising.spins_ptr;
    if (!spins || spins.buffer !== wasm.memory.buffer || spins.byteOffset !== ptr || spins.length !== n * n) {
        spins = new Int8Array(wasm.memory.buffer, ptr, n * n);
    }
    
    // Render spins
    renderSpins(ctx, imageData, spins);
    ctx.putImageData(imageData, 0, 0);

    // Update plot value and history
    const energy = ising.energy;
    const magnetization = ising.magnetization;
    const acceptanceRatio = ising.accepted / ising.attempted;
    energyValue.textContent = energy.toFixed(4);
    magnetizationValue.textContent = (magnetization >= 0 ? "+" : "") + magnetization.toFixed(4);
    acceptanceRatioValue.textContent = acceptanceRatio.toFixed(4);
    
    // Record timestamped samples
    energySamples.push({ t: now, e: energy });
    magnetizationSamples.push({ t: now, m: magnetization });
    absMagnetizationSamples.push({ t: now, absM: Math.abs(magnetization) });
    
    // Update rolling averages
    updateRollingAverages(
        { energy: energySamples, magnetization: magnetizationSamples, absMagnetization: absMagnetizationSamples },
        { energy: energyStartIndex, magnetization: magnetizationStartIndex, absMagnetization: absMagnetizationStartIndex },
        { avgEnergy: avgEnergy30sValue, avgMagnetization: avgMagnetization30sValue, avgAbsMagnetization: avgAbsMagnetization30sValue }
    );
    
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
        plotHistory.push(value);
        if (plotHistory.length > maxHistory) plotHistory.shift();

        // Draw plot to live canvas
        drawPlotToCanvas(livePlotCtx, livePlot.width, livePlot.height, plotHistory, plotType, maxHistory, j, h);
        
        // Update modal if showing plot
        const expandedType = modalControl.getExpandedCanvasType();
        if (expandedType === "plot") {
            drawPlotToCanvas(modalCtx, modalCanvas.width, modalCanvas.height, plotHistory, plotType, maxHistory, j, h);
        }
    }
    
    // Update modal if showing simulation
    if (modalControl.getExpandedCanvasType() === "sim" && spins) {
        updateModalSpins(modalCtx, spins, n);
    }
    
    // Always continue animation
    animationId = requestAnimationFrame(render);
}

run();