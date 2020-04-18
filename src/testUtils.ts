import BN from 'bn.js';

import { defaultConfig } from '../src/config';
import { sha256ToInt } from '../src/hash';

function hash(version: BN, ...args: BN[]): BN {
  return sha256ToInt(defaultConfig.modulusSize, version, ...args);
}

export { hash };
