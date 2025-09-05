import init, { Ising } from "./pkg/ising_gui_rust.js";

let wasm;
async function run() {
    wasm = await init();

    const n = 100; // lattice size
    let temp = 2.0;
    let j = 1.0;
    const ising = new Ising(n, temp, j);

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

    const canvas = document.getElementById("canvas");
    canvas.width = n;
    canvas.height = n;
    // Scale the canvas display 3x larger
    canvas.style.width = (n * 3) + "px";
    canvas.style.height = (n * 3) + "px";
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(n, n);
    const pixels = imageData.data;

    function render() {
        ising.step();

        const ptr = ising.spins_ptr();
        const spins = new Int8Array(wasm.memory.buffer, ptr, n * n);

        for (let i = 0; i < spins.length; i++) {
            const color = spins[i] === 1 ? 255 : 0; // white for +1, black for -1
            const j = i * 4;
            pixels[j] = color;
            pixels[j + 1] = color;
            pixels[j + 2] = color;
            pixels[j + 3] = 255; // alpha
        }

        ctx.putImageData(imageData, 0, 0);
        requestAnimationFrame(render);
    }

    render();
}

run();