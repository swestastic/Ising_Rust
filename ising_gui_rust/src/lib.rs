use wasm_bindgen::prelude::*;
use rand::Rng;
use rand::SeedableRng;
use rand::rngs::SmallRng;

// Standalone function to calculate average energy per spin
fn calc_avg_energy(spins: &[i8], n: usize, j: f64, h: f64) -> f64 {
    let mut e = 0.0;
    for i in 0..n {
        for j_idx in 0..n {
            let idx = i * n + j_idx;
            let s = spins[idx] as f64;
            // bonds right and down to avoid double count
            e -= j * s * spins[((i + 1) % n) * n + j_idx] as f64;
            e -= j * s * spins[i * n + ((j_idx + 1) % n)] as f64;
            // field term
            e -= h * s;
        }
    }
    e / (n * n) as f64
}

// Standalone function to calculate average magnetization per spin
fn calc_avg_magnetization(spins: &[i8], n: usize) -> f64 {
    let sum: i32 = spins.iter().map(|&s| s as i32).sum();
    sum as f64 / (n * n) as f64
}

#[wasm_bindgen]
pub struct Ising {
    n: usize,
    spins: Vec<i8>,
    temp: f64,
    j: f64,
    h: f64,
    accepted: usize,
    attempted: usize,
    rng: SmallRng,
    energy: f64,
    magnetization: f64,
}

#[wasm_bindgen]
impl Ising {

