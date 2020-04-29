import BN from 'bn.js';

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs,
} from '../src/proofs';
import { defaultConfig } from '../src/config';
import { secretFactory, multiplicativeGroupFactory } from '../src/factories';
import { smpHash } from '../src/hash';

const q = defaultConfig.q;
const version = 1;

function hash(...args: BN[]): BN {
  return smpHash(version, ...args);
}

// TODO: Add failure cases
describe('ProofDiscreteLog', () => {
  test('make and verify', () => {
    const g = multiplicativeGroupFactory();
    const x = secretFactory();
    const y = g.exponentiate(x);
    const r = secretFactory();
    const pf = makeProofDiscreteLog(hash, g, x, r, q);
    expect(verifyProofDiscreteLog(hash, pf, g, y)).toBeTruthy();
  });
});

describe('ProofEqualDiscreteCoordinates', () => {
  test('make and verify', () => {
    const g0 = multiplicativeGroupFactory();
    const g1 = multiplicativeGroupFactory();
    const g2 = multiplicativeGroupFactory();
    const x0 = secretFactory();
    const x1 = secretFactory();
    const r0 = secretFactory();
    const r1 = secretFactory();
    const y0 = g0.exponentiate(x0);
    const y1 = g1.exponentiate(x0).operate(g2.exponentiate(x1));
    const proof = makeProofEqualDiscreteCoordinates(
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
      verifyProofEqualDiscreteCoordinates(hash, g0, g1, g2, y0, y1, proof)
    ).toBeTruthy();
  });
});

describe('ProofEqualDiscreteLogs', () => {
  test('make and verify', () => {
    const g0 = multiplicativeGroupFactory();
    const g1 = multiplicativeGroupFactory();
    const x = secretFactory();
    const r = secretFactory();
    const y0 = g0.exponentiate(x);
    const y1 = g1.exponentiate(x);
    const proof = makeProofEqualDiscreteLogs(hash, g0, g1, x, r, q);
    expect(
      verifyProofEqualDiscreteLogs(hash, g0, g1, y0, y1, proof)
    ).toBeTruthy();
  });
});
