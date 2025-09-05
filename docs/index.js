
import init, { Ising } from "./pkg/ising_gui_rust.js";

let wasm;
let ising;
let n = 100; // default lattice size
let temp = 2.0;
let j = 1.0;
let canvas, ctx, imageData, pixels;
let animationId;

async function run() {
    wasm = await init();

    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    setupIsing(n);

    // Slider for temperature
    const tempSlider = document.getElementById("temp-slider");
    const tempValue = document.getElementById("temp-value");
    tempSlider.addEventListener("input", () => {
        temp = parseFloat(tempSlider.value);
        tempValue.textContent = temp.toFixed(2);
        ising.set_temp(temp);
    });

    // Slider for coupling constant J
    const jSlider = document.getElementById("j-slider");
    const jValue = document.getElementById("j-value");
    jSlider.addEventListener("input", () => {
        j = parseFloat(jSlider.value);
        jValue.textContent = j.toFixed(2);
        ising.set_j(j);
    });

    // Dropdown for lattice size
    const latticeDropdown = document.getElementById("lattice-size");
    latticeDropdown.addEventListener("change", () => {
        n = parseInt(latticeDropdown.value);
        setupIsing(n);
    });

    render();
}

function setupIsing(size) {
    ising = new Ising(size, temp, j);
    canvas.width = size;
    canvas.height = size;
    // Scale the canvas display 3x larger
    canvas.style.width = (size * 3) + "px";
    canvas.style.height = (size * 3) + "px";
    ctx = canvas.getContext("2d");
    imageData = ctx.createImageData(size, size);
    pixels = imageData.data;
}

function render() {
    ising.step();
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
    animationId = requestAnimationFrame(render);
}

run();