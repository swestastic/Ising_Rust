/**
 * sweeps.js
 * Handles temperature sweep functionality and data collection
 */

/**
 * Calculate binned statistics (mean and SEM)
 * @param {Array} arr - Array of values
 * @param {number} nBins - Number of bins
 * @returns {Object} - Object with mean and sem
 */
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

/**
 * Initialize temperature sweep controls
 * @param {Object} elements - DOM elements
 * @param {Object} params - Sweep parameters and callbacks
 * @returns {Object} - Sweep control functions
 */
export function initSweepControls(elements, params) {
    const { sweepTInit, sweepTFinal, sweepTStep, sweepNSweeps, 
            runSweepBtn, sweepNDecor, sweepNWarmup, downloadCsvBtn } = elements;
    
    let sweepState = null;
    let sweepRunning = false;

    // Download CSV button handler
    downloadCsvBtn.addEventListener("click", () => {
        if (!sweepState || !sweepState.results || sweepState.results.length === 0) return;
        let csv = "T,Energy,Energy_SEM,Magnetization,Magnetization_SEM,Acceptance,Acceptance_SEM,Energy2,Energy2_SEM,Magnetization2,Magnetization2_SEM,SpecificHeat,MagneticSusceptibility\n";
        for (const row of sweepState.results) {
            csv += `${row.temp},${row.energy},${row.energy_sem},${row.magnetization},${row.magnetization_sem},${row.acceptance},${row.acceptance_sem},${row.energy2},${row.energy2_sem},${row.magnetization2},${row.magnetization2_sem},${row.specific_heat},${row.susceptibility}\n`;
        }
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        let algoName = params.getAlgorithm();
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

    // Run sweep button handler
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
            batchSize: params.getSweepsPerFrame(),
            results: [],
            phase: "warmup",
            binData: tVals.map(() => ({ energy: [], magnetization: [], acceptance: [], energy2: [], magnetization2: [] }))
        };
        sweepRunning = true;
        runSweepBtn.textContent = "Stop T Sweep";
        runSweepBtn.disabled = false;
    });

    return {
        getSweepState: () => sweepState,
        setSweepState: (state) => { sweepState = state; },
        isSweepRunning: () => sweepRunning,
        setSweepRunning: (running) => { sweepRunning = running; },
        getSweepControls: () => ({ runSweepBtn, downloadCsvBtn })
    };
}

/**
 * Process sweep during animation frame
 * @param {Object} sweepState - Current sweep state
 * @param {Object} params - Parameters and callbacks
 * @returns {number} - Number of sweeps performed this frame
 */
export function processSweep(sweepState, params) {
    const { ising, algorithmFunc, tempSlider, tempValue, runSweepBtn, downloadCsvBtn } = params;
    let sweepsThisFrame = 0;

    if (!sweepState || !sweepState.active) {
        return sweepsThisFrame;
    }

    // If finished with all temps, end sweep
    if (sweepState.tIndex >= sweepState.tVals.length) {
        sweepState.active = false;
        params.setSweepRunning(false);
        runSweepBtn.textContent = "Run T Sweep";
        runSweepBtn.disabled = false;
        // Enable CSV download button
        downloadCsvBtn.disabled = false;
        downloadCsvBtn.style.background = "#2a7";
        downloadCsvBtn.style.color = "#fff";
        downloadCsvBtn.style.cursor = "pointer";
        console.log("Sweep results:", sweepState.results);
        alert("Sweep complete! See console for results.");
        return sweepsThisFrame;
    }

    // Set temp for this step
    let t = sweepState.tVals[sweepState.tIndex];
    ising.set_temp(t);
    params.setTemp(t);
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

    return sweepsThisFrame;
}

/**
 * Calculate sweeps per second
 * @param {Array} sweepsHistory - History of sweep counts
 * @param {Array} timeHistory - History of timestamps
 * @param {number} historyStartIndex - Start index for history
 * @returns {number} - Sweeps per second
 */
export function calculateSweepsPerSecond(sweepsHistory, timeHistory, historyStartIndex) {
    if (timeHistory.length - historyStartIndex > 1) {
        const dt = (timeHistory[timeHistory.length - 1] - timeHistory[historyStartIndex]) / 1000;
        const dsweeps = sweepsHistory[sweepsHistory.length - 1] - sweepsHistory[historyStartIndex];
        return dsweeps / dt;
    }
    return 0;
}
