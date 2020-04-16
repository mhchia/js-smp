import BN from 'bn.js';
import { sha256 } from 'js-sha256';

const endian = 'be'; // big endian
const intSize = 1536 / 8; // bytes

export function hashToInt(version: BN, ...args: BN[]): BN {
  const versionBytes: number[] = version.toArray(endian, intSize);
  let res: number[] = versionBytes;
  for (const arg of args) {
    res = res.concat(arg.toArray(endian, intSize));
  }
  return new BN(sha256(res), 'hex');
}
