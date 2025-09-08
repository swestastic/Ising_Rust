// ...existing code...

#[wasm_bindgen]
impl Ising {
    // ...existing code...

    /// Perform a single Swendsen-Wang cluster update
    #[wasm_bindgen]
    pub fn swendsen_wang_step(&mut self) {
    // VecDeque not needed here
        let n = self.n;
        let mut rng = StdRng::from_entropy();
        let p_bond = 1.0 - (-2.0 * self.j / self.temp).exp();
        // Step 1: Build bond map
        let mut bonds = vec![false; n * n * 4]; // 4 neighbors per site
        for i in 0..n {
            for j in 0..n {
                let idx = i * n + j;
                let s = self.spins[idx];
                let neighbors = [
                    ((i + 1) % n, j),
                    (i, (j + 1) % n),
                ];
                for (k, (ni, nj)) in neighbors.iter().enumerate() {
                    let nidx = ni * n + nj;
                    if self.spins[nidx] == s && rng.gen_range(0.0..1.0) < p_bond {
                        bonds[idx * 4 + k] = true;
                    }
                }
            }
        }
        // Step 2: Cluster labeling (Union-Find)
        let mut labels = (0..n * n).collect::<Vec<_>>();
        fn find(labels: &mut [usize], x: usize) -> usize {
            if labels[x] != x {
                labels[x] = find(labels, labels[x]);
            }
            labels[x]
        }
        fn union(labels: &mut [usize], x: usize, y: usize) {
            let xroot = find(labels, x);
            let yroot = find(labels, y);
            if xroot != yroot {
                labels[yroot] = xroot;
            }
        }
        for i in 0..n {
            for j in 0..n {
                let idx = i * n + j;
                // Right neighbor
                if bonds[idx * 4 + 1] {
                    let nidx = i * n + (j + 1) % n;
                    union(&mut labels, idx, nidx);
                }
                // Down neighbor
                if bonds[idx * 4 + 0] {
                    let nidx = ((i + 1) % n) * n + j;
                    union(&mut labels, idx, nidx);
                }
            }
        }
        // Step 3: Flip clusters
        let mut cluster_flips = vec![None; n * n];
        for i in 0..n {
            for j in 0..n {
                let idx = i * n + j;
                let root = find(&mut labels, idx);
                if cluster_flips[root].is_none() {
                    cluster_flips[root] = Some(if rng.gen_range(0.0..1.0) < 0.5 { -1 } else { 1 });
                }
                self.spins[idx] = self.spins[idx] * cluster_flips[root].unwrap();
            }
        }
        self.attempted += 1;
        self.accepted += 1;
    }

    /// Compute the average energy per site
    #[wasm_bindgen]
    pub fn avg_energy(&self) -> f64 {
        let n = self.n;
        let mut energy = 0.0;
        for i in 0..n {
            for j in 0..n {
                let idx = i * n + j;
                let s = self.spins[idx] as f64;
                let neighbors = [
                    ((i + 1) % n, j),
                    (i, (j + 1) % n),
                ];
                for (ni, nj) in neighbors {
                    let nidx = ni * n + nj;
                    energy -= self.j * s * self.spins[nidx] as f64;
                }
            }
        }
        energy / (n * n) as f64
    }
    // ...existing code...
}
use wasm_bindgen::prelude::*;
use rand::Rng;
use rand::SeedableRng;
use rand::rngs::StdRng;

#[wasm_bindgen]
pub struct Ising {
    n: usize,
    spins: Vec<i8>,
    temp: f64,
    j: f64,
    h: f64,
    accepted: usize,
    attempted: usize,
}

#[wasm_bindgen]
impl Ising {
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, temp: f64, j: f64) -> Self {
        let mut rng = StdRng::from_entropy();
        let spins = (0..n * n)
            .map(|_| if rng.gen_range(0.0..1.0) > 0.5 { 1 } else { -1 })
            .collect();
        Self { n, spins, temp, j, h: 0.0, accepted: 0, attempted: 0 }
    }

    pub fn step(&mut self) {
        let mut rng = StdRng::from_entropy();
        self.attempted += self.n * self.n;
        let mut accepted = 0;
        for _ in 0..self.n * self.n {
            let i = rng.gen_range(0..self.n);
            let j = rng.gen_range(0..self.n);
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
            if d_e <= 0.0 || rng.gen_range(0.0..1.0) < (-d_e / self.temp).exp() {
                self.spins[idx] = -s;
                accepted += 1;
            }
        }
        self.accepted += accepted;
    }

    /// Set external field h from JS
    #[wasm_bindgen]
    pub fn set_h(&mut self, h: f64) {
        self.h = h;
    }

    /// Perform a single Wolff cluster update
    #[wasm_bindgen]
    pub fn wolff_step(&mut self) {
        use std::collections::VecDeque;
        let mut rng = StdRng::from_entropy();
        let n = self.n;
        let p_add = 1.0 - (-2.0 * self.j / self.temp).exp();

        // Pick a random seed site
        let i0 = rng.gen_range(0..n);
        let j0 = rng.gen_range(0..n);
        let seed_spin = self.spins[i0 * n + j0];

        let mut visited = vec![false; n * n];
        let mut queue = VecDeque::new();
        queue.push_back((i0, j0));
        visited[i0 * n + j0] = true;
    let mut _cluster_size = 0;

        while let Some((i, j)) = queue.pop_front() {
            self.spins[i * n + j] *= -1;
            _cluster_size += 1;
            let neighbors = [
                ((i + 1) % n, j),
                ((i + n - 1) % n, j),
                (i, (j + 1) % n),
                (i, (j + n - 1) % n),
            ];
            for (ni, nj) in neighbors {
                let idx = ni * n + nj;
                if !visited[idx] && self.spins[idx] == seed_spin {
                    if rng.gen_range(0.0..1.0) < p_add {
                        visited[idx] = true;
                        queue.push_back((ni, nj));
                    }
                }
            }
        }
        self.attempted += 1;
        self.accepted += 1;
    }
    /// Get acceptance ratio
    #[wasm_bindgen]
    pub fn acceptance_ratio(&self) -> f64 {
        if self.attempted == 0 {
            0.0
        } else {
            self.accepted as f64 / self.attempted as f64
        }
    }
    /// Set coupling constant J from JS
    #[wasm_bindgen]
    pub fn set_j(&mut self, j: f64) {
        self.j = j;
    }

    /// Expose pointer to spins for JS
    pub fn spins_ptr(&self) -> *const i8 {
        self.spins.as_ptr()
    }

    /// Expose size of the lattice for JS
    pub fn size(&self) -> usize {
        self.n
    }

    /// Set temperature from JS
    #[wasm_bindgen]
    pub fn set_temp(&mut self, temp: f64) {
        self.temp = temp;
    }
}