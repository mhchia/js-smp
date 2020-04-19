import BN from 'bn.js';

import { secretFactory } from '../src/factories';

import { defaultConfig } from '../src/config';

import { SMPState } from '../src/smp';

function smpWithState(x: BN, y: BN): boolean {
  const alice = new SMPState(defaultConfig, x, true); // Initiator
  const bob = new SMPState(defaultConfig, y, false); // Responder

  /*
    Step 0: Alice initaites smp, sending `g2a`, `g3a` to Bob.
  */
  alice.s2 = secretFactory();
  alice.s3 = secretFactory();
  const [g2a, g2aProof] = alice.makeG2L(new BN(1));
  const [g3a, g3aProof] = alice.makeG3L(new BN(2));
  alice.g2L = g2a;
  alice.g3L = g3a;
  // Send `g2a` and `g3a` to Bob

  /*
    Step 1: Bob verifies received data, makes its slice of DH, and sends
    `g2b`, `g3b`, `Pb`, `Qb` to Alice.
  */
  // Verify Alice's proof
  if (!bob.verifyDHPubkey(new BN(1), g2a, g2aProof)) {
    throw new Error('Bob: `g2a` proof is invalid');
  }
  if (!bob.verifyDHPubkey(new BN(2), g3a, g3aProof)) {
    throw new Error('Bob: `g3a` proof is invalid');
  }
  // Save the slices from alice
  bob.g2R = g2a;
  bob.g3R = g3a;
  // Create secrets
  bob.s2 = secretFactory();
  bob.s3 = secretFactory();
  // Calculate its DH slice
  const [g2b, g2bProof] = bob.makeG2L(new BN(3));
  const [g3b, g3bProof] = bob.makeG3L(new BN(4));
  bob.g2L = g2b;
  bob.g3L = g3b;
  // Perform DH
  bob.g2 = bob.makeDHSharedSecret(g2a, bob.s2);
  bob.g3 = bob.makeDHSharedSecret(g3a, bob.s3);
  // Make `Pb` and `Qb`
  const [pb, qb, pbqbProof] = bob.makePLQL(new BN(5));
  bob.pL = pb;
  bob.qL = qb;
  // Send `g2b`, `g3b`, `Pb`, `Qb` along with their proofs to Alice

  /*
    Step 2: Alice receives bob's DH slices, P Q, and their proofs.
  */
  // DH
  if (!alice.verifyDHPubkey(new BN(3), g2b, g2bProof)) {
    throw new Error('Alice: `g2b` proof is invalid');
  }
  if (!alice.verifyDHPubkey(new BN(4), g3b, g3bProof)) {
    throw new Error('Alice: `g3b` proof is invalid');
  }
  // Save the slices from Bob
  alice.g2R = g2b;
  alice.g3R = g3b;
  // Perform DH
  alice.g2 = alice.makeDHSharedSecret(g2b, alice.s2);
  alice.g3 = alice.makeDHSharedSecret(g3b, alice.s3);

  // NOTE: Sanity check that `alice.g2 == bob.g2` and `alice.g3 == bob.g3`
  if (!alice.g2.equal(bob.g2)) {
    throw new Error('`g2` is not shared successfully by Alice and Bob');
  }
  if (!alice.g3.equal(bob.g3)) {
    throw new Error('`g3` is not shared successfully by Alice and Bob');
  }

  // `Pb`, `Qb`
  if (!alice.verifyPRQRProof(new BN(5), pb, qb, pbqbProof)) {
    throw new Error('Alice: `pbqbProof` is invalid');
  }
  alice.pR = pb;
  alice.qR = qb;
  // Calculate `Pa` and `Qa`
  const [pa, qa, paqaProof] = alice.makePLQL(new BN(6));
  alice.pL = pa;
  alice.qL = qa;
  // Calculate `Ra`
  const [ra, raProof] = alice.makeRL(new BN(7));
  alice.rL = ra;

  // Send `Pa`, `Qa` and `Ra` to Bob

  /*
    Step 3: Bob receives `Pa`, `Qa`, `Ra` along with their proofs,
    calculates `Rb` and `Rab` accordingly.
  */
  // `Pa` and `Qa`
  if (!bob.verifyPRQRProof(new BN(6), pa, qa, paqaProof)) {
    throw new Error('Bob: `paqaProof` is invalid');
  }
  // NOTE: `Pa` is Bob's `Pb`
  bob.pR = pa;
  bob.qR = qa;
  // `Ra`
  if (!bob.verifyRR(new BN(7), ra, raProof)) {
    throw new Error('Bob: `raProof` is invalid');
  }
  // NOTE: `Ra` is Bob's `Rb`
  bob.rR = ra;
  // Calculate `Rb`
  const [rb, rbProof] = bob.makeRL(new BN(8));
  // NOTE: `Rb` is Bob's `Ra`
  bob.rL = rb;
  // Calculate `Rab`
  bob.r = bob.makeR();
  // Send `Rb` to Alice

  /*
    Step 4: Alice receives `Rb` and calculate `Rab` as well.
  */
  // Verify `Rb`
  if (!alice.verifyRR(new BN(8), rb, rbProof)) {
    throw new Error('Alice: `rbProof` is invalid');
  }
  alice.rR = rb;
  // Calculate `Rab`
  alice.r = alice.makeR();
  // Sanity check that `alice.rab == bob.rab`
  if (!alice.r.equal(bob.r)) {
    throw new Error('`rab` is not shared successfully by Alice and Bob');
  }
  // Sanity check
  if (alice.getResult() !== bob.getResult()) {
    throw new Error('Alice and Bob get different result!');
  }

  return alice.getResult();
}

describe('test smp', () => {
  test('same secrets', () => {
    expect(smpWithState(new BN(1), new BN(1))).toBeTruthy();
  });
  test('different secrets', () => {
    expect(smpWithState(new BN(1), new BN(2))).toBeFalsy();
  });
});
