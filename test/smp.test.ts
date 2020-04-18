import BN from 'bn.js';

import { secretFactory } from '../src/factories';
import {
  makeDHPubkey,
  // makeDHSharedSecret,
  // makePaQa,
  // makeRa,
  // makeRab,
  // verifyRab,
} from '../src/smp';
import {
  makeProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofDiscreteLog,
  verifyProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteLogs,
} from '../src/proofs';
import { defaultConfig } from '../src/config';
import { hash } from '../src/testUtils';


// TODO: Use make/verify from smp.ts?
function smp(x: BN, y: BN): boolean {
  const g1 = defaultConfig.g;
  const q = defaultConfig.q;

  /* Alice */
  // Make secrets, DH pubkey, and proofs.
  const a2 = secretFactory();
  const a3 = secretFactory();
  const g2a = makeDHPubkey(g1, a2);
  const g2aProof = makeProofDiscreteLog(
    new BN(1),
    hash,
    g1,
    a2,
    secretFactory(),
    q
  );
  const g3a = makeDHPubkey(g1, a3);
  const g3aProof = makeProofDiscreteLog(
    new BN(2),
    hash,
    g1,
    a3,
    secretFactory(),
    q
  );

  /* Bob */
  // Verify proofs.
  if (!verifyProofDiscreteLog(new BN(1), hash, g2aProof, g1, g2a)) {
    throw new Error('Bob: g2a proof is invalid');
  }
  if (!verifyProofDiscreteLog(new BN(2), hash, g3aProof, g1, g3a)) {
    throw new Error('Bob: g3a proof is invalid');
  }
  // Make secrets, DH pubkey, and proofs.
  const b2 = secretFactory();
  const b3 = secretFactory();
  const r4b = secretFactory();
  const r5b = secretFactory();
  const r6b = secretFactory();

  const g2b = makeDHPubkey(g1, b2);
  const g2bProof = makeProofDiscreteLog(
    new BN(3),
    hash,
    g1,
    b2,
    secretFactory(),
    q
  );
  const g3b = makeDHPubkey(g1, b3);
  const g3bProof = makeProofDiscreteLog(
    new BN(4),
    hash,
    g1,
    b3,
    secretFactory(),
    q
  );
  // Perform DH.
  const g2 = g2a.exponentiate(b2);
  const g3 = g3a.exponentiate(b3);
  // Make Pb and Qb and proofs
  const pb = g3.exponentiate(r4b);
  const qb = g1.exponentiate(r4b).operate(g2.exponentiate(y));
  const pbQbProof = makeProofEqualDiscreteCoordinates(
    new BN(5),
    hash,
    g3,
    g1,
    g2,
    r4b,
    y,
    r5b,
    r6b,
    q
  );

  /* Alice */
  // Verify DH proofs
  if (!verifyProofDiscreteLog(new BN(3), hash, g2bProof, g1, g2b)) {
    throw new Error('Alice: g2b proof is invalid');
  }
  if (!verifyProofDiscreteLog(new BN(4), hash, g3bProof, g1, g3b)) {
    throw new Error('Alice: g3b proof is invalid');
  }
  // Check DH
  if (!g2.equal(g2b.exponentiate(a2))) {
    throw new Error('Alice: DH for g2 failed');
  }
  if (!g3.equal(g3b.exponentiate(a3))) {
    throw new Error('Alice: DH for g3 failed');
  }
  // Verify Pb Qb proofs
  if (
    !verifyProofEqualDiscreteCoordinates(
      new BN(5),
      hash,
      g3,
      g1,
      g2,
      pb,
      qb,
      pbQbProof
    )
  ) {
    throw new Error('Alice: PbQb proof is invalid');
  }
  // Make secrets and random values
  const r4a = secretFactory();
  const r5a = secretFactory();
  const r6a = secretFactory();
  const r7a = secretFactory();
  // make Pa Qa and their proofs
  const pa = g3.exponentiate(r4a);
  const qa = g1.exponentiate(r4a).operate(g2.exponentiate(x));
  const paQaProof = makeProofEqualDiscreteCoordinates(
    new BN(6),
    hash,
    g3,
    g1,
    g2,
    r4a,
    x,
    r5a,
    r6a,
    q
  );
  // make Ra and its proof with g3a
  const ra = qa.operate(qb.inverse()).exponentiate(a3);
  const raProof = makeProofEqualDiscreteLogs(
    new BN(7),
    hash,
    g1,
    qa.operate(qb.inverse()),
    a3,
    r7a,
    q
  );

  /* Bob */
  // Verify Pa Qa proofs
  if (
    !verifyProofEqualDiscreteCoordinates(
      new BN(6),
      hash,
      g3,
      g1,
      g2,
      pa,
      qa,
      paQaProof
    )
  ) {
    throw new Error('Bob: PaQa proof is invalid');
  }
  // Verify Ra proof
  if (
    !verifyProofEqualDiscreteLogs(
      new BN(7),
      hash,
      g1,
      qa.operate(qb.inverse()),
      g3a,
      ra,
      raProof
    )
  ) {
    throw new Error('Bob: Ra proof is invalid');
  }
  const r8b = secretFactory();
  // make Rb and its proof with g3b
  const rb = qa.operate(qb.inverse()).exponentiate(b3);
  const rbProof = makeProofEqualDiscreteLogs(
    new BN(8),
    hash,
    g1,
    qa.operate(qb.inverse()),
    b3,
    r8b,
    q
  );
  const rab = ra.exponentiate(b3);

  /* Alice */
  // Verify rb proof
  if (
    !verifyProofEqualDiscreteLogs(
      new BN(8),
      hash,
      g1,
      qa.operate(qb.inverse()),
      g3b,
      rb,
      rbProof
    )
  ) {
    throw new Error('Alice: Ra proof is invalid');
  }
  // Verify rab
  if (!rb.exponentiate(a3).equal(rab)) {
    throw new Error('Alice: Rab exchange failed');
  }

  return rab.equal(pa.operate(pb.inverse()));
}

describe('test smp', () => {
  test('same secret', () => {
    expect(smp(new BN(1), new BN(1))).toBeTruthy();
  });
  test('different secret', () => {
    expect(smp(new BN(1), new BN(2))).toBeFalsy();
  });
});
