
import init, { Ising } from "./pkg/ising_gui_rust.js";

let wasm;
let ising;
let n = 100; // default lattice size
let temp = 2.0;
let j = 1.0;
let h = 0.0;
let canvas, ctx, imageData, pixels;
let animationId;
let algorithm = "metropolis";
let sweepsPerFrame = 1;
let plotLabel, plotTypeDropdown, energyValue, magnetizationValue, acceptanceRatioValue, sweepsPerSecValue, energyPlot, energyPlotCtx;
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
    energyPlot = document.getElementById("energy-plot");
    energyPlotCtx = energyPlot.getContext("2d");

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
    pixels = imageData.data;
}

let lastTime = performance.now();
let lastSweepCount = 0;

function render() {
    // No scaling needed for square aspect ratio, use default transform
    energyPlotCtx.setTransform(1, 0, 0, 1, 0, 0);
    for (let sweep = 0; sweep < sweepsPerFrame; sweep++) {
        if (algorithm === "metropolis") {
            ising.metropolis_step();
        } else if (algorithm === "wolff") {
            ising.wolff_step();
        } else if (algorithm === "swendsen-wang") {
            ising.swendsen_wang_step();
        } else if (algorithm === "heat-bath") {
            ising.heat_bath_step();
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
    if (now - lastTime > 1000) {
        const sweepsPerSec = (render.sweepCount - lastSweepCount) / ((now - lastTime) / 1000);
        sweepsPerSecValue.textContent = sweepsPerSec.toFixed(1);
        lastTime = now;
        lastSweepCount = render.sweepCount;
    }
    const ptr = ising.spins_ptr();
    const spins = new Int8Array(wasm.memory.buffer, ptr, n * n);
    for (let i = 0; i < spins.length; i++) {
        const color = spins[i] === 1 ? 255 : 0;
        const j = i * 4;
        pixels[j] = color;
        pixels[j + 1] = color;
        pixels[j + 2] = color;
        pixels[j + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Update plot value and history
    // Always calculate both <E> and <M>
    const energy = ising.avg_energy();
    let sum = 0;
    for (let i = 0; i < spins.length; i++) sum += spins[i];
    const magnetization = sum / spins.length;
    energyValue.textContent = energy.toFixed(4);
    magnetizationValue.textContent = (magnetization >= 0 ? "+" : "") + magnetization.toFixed(4);
    acceptanceRatioValue.textContent = ising.acceptance_ratio().toFixed(4);

    // Plot selected value
    let value = plotType === "energy" ? energy : magnetization;
    plotHistory.push(value);
    if (plotHistory.length > maxHistory) plotHistory.shift();

    // Draw plot with axes and labels
    energyPlotCtx.clearRect(0, 0, energyPlot.width, energyPlot.height);
    // Axes
    energyPlotCtx.strokeStyle = "#aaa";
    energyPlotCtx.lineWidth = 1;
    energyPlotCtx.beginPath();
    // Y axis
    energyPlotCtx.moveTo(40, 10);
    energyPlotCtx.lineTo(40, energyPlot.height - 20);
    // X axis
    energyPlotCtx.moveTo(40, energyPlot.height - 20);
    energyPlotCtx.lineTo(energyPlot.width - 10, energyPlot.height - 20);
    energyPlotCtx.stroke();

    // Y labels
    energyPlotCtx.save();
    energyPlotCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset any transforms
    energyPlotCtx.fillStyle = "#fff";
    energyPlotCtx.font = "12px Arial";
    energyPlotCtx.textAlign = "right";
    if (plotType === "energy") {
        const ymin = -2 * Math.abs(j);
        const ymax = 2 * Math.abs(j);
        energyPlotCtx.fillText(ymin.toFixed(2), 35, energyPlot.height - 20);
        energyPlotCtx.fillText("0", 35, energyPlot.height / 2 + 5);
        energyPlotCtx.fillText(ymax.toFixed(2), 35, 20);
    } else {
        energyPlotCtx.fillText("-1", 35, energyPlot.height - 20);
        energyPlotCtx.fillText("0", 35, energyPlot.height / 2 + 5);
        energyPlotCtx.fillText("1", 35, 20);
    }
    // X label
    energyPlotCtx.textAlign = "center";
    energyPlotCtx.font = "14px Arial";
    energyPlotCtx.fillText("Frame", energyPlot.width / 2, energyPlot.height - 2);
    // Y axis label
    energyPlotCtx.save();
    energyPlotCtx.translate(10, energyPlot.height / 2);
    energyPlotCtx.rotate(-Math.PI / 2);
    energyPlotCtx.textAlign = "center";
    energyPlotCtx.font = "14px Arial";
    energyPlotCtx.fillText(plotType === "energy" ? "Energy" : "Magnetization", 0, 0);
    energyPlotCtx.restore();
    energyPlotCtx.restore();

    // Plot line
    energyPlotCtx.beginPath();
    energyPlotCtx.strokeStyle = "#00ff00";
    energyPlotCtx.lineWidth = 2;
    let yMin, yMax;
    if (plotType === "energy") {
        yMin = -2 * Math.abs(j);
        yMax = 2 * Math.abs(j);
    } else {
        yMin = -1;
        yMax = 1;
    }
    // Map y values so that yMin maps to (energyPlot.height - 20) and yMax maps to 20
    const plotTop = 20;
    const plotBottom = energyPlot.height - 20;
    for (let i = 0; i < plotHistory.length; i++) {
        const x = 40 + ((energyPlot.width - 50) * i) / maxHistory;
        let y = plotBottom - ((plotHistory[i] - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
        if (i === 0) {
            energyPlotCtx.moveTo(x, y);
        } else {
            energyPlotCtx.lineTo(x, y);
        }
    }
    energyPlotCtx.stroke();

    animationId = requestAnimationFrame(render);
}

run();