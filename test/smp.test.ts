import BN from 'bn.js';

import { defaultConfig } from '../src/config';

import { SMPStateMachine } from '../src/smp';

function smp(x: BN, y: BN): boolean {
  const alice = new SMPStateMachine(defaultConfig, x); // Initiator
  const bob = new SMPStateMachine(defaultConfig, y); // Responder

  const msg1 = alice.beginSMP();
  const msg2 = bob.handleSMPMessage1(msg1);
  const msg3 = alice.handleSMPMessage2(msg2);
  // NOTE: Sanity check that `alice.g2 == bob.g2` and `alice.g3 == bob.g3`
  if (
    alice.state.g2 === undefined ||
    bob.state.g2 === undefined ||
    !alice.state.g2.equal(bob.state.g2)
  ) {
    throw new Error('`g2` is not shared successfully by Alice and Bob');
  }
  if (
    alice.state.g3 === undefined ||
    bob.state.g3 === undefined ||
    !alice.state.g3.equal(bob.state.g3)
  ) {
    throw new Error('`g3` is not shared successfully by Alice and Bob');
  }
  const msg4 = bob.handleSMPMessage3(msg3);
  alice.handleSMPMessage4(msg4);
  // Sanity check that `alice.rab == bob.rab`
  if (
    alice.state.r === undefined ||
    bob.state.r === undefined ||
    !alice.state.r.equal(bob.state.r)
  ) {
    throw new Error('`rab` is not shared successfully by Alice and Bob');
  }
  // Sanity check
  if (alice.state.getResult(true) !== bob.state.getResult(false)) {
    throw new Error('Alice and Bob get different result!');
  }
  return alice.state.getResult(true);
}

describe('test smp', () => {
  test('same secrets', () => {
    expect(smp(new BN(1), new BN(1))).toBeTruthy();
  });
  test('different secrets', () => {
    expect(smp(new BN(1), new BN(2))).toBeFalsy();
  });
});
