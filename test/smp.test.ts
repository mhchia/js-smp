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
  const resAlice = alice.getResult();
  const resBob = bob.getResult();
  if (resAlice === null) {
    throw new Error('result should have been set on Alice side');
  }
  if (resBob === null) {
    throw new Error('result should have been set on Bob side');
  }
  if (resAlice !== resBob) {
    throw new Error('Alice and Bob got different results');
  }
  return resAlice;
}

describe('test smp', () => {
  test('same secrets', () => {
    expect(smp(new BN(1), new BN(1))).toBeTruthy();
  });
  test('different secrets', () => {
    expect(smp(new BN(1), new BN(2))).toBeFalsy();
  });
});
