import { sha256ToInt } from '../src/hash';
import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
} from '../src/proofs';
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

const q = defaultConfig.q;
const version = new BN(1);

describe('ProofDiscreteLog', () => {
  test('make and verify', () => {
    const g = getRandomGroupElement();
    const x = getRandomSecret();
    const y = g.exponentiate(x);
    const r = getRandomSecret();
    const pf = makeProofDiscreteLog(version, hash, g, x, r, q);
    expect(verifyProofDiscreteLog(version, hash, pf, g, y)).toBeTruthy();
  });
});

describe('ProofEqualDiscreteCoordinates', () => {
  test('make and verify', () => {
    const g0 = getRandomGroupElement();
    const g1 = getRandomGroupElement();
    const g2 = getRandomGroupElement();
    const x0 = getRandomSecret();
    const x1 = getRandomSecret();
    const r0 = getRandomSecret();
    const r1 = getRandomSecret();
    const y0 = g0.exponentiate(x0);
    const y1 = g1.exponentiate(x0).operate(g2.exponentiate(x1));
    const proof = makeProofEqualDiscreteCoordinates(
      version,
      hash,
      g0,
      g1,
      g2,
      x0,
      x1,
      r0,
      r1,
      q
    );
    expect(
      verifyProofEqualDiscreteCoordinates(
        version,
        hash,
        g0,
        g1,
        g2,
        y0,
        y1,
        proof
      )
    ).toBeTruthy();
  });
});
