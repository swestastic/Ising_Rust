# Ising Model Simulation - Modules Documentation

This directory contains modular JavaScript files for the Ising Model simulation.

## Module Structure

### colors.js

Handles color mapping and rendering for spin visualization.

**Exports:**

- `renderSpins(ctx, imageData, spins)` - Renders spins to the main canvas
- `updateModalSpins(modalCtx, spins, n)` - Updates the modal canvas with current spins

**Responsibilities:**

- Converting spin values (+1/-1) to colors (white/black)
- Rendering to both main and modal canvases
- Managing ImageData buffers

---

### modal.js

Manages the modal dialog for expanded canvas views.

**Exports:**

- `initModal(refs)` - Initializes modal functionality and returns control functions

**Returned Functions:**

- `getExpandedCanvasType()` - Returns current expanded canvas type ('sim' or 'plot')
- `openModal(canvasType)` - Opens modal with specified canvas type
- `closeModal()` - Closes the modal

**Responsibilities:**

- Opening/closing modal dialogs
- Handling click events on canvases
- Sizing modal content appropriately
- Managing expanded view state

---

### plotting.js

Handles all plotting functionality including live plots and statistical displays.

**Exports:**

- `drawPlotToCanvas(ctx, width, height, plotHistory, plotType, maxHistory, j, h)` - Draws plot to canvas
- `updateRollingAverages(samples, indices, valueElements)` - Updates 30s rolling averages
- `trimOldSamples(samples, indices)` - Removes samples older than 30 seconds
- `cleanupSampleArrays(samples, indices)` - Cleans up large arrays

**Responsibilities:**

- Drawing energy, magnetization, and acceptance ratio plots
- Managing plot history and axes
- Calculating and displaying rolling averages
- Memory management for sample arrays

---

### sweeps.js

Handles temperature sweep functionality and data collection.

**Exports:**

- `initSweepControls(elements, params)` - Initializes sweep controls
- `processSweep(sweepState, params)` - Processes sweep during animation frame
- `calculateSweepsPerSecond(sweepsHistory, timeHistory, historyStartIndex)` - Calculates performance metric

**Returned Functions (from initSweepControls):**

- `getSweepState()` - Returns current sweep state
- `setSweepState(state)` - Updates sweep state
- `isSweepRunning()` - Returns sweep running status
- `setSweepRunning(running)` - Updates sweep running status
- `getSweepControls()` - Returns DOM element references

**Responsibilities:**

- Managing temperature sweep state
- Running warmup, decorrelation, and measurement phases
- Calculating binned statistics (mean, SEM)
- Computing specific heat and magnetic susceptibility
- Generating CSV output
- Performance monitoring

---

## Data Flow

1. **index.js** (main file)
   - Imports all modules
   - Initializes WASM
   - Sets up Ising model instance
   - Coordinates between modules
   - Runs main render loop

2. **Modules** (specialized functions)
   - Each module handles a specific aspect of the simulation
   - Modules communicate through shared state and callbacks
   - Pure functions where possible for easier testing

## Usage Example

```javascript
import { renderSpins } from './modules/colors.js';
import { initModal } from './modules/modal.js';
import { drawPlotToCanvas, updateRollingAverages } from './modules/plotting.js';
import { initSweepControls, processSweep } from './modules/sweeps.js';

// In render loop
renderSpins(ctx, imageData, spins);
drawPlotToCanvas(livePlotCtx, livePlot.width, livePlot.height, plotHistory, plotType, maxHistory, j, h);
updateRollingAverages(samples, indices, valueElements);
```

## Benefits of Modular Structure

- **Maintainability**: Each module has a clear, focused responsibility
- **Testability**: Pure functions can be tested in isolation
- **Readability**: Easier to understand and navigate codebase
- **Reusability**: Modules can be reused across different projects
- **Collaboration**: Multiple developers can work on different modules
