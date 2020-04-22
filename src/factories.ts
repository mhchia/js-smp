import { randomBytes } from 'crypto';

import BN from 'bn.js';

import { defaultConfig } from './config';
import { MultiplicativeGroup } from './multiplicativeGroup';

function secretFactory(): BN {
  const buf = randomBytes(defaultConfig.modulusSize);
  return new BN(buf.toString('hex'), 'hex').umod(defaultConfig.modulus);
}

function multiplicativeGroupFactory(): MultiplicativeGroup {
  const secret = secretFactory();
  return defaultConfig.g.exponentiate(secret);
}

export { secretFactory, multiplicativeGroupFactory };
