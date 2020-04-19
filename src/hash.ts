import BN from 'bn.js';
import { sha256 } from 'js-sha256';
import { ENDIAN } from './constants';

export function sha256ToInt(intSize: number, ...args: BN[]): BN {
  let res: number[] = [];
  for (const arg of args) {
    res = res.concat(arg.toArray(ENDIAN, intSize));
  }
  return new BN(sha256(res), 'hex');
}
