import { sha256ToInt } from '../src/hash';
import { makeProofDiscreteLog, verifyProofDiscreteLog } from '../src/proofs';
import { defaultConfig } from '../src/config';
import BN from 'bn.js';
import { randomBytes } from 'crypto';
import { MultiplicativeGroup } from '../src/multiplicativeGroup';

function hash(version: BN, ...args: BN[]): BN {
  return sha256ToInt(defaultConfig.modulusSize, version, ...args);
}

function getRandomSecret(): BN {
  const buf = randomBytes(defaultConfig.modulusSize);
  return new BN(buf.toString('hex'), 'hex').umod(defaultConfig.modulus);
}

function getRandomGroupElement(): MultiplicativeGroup {
  const secret = getRandomSecret();
  return defaultConfig.g.exponentiate(secret);
}

describe('ProofDiscreteLog', () => {
  const version = new BN(1);
  const q = defaultConfig.q;
  test('', () => {
    const g = getRandomGroupElement();
    const x = getRandomSecret();
    const y = g.exponentiate(x);
    const r = getRandomSecret();
    const pf = makeProofDiscreteLog(version, hash, g, x, r, q);
    expect(verifyProofDiscreteLog(version, hash, pf, g, y)).toBeTruthy();
  });
});
