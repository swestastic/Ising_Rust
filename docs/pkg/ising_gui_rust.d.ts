/* tslint:disable */
/* eslint-disable */
export class Ising {
  free(): void;
  constructor(n: number, temp: number, j: number);
  metropolis_step(): void;
  glauber_step(): void;
  wolff_step(): void;
  heatbath_step(): void;
  set_h(h: number): void;
  acceptance_ratio(): number;
  avg_energy(): number;
  spins_ptr(): number;
  size(): number;
  set_temp(temp: number): void;
  set_j(j: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_ising_free: (a: number, b: number) => void;
  readonly ising_new: (a: number, b: number, c: number) => number;
  readonly ising_metropolis_step: (a: number) => void;
  readonly ising_glauber_step: (a: number) => void;
  readonly ising_wolff_step: (a: number) => void;
  readonly ising_heatbath_step: (a: number) => void;
  readonly ising_set_h: (a: number, b: number) => void;
  readonly ising_acceptance_ratio: (a: number) => number;
  readonly ising_avg_energy: (a: number) => number;
  readonly ising_spins_ptr: (a: number) => number;
  readonly ising_size: (a: number) => number;
  readonly ising_set_temp: (a: number, b: number) => void;
  readonly ising_set_j: (a: number, b: number) => void;
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