    // Create a new Ising model with random spins
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, temp: f64, j: f64) -> Self {
        let mut rng = SmallRng::from_entropy();
        let spins: Vec<i8> = (0..n * n)
            .map(|_| if rng.gen_range(0.0..1.0) > 0.5 { 1 } else { -1 })
            .collect();
        // Calculate initial energy using standalone function
        let e = calc_avg_energy(&spins, n, j, 0.0);
        let m = calc_avg_magnetization(&spins, n);
        Self { n, spins, temp, j, h: 0.0, accepted: 0, attempted: 0, rng, energy: e, magnetization: m }
    }

    // Perform a single Metropolis-Hastings update
    #[wasm_bindgen]
    pub fn metropolis_step(&mut self) {
        self.attempted += self.n * self.n; // Each step attempts n*n flips
        for _ in 0..self.n * self.n {
            let i = self.rng.gen_range(0..self.n); // Pick X coordinate
            let j = self.rng.gen_range(0..self.n); // Pick Y coordinate
            let idx = i * self.n + j; // Convert to 1D index

            let s = self.spins[idx]; // Current spin
            let mut sum = 0; // Initialize sum of neighbor spins

            let neighbors = [
                ((i + 1) % self.n, j),
                ((i + self.n - 1) % self.n, j),
                (i, (j + 1) % self.n),
                (i, (j + self.n - 1) % self.n),
            ];

            for (ni, nj) in neighbors {
                sum += self.spins[ni * self.n + nj];
            }

            let d_e = 2.0 * self.j * s as f64 * sum as f64 + 2.0 * self.h * s as f64;
            if d_e <= 0.0 || self.rng.gen_range(0.0..1.0) < (-d_e / self.temp).exp() {
                self.spins[idx] = -s;
                self.accepted += 1;
                self.energy += d_e / (self.n * self.n) as f64;
                self.magnetization += (self.spins[idx] as f64 - s as f64) / (self.n * self.n) as f64;
            }
        }
    }

    // Perform a single Glauber update
    #[wasm_bindgen]
    pub fn glauber_step(&mut self) {
        self.attempted += self.n * self.n;
        for _ in 0..self.n * self.n {
            let i = self.rng.gen_range(0..self.n);
            let j = self.rng.gen_range(0..self.n);
            let idx = i * self.n + j;

            let s = self.spins[idx];
            let mut sum = 0;

            let neighbors = [
                ((i + 1) % self.n, j),
                ((i + self.n - 1) % self.n, j),
                (i, (j + 1) % self.n),
                (i, (j + self.n - 1) % self.n),
            ];

            for (ni, nj) in neighbors {
                sum += self.spins[ni * self.n + nj];
            }

            let d_e = 2.0 * self.j * s as f64 * sum as f64 + 2.0 * self.h * s as f64;
            if self.rng.gen_range(0.0..1.0) < 1.0 / (1.0 + (d_e / self.temp).exp()) {
                self.spins[idx] = -s;
                self.accepted += 1;
                self.energy += d_e / (self.n * self.n) as f64;
                self.magnetization += (self.spins[idx] as f64 - s as f64) / (self.n * self.n) as f64;
            }
        }
    }

    // Perform a single Wolff cluster update
    #[wasm_bindgen]
    pub fn wolff_step(&mut self) {
        use std::collections::VecDeque;
        let n = self.n;
        let p_add = 1.0 - (-2.0 * self.j / self.temp).exp();
        let ghost_spin: i8 = if self.h >= 0.0 { 1 } else { -1 };
        let p_ghost = 1.0 - (-2.0 * self.h.abs() / self.temp).exp();

        // Pick a random seed site
        let i0 = self.rng.gen_range(0..n);
    let j0 = self.rng.gen_range(0..n);
        let seed_spin = self.spins[i0 * n + j0];

        let mut visited = vec![false; n * n];
        let mut queue = VecDeque::new();
        queue.push_back((i0, j0));
        visited[i0 * n + j0] = true;
        let mut cluster_sites = vec![(i0, j0)];

        // Track if cluster is connected to ghost spin
        let mut connected_to_ghost = false;

        while let Some((i, j)) = queue.pop_front() {
            // For each site, check connection to ghost spin
            let idx = i * n + j;
            let s = self.spins[idx];
            if !connected_to_ghost && s == ghost_spin {
            if self.rng.gen_range(0.0..1.0) < p_ghost {
                    connected_to_ghost = true;
                }
            }
            let neighbors = [
                ((i + 1) % n, j),
                ((i + n - 1) % n, j),
                (i, (j + 1) % n),
                (i, (j + n - 1) % n),
            ];
            for (ni, nj) in neighbors {
                let nidx = ni * n + nj;
                if !visited[nidx] && self.spins[nidx] == seed_spin {
                if self.rng.gen_range(0.0..1.0) < p_add {
                        visited[nidx] = true;
                        queue.push_back((ni, nj));
                        cluster_sites.push((ni, nj));
                    }
                }
            }
        }

        // Flip cluster if not connected to ghost spin
        let flip = if connected_to_ghost { 1 } else { -1 };
        for &(i, j) in &cluster_sites {
            self.spins[i * n + j] *= flip;
        }
        self.attempted += 1;
        self.accepted += 1;
        self.energy = calc_avg_energy(&self.spins, self.n, self.j, self.h);
        self.magnetization = calc_avg_magnetization(&self.spins, self.n);
    }

    // Perform a single Heat Bath update
    #[wasm_bindgen]
    pub fn heatbath_step(&mut self) {
        self.attempted += self.n * self.n;
        let mut accepted = 0;
        for _ in 0..self.n * self.n {
            let i = self.rng.gen_range(0..self.n);
            let j = self.rng.gen_range(0..self.n);
            let idx = i * self.n + j;

            // Sum over neighbors
            let mut sum = 0;
            let neighbors = [
                ((i + 1) % self.n, j),
                ((i + self.n - 1) % self.n, j),
                (i, (j + 1) % self.n),
                (i, (j + self.n - 1) % self.n),
            ];
            for (ni, nj) in neighbors {
                sum += self.spins[ni * self.n + nj];
            }

            // Local field
            let local_field = self.j * sum as f64 + self.h;
            // Probability for spin up (+1)
            let p_up = 1.0 / (1.0 + (-2.0 * local_field / self.temp).exp());

            let old_spin = self.spins[idx];
            // Set spin according to probability
            if self.rng.gen_range(0.0..1.0) < p_up {
                self.spins[idx] = 1;
            } else {
                self.spins[idx] = -1;
            }
            if self.spins[idx] != old_spin {
                accepted += 1;
            }
        }
        self.accepted += accepted;
        self.energy = calc_avg_energy(&self.spins, self.n, self.j, self.h);
        self.magnetization = calc_avg_magnetization(&self.spins, self.n);
    }

    // Get accepted spins
    #[wasm_bindgen]
    pub fn accepted(&self) -> f64 {
        self.accepted as f64
    }

    // Get attempted spins
    #[wasm_bindgen]
    pub fn attempted(&self) -> f64 {
        self.attempted as f64
    }

    // Get current energy per spin
    #[wasm_bindgen]
    pub fn energy(&self) -> f64 {
        self.energy
    }

    // Get current magnetization per spin
    #[wasm_bindgen]
    pub fn magnetization(&self) -> f64 {
        self.magnetization
    }

    // Expose pointer to spins for JS
    #[wasm_bindgen]
    pub fn spins_ptr(&self) -> *const i8 {
        self.spins.as_ptr()
    }

    // Expose size of the lattice for JS
    pub fn size(&self) -> usize {
        self.n
    }

    // Set temperature from JS
    #[wasm_bindgen]
    pub fn set_temp(&mut self, temp: f64) {
        self.temp = temp;
    }

    // Set coupling constant J from JS
    #[wasm_bindgen]
    pub fn set_j(&mut self, j: f64) {
        self.j = j;
        self.energy = calc_avg_energy(&self.spins, self.n, self.j, self.h);
    }

    // Set external field h from JS
    #[wasm_bindgen]
    pub fn set_h(&mut self, h: f64) {
        self.h = h;
        self.energy = calc_avg_energy(&self.spins, self.n, self.j, self.h);
    }

    // Reset data from JS
    #[wasm_bindgen]
    pub fn reset_data(&mut self) {
        self.accepted = 0;
        self.attempted = 0;
        self.energy = calc_avg_energy(&self.spins, self.n, self.j, self.h);
        self.magnetization = calc_avg_magnetization(&self.spins, self.n);
    }
}