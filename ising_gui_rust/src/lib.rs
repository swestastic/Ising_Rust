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
}

#[wasm_bindgen]
impl Ising {
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, temp: f64, j: f64) -> Self {
        let mut rng = StdRng::from_entropy();
        let spins = (0..n * n)
            .map(|_| if rng.gen_range(0.0..1.0) > 0.5 { 1 } else { -1 })
            .collect();
        Self { n, spins, temp, j }
    }

    pub fn step(&mut self) {
        let mut rng = StdRng::from_entropy();
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

            let d_e = 2.0 * self.j * s as f64 * sum as f64;
            if d_e <= 0.0 || rng.gen_range(0.0..1.0) < (-d_e / self.temp).exp() {
                self.spins[idx] = -s;
            }
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