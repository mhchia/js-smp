import BN from 'bn.js';
import { sha256 } from 'js-sha256';

import { MPI, concatUint8Array, Byte } from './msgs';

export function smpHash(version: number, ...args: BN[]): BN {
  let res = new Byte(version).serialize();
  for (const arg of args) {
    res = concatUint8Array(res, new MPI(arg).serialize());
  }
  return new BN(sha256(res), 'hex');
}
