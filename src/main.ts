import BN from 'bn.js';

import { SMPStateMachine } from './smp';


const alice = new SMPStateMachine(new BN(1));
console.log("1");
const bob = new SMPStateMachine(new BN(1));
console.log("2");
const msg1 = alice.transit(null); // Initiate SMP
console.log("3");
const msg2 = bob.transit(msg1);
console.log("4");
const msg3 = alice.transit(msg2);
console.log("5");
const msg4 = bob.transit(msg3);
console.log("6");
alice.transit(msg4);
console.log("7");
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
console.log(`result = ${resAlice}`);
