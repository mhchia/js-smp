import BN from 'bn.js';
import { randomBytes } from 'crypto';

import { defaultConfig } from '../src/config';
import { MultiplicativeGroup } from '../src/multiplicativeGroup';

function secretFactory(): BN {
  const buf = randomBytes(defaultConfig.modulusSize);
  return new BN(buf.toString('hex'), 'hex').umod(defaultConfig.modulus);
}

function multiplicativeGroupFactory(): MultiplicativeGroup {
  const secret = secretFactory();
  return defaultConfig.g.exponentiate(secret);
}

export { secretFactory, multiplicativeGroupFactory };
