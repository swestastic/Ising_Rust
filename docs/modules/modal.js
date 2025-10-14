/**
 * modal.js
 * Handles modal dialog for expanded canvas views
 */

/**
 * Initialize modal functionality
 * @param {Object} refs - Object containing DOM references
 * @returns {Object} - Object with modal control functions
 */
export function initModal(refs) {
    const { canvasModal, modalCanvas, modalCtx, canvas, livePlot, drawPlotToCanvas } = refs;
    let expandedCanvasType = null;

    function openModal(canvasType) {
        expandedCanvasType = canvasType;
        canvasModal.classList.add("active");
        
        // Set modal canvas size to be larger (80% of viewport)
        const maxSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8);
        
        if (canvasType === "sim") {
            // For simulation canvas, match the aspect ratio of the lattice
            const n = refs.getN();
            const spins = refs.getSpins();
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
    const modalClose = canvasModal.querySelector(".modal-close");
    modalClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeModal();
    });
    
    // Prevent closing when clicking on the canvas itself
    modalCanvas.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    return {
        getExpandedCanvasType: () => expandedCanvasType,
        openModal,
        closeModal
    };
}
