/**
 * plotting.js
 * Handles all plotting functionality including live plots and statistical displays
 */

/**
 * Draw plot to any canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Array} plotHistory - Array of plot values
 * @param {string} plotType - Type of plot (energy, magnetization, etc.)
 * @param {number} maxHistory - Maximum history length
 * @param {number} j - Coupling constant
 * @param {number} h - External field
 */
export function drawPlotToCanvas(ctx, width, height, plotHistory, plotType, maxHistory, j, h) {
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

/**
 * Update rolling averages display
 * @param {Object} samples - Object containing sample arrays
 * @param {Object} indices - Object containing start indices
 * @param {Object} valueElements - DOM elements to update
 */
export function updateRollingAverages(samples, indices, valueElements) {
    const now = performance.now();
    
    // Update energy average
    if (samples.energy.length - indices.energy > 0) {
        let sum = 0;
        let count = 0;
        for (let i = indices.energy; i < samples.energy.length; i++) {
            const v = samples.energy[i].e;
            if (!Number.isFinite(v)) continue;
            sum += v;
            count++;
        }
        if (count > 0 && valueElements.avgEnergy) {
            const avg = sum / count;
            valueElements.avgEnergy.textContent = avg.toFixed(4);
        }
    }
    
    // Update magnetization average
    if (samples.magnetization.length - indices.magnetization > 0 && valueElements.avgMagnetization) {
        let sumM = 0;
        let countM = 0;
        for (let i = indices.magnetization; i < samples.magnetization.length; i++) {
            const v = samples.magnetization[i].m;
            if (!Number.isFinite(v)) continue;
            sumM += v;
            countM++;
        }
        if (countM > 0) {
            const avgM = sumM / countM;
            valueElements.avgMagnetization.textContent = avgM.toFixed(4);
        }
    }
    
    // Update absolute magnetization average
    if (samples.absMagnetization.length - indices.absMagnetization > 0 && valueElements.avgAbsMagnetization) {
        let sumAbsM = 0;
        let countAbsM = 0;
        for (let i = indices.absMagnetization; i < samples.absMagnetization.length; i++) {
            const v = samples.absMagnetization[i].absM;
            if (!Number.isFinite(v)) continue;
            sumAbsM += v;
            countAbsM++;
        }
        if (countAbsM > 0) {
            const avgAbsM = sumAbsM / countAbsM;
            valueElements.avgAbsMagnetization.textContent = avgAbsM.toFixed(4);
        }
    }
}

/**
 * Trim old samples beyond 30 second window
 * @param {Object} samples - Sample arrays
 * @param {Object} indices - Start indices
 * @returns {Object} - Updated indices
 */
export function trimOldSamples(samples, indices) {
    const now = performance.now();
    const newIndices = { ...indices };
    
    // Trim energy samples
    while (newIndices.energy < samples.energy.length && 
           now - samples.energy[newIndices.energy].t > 30000) {
        newIndices.energy++;
    }
    
    // Trim magnetization samples
    while (newIndices.magnetization < samples.magnetization.length && 
           now - samples.magnetization[newIndices.magnetization].t > 30000) {
        newIndices.magnetization++;
    }
    
    // Trim absolute magnetization samples
    while (newIndices.absMagnetization < samples.absMagnetization.length && 
           now - samples.absMagnetization[newIndices.absMagnetization].t > 30000) {
        newIndices.absMagnetization++;
    }
    
    return newIndices;
}

/**
 * Clean up sample arrays when they get too large
 * @param {Object} samples - Sample arrays
 * @param {Object} indices - Start indices
 * @returns {Object} - Object with cleaned samples and reset indices
 */
export function cleanupSampleArrays(samples, indices) {
    const newSamples = { ...samples };
    const newIndices = { ...indices };
    
    if (indices.energy > 1000) {
        newSamples.energy = samples.energy.slice(indices.energy);
        newIndices.energy = 0;
    }
    if (indices.magnetization > 1000) {
        newSamples.magnetization = samples.magnetization.slice(indices.magnetization);
        newIndices.magnetization = 0;
    }
    if (indices.absMagnetization > 1000) {
        newSamples.absMagnetization = samples.absMagnetization.slice(indices.absMagnetization);
        newIndices.absMagnetization = 0;
    }
    
    return { samples: newSamples, indices: newIndices };
}
