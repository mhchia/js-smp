<p align="center">
  <a href="https://github.com/actions/checkout"><img alt="GitHub Actions status" src="https://github.com/mhchia/js-smp/workflows/nodejs-test/badge.svg"></a>
</p>

# js-smp

`js-smp` is a typescript implementation of the SMP(Socialist Millionaires' Problem) Protocol, which allows two people to compare whether their secrets are equaled, without leaking any other information.

This implementation is based on the Socialist Millionaires' Protocol in Off-the-record Messaging(OTR) version 3. See
- [Socialist Millionaires' Problem][smp_wiki] to know more about the problem.
- [OTR version 3 documentation][otr_v3_spec] for the specification of the protocol.
- The paper ["A Fair and Efficient Solution to the Socialist Millionaires’ Problem"][smp_paper] for the design rationales and security proofs.

## Installation
```bash
npm install js-smp
```

## Usage

`SMPStateMachine` holds what you need!

```typescript
import { SMPStateMachine } from 'js-smp';

/* Initialize Alice */
// A secret can be either these types.
const aliceSecret: number | string | BN | Uint8Array = 'alice-small-serect';
const alice = new SMPStateMachine(aliceSecret);

/* Initialize Bob */
const bobSecret: number | string | BN | Uint8Array = 'bob-big-serect';
const bob = new SMPStateMachine(bobSecret);

// Alice initiate SMP.
// SMP is initiated by passing `null` to `transit`, and the first message is returned.
const msg1 = alice.transit(null);

// Bob receives `msg1` and replies `msg2`.
const msg2 = bob.transit(msg1);

// Alice receives `msg2` and replies `msg3`.
const msg3 = alice.transit(msg2);

// Bob receives `msg3` and replies `msg4`. Bob gets the result.
const msg4 = bob.transit(msg3);
const bobResult = bob.getResult();

// Alice receives `msg4` and nothing to reply. Alice gets the result.
alice.transit(msg4);
const aliceResult = alice.getResult();

// result=false, because `aliceSecret !== bobSecret`.
console.log(`result=${aliceResult}`);
```

#### Through the wire
Serialization and deserialization are done by `TLV.serialize` and `TLV.deserialize(bytes)`. Messages returned from `SMPStateMachine.transit` are in `TLV` format. Working with the network is made easy. The wire types and messages can be found in `src/dataTypes.ts` and `src/msgs.ts`.

```typescript
import { TLV } from 'js-smp';
const msg2: TLV = bob.transit(msg1);
const msg2bytes: Uint8Array = msg2.serialize();

/* Send `msg2bytes` over the wire to Alice... */

/* Receive `msg3bytes` over the wire from Alice... */
const msg3 = TLV.deserialize(msg3bytes);
const msg4: TLV = bob.transit(msg3);
```

<!-- TODO: Explanation: Add diagrams -->

[otr_v3_spec]: https://otr.cypherpunks.ca/Protocol-v3-4.1.1.html
[smp_paper]: https://www.win.tue.nl/~berry/papers/dam.pdf
[smp_wiki]: https://en.wikipedia.org/wiki/Socialist_millionaire_problem
