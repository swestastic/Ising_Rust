/**
 * colors.js
 * Handles color mapping for spin visualization
 */

/**
 * Render the simulation canvas with current spin state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {ImageData} imageData - Image data buffer
 * @param {Int8Array} spins - Spin array from WASM
 */
export function renderSpins(ctx, imageData, spins) {
    const buf32 = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < spins.length; i++) {
        buf32[i] = spins[i] === 1 ? 0xffffffff : 0xff000000; // white : black
    }
    ctx.putImageData(imageData, 0, 0);
}

/**
 * Update modal canvas with current spin state
 * @param {CanvasRenderingContext2D} modalCtx - Modal canvas context
 * @param {Int8Array} spins - Spin array
 * @param {number} n - Lattice size
 */
export function updateModalSpins(modalCtx, spins, n) {
    const modalImageData = modalCtx.createImageData(n, n);
    const data32 = new Uint32Array(modalImageData.data.buffer);
    for (let i = 0; i < n * n; i++) {
        data32[i] = spins[i] === 1 ? 0xFFFFFFFF : 0xFF000000;
    }
    modalCtx.putImageData(modalImageData, 0, 0);
}
