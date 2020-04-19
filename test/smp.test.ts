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
  alice.a2 = secretFactory();
  alice.a3 = secretFactory();
  const [g2a, g2aProof] = alice.makeG2a(new BN(1));
  const [g3a, g3aProof] = alice.makeG3a(new BN(2));
  alice.g2a = g2a;
  alice.g3a = g3a;
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
  bob.g2b = g2a;
  bob.g3b = g3a;
  // Create secrets
  bob.a2 = secretFactory();
  bob.a3 = secretFactory();
  bob.s = secretFactory();
  // Calculate its DH slice
  const [g2b, g2bProof] = bob.makeG2a(new BN(3));
  const [g3b, g3bProof] = bob.makeG3a(new BN(4));
  // NOTE: For bob, `g2b` is its `g2a`.
  bob.g2a = g2b;
  bob.g3a = g3b;
  // Perform DH
  bob.g2 = bob.makeDHSharedSecret(g2a, bob.a2);
  bob.g3 = bob.makeDHSharedSecret(g3a, bob.a3);
  // Make `Pb` and `Qb`
  const [pb, qb, pbqbProof] = bob.makePaQa(new BN(5));
  // NOTE: For bob, `Pb` is its `Pa`.
  bob.pa = pb;
  bob.qa = qb;
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
  alice.g2b = g2b;
  alice.g3b = g3b;
  // Perform DH
  alice.g2 = alice.makeDHSharedSecret(g2b, alice.a2);
  alice.g3 = alice.makeDHSharedSecret(g3b, alice.a3);

  // NOTE: Sanity check that `alice.g2 == bob.g2` and `alice.g3 == bob.g3`
  if (!alice.g2.equal(bob.g2)) {
    throw new Error('`g2` is not shared successfully by Alice and Bob');
  }
  if (!alice.g3.equal(bob.g3)) {
    throw new Error('`g3` is not shared successfully by Alice and Bob');
  }

  // `Pb`, `Qb`
  if (!alice.verifyPbQbProof(new BN(5), pb, qb, pbqbProof)) {
    throw new Error('Alice: `pbqbProof` is invalid');
  }
  alice.pb = pb;
  alice.qb = qb;
  // Create secret `s`
  alice.s = secretFactory();
  // Calculate `Pa` and `Qa`
  const [pa, qa, paqaProof] = alice.makePaQa(new BN(6));
  alice.pa = pa;
  alice.qa = qa;
  // Calculate `Ra`
  const [ra, raProof] = alice.makeRa(new BN(7));
  alice.ra = ra;

  // Send `Pa`, `Qa` and `Ra` to Bob

  /*
    Step 3: Bob receives `Pa`, `Qa`, `Ra` along with their proofs,
    calculates `Rb` and `Rab` accordingly.
  */
  // `Pa` and `Qa`
  if (!bob.verifyPbQbProof(new BN(6), pa, qa, paqaProof)) {
    throw new Error('Bob: `paqaProof` is invalid');
  }
  // NOTE: `Pa` is Bob's `Pb`
  bob.pb = pa;
  bob.qb = qa;
  // `Ra`
  if (!bob.verifyRb(new BN(7), ra, raProof)) {
    throw new Error('Bob: `raProof` is invalid');
  }
  // NOTE: `Ra` is Bob's `Rb`
  bob.rb = ra;
  // Calculate `Rb`
  const [rb, rbProof] = bob.makeRa(new BN(8));
  // NOTE: `Rb` is Bob's `Ra`
  bob.ra = rb;
  // Calculate `Rab`
  bob.rab = bob.makeRab();
  // Send `Rb` to Alice

  /*
    Step 4: Alice receives `Rb` and calculate `Rab` as well.
  */
  // Verify `Rb`
  if (!alice.verifyRb(new BN(8), rb, rbProof)) {
    throw new Error('Alice: `rbProof` is invalid');
  }
  alice.rb = rb;
  // Calculate `Rab`
  alice.rab = alice.makeRab();
  // Sanity check that `alice.rab == bob.rab`
  if (!alice.rab.equal(bob.rab)) {
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
