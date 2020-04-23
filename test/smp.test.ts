import BN from 'bn.js';

import { SMPStateMachine } from '../src/smp';

function smp(x: BN, y: BN): boolean | null {
  const alice = new SMPStateMachine(x); // Initiator
  const bob = new SMPStateMachine(y); // Responder

  const msg1 = alice.transit(null);
  const msg2 = bob.transit(msg1);
  const msg3 = alice.transit(msg2);
  const msg4 = bob.transit(msg3);
  alice.transit(msg4);
  if (alice.getResult() === null) {
    throw new Error('result should have been set on Alice side');
  }
  if (bob.getResult() === null) {
    throw new Error('result should have been set on Bob side');
  }
  if (alice.getResult() !== bob.getResult()) {
    throw new Error('Alice and Bob got different results');
  }
  return alice.getResult();

  // const msg1 = alice.beginSMP();
  // const msg2 = bob.handleSMPMessage1(msg1);
  // const msg3 = alice.handleSMPMessage2(msg2);

  // // NOTE: Sanity check that `alice.g2 == bob.g2` and `alice.g3 == bob.g3`
  // if (
  //   alice.state.g2 === undefined ||
  //   bob.state.g2 === undefined ||
  //   !alice.state.g2.equal(bob.state.g2)
  // ) {
  //   throw new Error('`g2` is not shared successfully by Alice and Bob');
  // }
  // if (
  //   alice.state.g3 === undefined ||
  //   bob.state.g3 === undefined ||
  //   !alice.state.g3.equal(bob.state.g3)
  // ) {
  //   throw new Error('`g3` is not shared successfully by Alice and Bob');
  // }
  // const msg4 = bob.handleSMPMessage3(msg3);
  // alice.handleSMPMessage4(msg4);
  // // Sanity check that `alice.rab == bob.rab`
  // if (
  //   alice.state.r === undefined ||
  //   bob.state.r === undefined ||
  //   !alice.state.r.equal(bob.state.r)
  // ) {
  //   throw new Error('`rab` is not shared successfully by Alice and Bob');
  // }
  // // Sanity check
  // if (alice.result === undefined) {
  //   throw new Error("smp should should have finished on Alice's side");
  // }
  // if (bob.result === undefined) {
  //   throw new Error("smp should should have finished on Bob's side");
  // }
  // if (alice.result !== bob.result) {
  //   throw new Error('Alice and Bob get different result!');
  // }
  // return alice.result;
}

describe('test smp', () => {
  test('same secrets', () => {
    expect(smp(new BN(1), new BN(1))).toBeTruthy();
  });
  test('different secrets', () => {
    expect(smp(new BN(1), new BN(2))).toBeFalsy();
  });
});
