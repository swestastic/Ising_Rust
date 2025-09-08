/* tslint:disable */
/* eslint-disable */
export class Ising {
  free(): void;
  /**
   * Perform a single Swendsen-Wang cluster update
   */
  swendsen_wang_step(): void;
  /**
   * Compute the average energy per site
   */
  avg_energy(): number;
  constructor(n: number, temp: number, j: number);
  step(): void;
  /**
   * Set external field h from JS
   */
  set_h(h: number): void;
  /**
   * Perform a single Wolff cluster update
   */
  wolff_step(): void;
  /**
   * Get acceptance ratio
   */
  acceptance_ratio(): number;
  /**
   * Set coupling constant J from JS
   */
  set_j(j: number): void;
  /**
   * Expose pointer to spins for JS
   */
  spins_ptr(): number;
  /**
   * Expose size of the lattice for JS
   */
  size(): number;
  /**
   * Set temperature from JS
   */
  set_temp(temp: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly ising_swendsen_wang_step: (a: number) => void;
  readonly ising_avg_energy: (a: number) => number;
  readonly __wbg_ising_free: (a: number, b: number) => void;
  readonly ising_new: (a: number, b: number, c: number) => number;
  readonly ising_step: (a: number) => void;
  readonly ising_set_h: (a: number, b: number) => void;
  readonly ising_wolff_step: (a: number) => void;
  readonly ising_acceptance_ratio: (a: number) => number;
  readonly ising_set_j: (a: number, b: number) => void;
  readonly ising_spins_ptr: (a: number) => number;
  readonly ising_size: (a: number) => number;
  readonly ising_set_temp: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
