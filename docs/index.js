
import init, { Ising } from "./pkg/ising_gui_rust.js";

let wasm;
let ising;
let n = 100; // default lattice size
let temp = 2.0;
let j = 1.0;
let h = 0.0;
let canvas, ctx, imageData;
let spins = null;
let animationId;
let algorithm = "metropolis";
let sweepsPerFrame = 1;
let plotLabel, plotTypeDropdown, energyValue, magnetizationValue, acceptanceRatioValue, sweepsPerSecValue, livePlot, livePlotCtx;
let plotHistory = [];
const maxHistory = 400;
let plotType = "energy";

async function run() {
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
    plotTypeDropdown.addEventListener("change", () => {
        plotType = plotTypeDropdown.value;
        plotHistory = [];
    });
    livePlot = document.getElementById("live-plot");
    livePlotCtx = livePlot.getContext("2d");

    setupIsing(n);

    // Slider for temperature
    const tempSlider = document.getElementById("temp-slider");
    const tempValue = document.getElementById("temp-value");
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
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });

    // Sweeps per frame slider
    const skipSlider = document.getElementById("skip-slider");
    const skipValue = document.getElementById("skip-value");
    skipSlider.addEventListener("input", () => {
        sweepsPerFrame = parseInt(skipSlider.value);
        skipValue.textContent = sweepsPerFrame;
    });
    skipValue.textContent = sweepsPerFrame;

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
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        render();
    });

    const resetDataBtn = document.getElementById("reset-data-btn");
    resetDataBtn.addEventListener("click", () => {
        plotHistory = [];
        lastTime = performance.now();
        lastSweepCount = 0;
        render.sweepCount = 0;
        sweepsHistory = [];
        timeHistory = [];
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
    const ptr = ising.spins_ptr();
    spins = new Int8Array(wasm.memory.buffer, ptr, size * size);
}

let lastTime = performance.now();
let lastSweepCount = 0;
let sweepsHistory = [];
let timeHistory = [];

function render() {
    // No scaling needed for square aspect ratio, use default transform
    livePlotCtx.setTransform(1, 0, 0, 1, 0, 0);
    for (let sweep = 0; sweep < sweepsPerFrame; sweep++) {
        if (algorithm === "metropolis") {
            ising.metropolis_step();
        } else if (algorithm === "wolff") {
            ising.wolff_step();
        } else if (algorithm === "swendsen-wang") {
            ising.swendsen_wang_step();
        } else if (algorithm === "heat-bath") {
            ising.heatbath_step();
        } else if (algorithm === "glauber") {
            ising.glauber_step();
        } else if (algorithm === "kawasaki") {
            ising.kawasaki_step();
        }
    }

    // Calculate sweeps per second
    const now = performance.now();
    if (!render.sweepCount) render.sweepCount = 0;
    render.sweepCount += sweepsPerFrame;
    sweepsHistory.push(render.sweepCount);
    timeHistory.push(now);
    // Keep only last 30 seconds of history
    while (timeHistory.length > 0 && now - timeHistory[0] > 30000) {
        timeHistory.shift();
        sweepsHistory.shift();
    }
    if (timeHistory.length > 1) {
        const dt = (timeHistory[timeHistory.length - 1] - timeHistory[0]) / 1000;
        const dsweeps = sweepsHistory[sweepsHistory.length - 1] - sweepsHistory[0];
        const sweepsPerSecAvg = dsweeps / dt;
        sweepsPerSecValue.textContent = sweepsPerSecAvg.toFixed(1);
    }
    // If the buffer address or size changes (e.g., after lattice size change), recreate spins array
    const ptr = ising.spins_ptr();
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
    const energy = ising.energy();
    const magnetization = ising.magnetization();
    energyValue.textContent = energy.toFixed(4);
    magnetizationValue.textContent = (magnetization >= 0 ? "+" : "") + magnetization.toFixed(4);
    acceptanceRatioValue.textContent = ising.acceptance_ratio().toFixed(4);
    let value;
    if (plotType === "energy") {
        value = energy;
    } else if (plotType === "magnetization") {
        value = magnetization;
    } else if (plotType === "acceptance_ratio") {
        value = ising.acceptance_ratio();
    } else {
        value = 0;
    }
    if (plotType !== "no_plot") {
        // Plot selected value
        plotHistory.push(value);
        if (plotHistory.length > maxHistory) plotHistory.shift();

        // Draw plot with axes and labels
        livePlotCtx.clearRect(0, 0, livePlot.width, livePlot.height);
        // Axes
        livePlotCtx.strokeStyle = "#aaa";
        livePlotCtx.lineWidth = 1;
        livePlotCtx.beginPath();
        // Y axis
        livePlotCtx.moveTo(40, 10);
        livePlotCtx.lineTo(40, livePlot.height - 20);
        // X axis
        livePlotCtx.moveTo(40, livePlot.height - 20);
        livePlotCtx.lineTo(livePlot.width - 10, livePlot.height - 20);
        livePlotCtx.stroke();

        // Y labels
        livePlotCtx.save();
        livePlotCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset any transforms
        livePlotCtx.fillStyle = "#fff";
        livePlotCtx.font = "12px Arial";
        livePlotCtx.textAlign = "right";
        if (plotType === "energy") {
            const ymin = -2 * Math.abs(j) - Math.abs(h);
            const ymax = 2 * Math.abs(j) + Math.abs(h);
            livePlotCtx.fillText(ymin.toFixed(2), 35, livePlot.height - 20);
            livePlotCtx.fillText("0", 35, livePlot.height / 2 + 5);
            livePlotCtx.fillText(ymax.toFixed(2), 35, 20);
        } else {
            livePlotCtx.fillText("-1", 35, livePlot.height - 20);
            livePlotCtx.fillText("0", 35, livePlot.height / 2 + 5);
            livePlotCtx.fillText("1", 35, 20);
        }
        // X label
        livePlotCtx.textAlign = "center";
        livePlotCtx.font = "14px Arial";
        livePlotCtx.fillText("Frame", livePlot.width / 2, livePlot.height - 2);
        // Y axis label
        livePlotCtx.save();
        livePlotCtx.translate(10, livePlot.height / 2);
        livePlotCtx.rotate(-Math.PI / 2);
        livePlotCtx.textAlign = "center";
        livePlotCtx.font = "14px Arial";
        if (plotType === "acceptance_ratio") {
            livePlotCtx.fillText("Acceptance Ratio", 0, 0);
        } else if (plotType === "magnetization") {
            livePlotCtx.fillText("Magnetization", 0, 0);
        } else if (plotType === "energy") {
            livePlotCtx.fillText("Energy", 0, 0);
        }
        livePlotCtx.restore();

        // Plot line
        livePlotCtx.beginPath();
        livePlotCtx.strokeStyle = "#00ff00";
        livePlotCtx.lineWidth = 2;
        let yMin, yMax;
        if (plotType === "energy") {
            yMin = -2 * Math.abs(j) - Math.abs(h);
            yMax = 2 * Math.abs(j) + Math.abs(h);
        } else {
            yMin = -1;
            yMax = 1;
        }
        // Map y values so that yMin maps to (livePlot.height - 20) and yMax maps to 20
        const plotTop = 20;
        const plotBottom = livePlot.height - 20;
        for (let i = 0; i < plotHistory.length; i++) {
            const x = 40 + ((livePlot.width - 50) * i) / maxHistory;
            let y = plotBottom - ((plotHistory[i] - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
            if (i === 0) {
                livePlotCtx.moveTo(x, y);
            } else {
                livePlotCtx.lineTo(x, y);
            }
        }
        livePlotCtx.stroke();
    }
    // Always continue animation
    animationId = requestAnimationFrame(render);
}

run();