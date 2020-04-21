import { randomBytes } from 'crypto';

import BN from 'bn.js';

import { MultiplicativeGroup } from '../src/multiplicativeGroup';
import { Config } from '../src/config';
import { sha256ToInt } from '../src/hash';

import {
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
  THashFunc,
} from '../src/proofs';

enum Step {
  SMPSTATE_EXPECT1,
  SMPSTATE_EXPECT2,
  SMPSTATE_EXPECT3,
  SMPSTATE_EXPECT4,
}

interface ISMPMessage {
  serialize(...args: any[]): any;
  deserialize(...args: any[]): any;
}

class SMPMessage1 implements ISMPMessage {
  constructor(
    readonly g2a: MultiplicativeGroup,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: MultiplicativeGroup,
    readonly g3aProof: ProofDiscreteLog
  ) {}
  serialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
  deserialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
}

class SMPMessage2 implements ISMPMessage {
  constructor(
    readonly g2b: MultiplicativeGroup,
    readonly g2bProof: ProofDiscreteLog,
    readonly g3b: MultiplicativeGroup,
    readonly g3bProof: ProofDiscreteLog,
    readonly pb: MultiplicativeGroup,
    readonly qb: MultiplicativeGroup,
    readonly pbqbProof: ProofEqualDiscreteCoordinates
  ) {}
  serialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
  deserialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
}

class SMPMessage3 implements ISMPMessage {
  constructor(
    readonly pa: MultiplicativeGroup,
    readonly qa: MultiplicativeGroup,
    readonly paqaProof: ProofEqualDiscreteCoordinates,
    readonly ra: MultiplicativeGroup,
    readonly raProof: ProofEqualDiscreteLogs
  ) {}
  serialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
  deserialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
}

class SMPMessage4 implements ISMPMessage {
  constructor(
    readonly rb: MultiplicativeGroup,
    readonly rbProof: ProofEqualDiscreteLogs
  ) {}
  serialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
  deserialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
}

// TODO:
//  - Add SMPStateMachine according to the spec.
//  - Validate parameters.
//  - Make sure modulus is correct(using p or q).
//  - Refactor
class SMPState {
  config: Config;

  // SMP secret
  x: BN;

  // Public
  g1: MultiplicativeGroup;
  q: BN;

  // Our secrets
  s2?: BN;
  s3?: BN;

  // Ours(L means local) on the wire
  g2L?: MultiplicativeGroup;
  g3L?: MultiplicativeGroup;
  pL?: MultiplicativeGroup;
  qL?: MultiplicativeGroup;
  rL?: MultiplicativeGroup;

  // Theirs(R means remote) on the wire
  g2R?: MultiplicativeGroup;
  g3R?: MultiplicativeGroup;
  pR?: MultiplicativeGroup;
  qR?: MultiplicativeGroup;
  rR?: MultiplicativeGroup;

  // DH shared
  r?: MultiplicativeGroup;
  g2?: MultiplicativeGroup;
  g3?: MultiplicativeGroup;

  constructor(config: Config, x: BN) {
    this.config = config;
    this.x = x;
    this.g1 = config.g;
    this.q = config.q;
  }

  getHashFunc(this: SMPState, version: BN): THashFunc {
    return (...args: BN[]): BN => {
      return sha256ToInt(this.config.modulusSize, version, ...args);
    };
  }

  getRandomSecret(): BN {
    const buf = randomBytes(this.config.modulusSize);
    return new BN(buf.toString('hex'), 'hex').umod(this.config.modulus);
  }

  makeDHPubkey(
    version: BN,
    secretKey: BN
  ): [MultiplicativeGroup, ProofDiscreteLog] {
    const pubkey = this.g1.exponentiate(secretKey);
    const proof = makeProofDiscreteLog(
      this.getHashFunc(version),
      this.g1,
      secretKey,
      this.getRandomSecret(),
      this.q
    );
    return [pubkey, proof];
  }

  makeG2L(version: BN): [MultiplicativeGroup, ProofDiscreteLog] {
    if (this.s2 === undefined) {
      throw new Error('require `s2` to be set');
    }
    return this.makeDHPubkey(version, this.s2);
  }

  makeG3L(version: BN): [MultiplicativeGroup, ProofDiscreteLog] {
    if (this.s3 === undefined) {
      throw new Error('require `s3` to be set');
    }
    return this.makeDHPubkey(version, this.s3);
  }

  verifyDHPubkey(
    version: BN,
    pubkey: MultiplicativeGroup,
    proof: ProofDiscreteLog
  ): boolean {
    return verifyProofDiscreteLog(
      this.getHashFunc(version),
      proof,
      this.g1,
      pubkey
    );
  }

  makeDHSharedSecret(
    g: MultiplicativeGroup,
    secretKey: BN
  ): MultiplicativeGroup {
    return g.exponentiate(secretKey);
  }

  makePLQL(
    version: BN
  ): [MultiplicativeGroup, MultiplicativeGroup, ProofEqualDiscreteCoordinates] {
    if (this.g2 === undefined || this.g3 === undefined) {
      throw new Error('require `g2` and `g3` to be set');
    }
    const randomValue = this.getRandomSecret();
    const pL = this.g3.exponentiate(randomValue);
    const qL = this.g1
      .exponentiate(randomValue)
      .operate(this.g2.exponentiate(this.x));
    const proof = makeProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      this.g3,
      this.g1,
      this.g2,
      randomValue,
      this.x,
      this.getRandomSecret(),
      this.getRandomSecret(),
      this.q
    );
    return [pL, qL, proof];
  }

  verifyPRQRProof(
    version: BN,
    pR: MultiplicativeGroup,
    qR: MultiplicativeGroup,
    proof: ProofEqualDiscreteCoordinates
  ): boolean {
    if (this.g2 === undefined || this.g3 === undefined) {
      throw new Error('require `g2` and `g3` to be set');
    }
    return verifyProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      this.g3,
      this.g1,
      this.g2,
      pR,
      qR,
      proof
    );
  }

  makeRL(
    version: BN,
    isInitiator: boolean
  ): [MultiplicativeGroup, ProofEqualDiscreteLogs] {
    if (
      this.qL === undefined ||
      this.qR === undefined ||
      this.s3 === undefined
    ) {
      throw new Error('require `qL`, `qR`, and `s3` to be set');
    }
    let qInitiatorDivResponder: MultiplicativeGroup;
    if (isInitiator) {
      qInitiatorDivResponder = this.qL.operate(this.qR.inverse());
    } else {
      qInitiatorDivResponder = this.qR.operate(this.qL.inverse());
    }
    const rL = qInitiatorDivResponder.exponentiate(this.s3);
    const raProof = makeProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qInitiatorDivResponder,
      this.s3,
      this.getRandomSecret(),
      this.q
    );
    return [rL, raProof];
  }

  verifyRR(
    version: BN,
    rR: MultiplicativeGroup,
    proof: ProofEqualDiscreteLogs,
    isInitiator: boolean
  ): boolean {
    if (
      this.qL === undefined ||
      this.qR === undefined ||
      this.g3R === undefined
    ) {
      throw new Error('require `qL`, `qR`, and `g3R` to be set');
    }
    let qInitiatorDivResponder: MultiplicativeGroup;
    if (isInitiator) {
      qInitiatorDivResponder = this.qL.operate(this.qR.inverse());
    } else {
      qInitiatorDivResponder = this.qR.operate(this.qL.inverse());
    }
    return verifyProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qInitiatorDivResponder,
      this.g3R,
      rR,
      proof
    );
  }

  makeR(): MultiplicativeGroup {
    if (this.rR === undefined || this.s3 === undefined) {
      throw new Error('require `rR`, `s3` to be set');
    }
    return this.rR.exponentiate(this.s3);
  }

  getResult(isInitiator: boolean): boolean {
    if (
      this.r === undefined ||
      this.pL === undefined ||
      this.pR === undefined
    ) {
      throw new Error('require `r`, `pL`, and `pR` to be set');
    }
    let pInitiatorDivResponder: MultiplicativeGroup;
    if (isInitiator) {
      pInitiatorDivResponder = this.pL.operate(this.pR.inverse());
    } else {
      pInitiatorDivResponder = this.pR.operate(this.pL.inverse());
    }
    return this.r.equal(pInitiatorDivResponder);
  }
}

class InvalidState extends Error {}
class InvalidElement extends Error {}
class InvalidProof extends Error {}

class SMPStateMachine {
  step: Step;
  state: SMPState;

  constructor(readonly config: Config, readonly x: BN) {
    this.step = Step.SMPSTATE_EXPECT1;
    this.state = new SMPState(config, x);
    this.state.s2 = this.state.getRandomSecret();
    this.state.s3 = this.state.getRandomSecret();
  }

  private verifyMultiplicativeGroup(g: MultiplicativeGroup): boolean {
    // 2 <= g.value <= (modulus - 2)
    return g.value.gtn(1) && g.value.lt(this.config.modulus.subn(1));
  }

  beginSMP(): SMPMessage1 {
    /* Step 0: Alice initaites smp, sending `g2a`, `g3a` to Bob. */
    if (this.step !== Step.SMPSTATE_EXPECT1) {
      throw new InvalidState();
    }
    const [g2a, g2aProof] = this.state.makeG2L(new BN(1));
    const [g3a, g3aProof] = this.state.makeG3L(new BN(2));
    this.state.g2L = g2a;
    this.state.g3L = g3a;
    const msg1 = new SMPMessage1(g2a, g2aProof, g3a, g3aProof);
    // Advance the step
    this.step = Step.SMPSTATE_EXPECT2;
    return msg1;
  }

  handleSMPMessage1(msg1: SMPMessage1): SMPMessage2 {
    /*
      Step 1: Bob verifies received data, makes its slice of DH, and sends
      `g2b`, `g3b`, `Pb`, `Qb` to Alice.
    */
    if (this.step !== Step.SMPSTATE_EXPECT1) {
      throw new InvalidState();
    }
    // Verify pubkey's value
    if (
      !this.verifyMultiplicativeGroup(msg1.g2a) ||
      !this.verifyMultiplicativeGroup(msg1.g3a)
    ) {
      throw new InvalidElement();
    }
    // Verify the proofs
    if (!this.state.verifyDHPubkey(new BN(1), msg1.g2a, msg1.g2aProof)) {
      throw new InvalidProof();
    }
    if (!this.state.verifyDHPubkey(new BN(2), msg1.g3a, msg1.g3aProof)) {
      throw new InvalidProof();
    }
    // Save the slices
    this.state.g2R = msg1.g2a;
    this.state.g3R = msg1.g3a;
    // Calculate its DH slice
    const [g2b, g2bProof] = this.state.makeG2L(new BN(3));
    const [g3b, g3bProof] = this.state.makeG3L(new BN(4));
    this.state.g2L = g2b;
    this.state.g3L = g3b;
    // Perform DH
    if (this.state.s2 === undefined || this.state.s3 === undefined) {
      throw new Error('secrets s2 and s3 should have been created');
    }
    this.state.g2 = this.state.makeDHSharedSecret(msg1.g2a, this.state.s2);
    this.state.g3 = this.state.makeDHSharedSecret(msg1.g3a, this.state.s3);
    // Make `Pb` and `Qb`
    const [pb, qb, pbqbProof] = this.state.makePLQL(new BN(5));
    this.state.pL = pb;
    this.state.qL = qb;

    const msg2 = new SMPMessage2(
      g2b,
      g2bProof,
      g3b,
      g3bProof,
      pb,
      qb,
      pbqbProof
    );
    // Advance the step
    this.step = Step.SMPSTATE_EXPECT3;

    return msg2;
  }

  handleSMPMessage2(msg2: SMPMessage2): SMPMessage3 {
    if (this.step !== Step.SMPSTATE_EXPECT2) {
      throw new InvalidState();
    }
    // Verify
    if (
      !this.verifyMultiplicativeGroup(msg2.g2b) ||
      !this.verifyMultiplicativeGroup(msg2.g3b) ||
      !this.verifyMultiplicativeGroup(msg2.pb) ||
      !this.verifyMultiplicativeGroup(msg2.qb)
    ) {
      throw new InvalidElement();
    }
    if (!this.state.verifyDHPubkey(new BN(3), msg2.g2b, msg2.g2bProof)) {
      throw new InvalidProof();
    }
    if (!this.state.verifyDHPubkey(new BN(4), msg2.g3b, msg2.g3bProof)) {
      throw new InvalidProof();
    }
    // Perform DH
    if (this.state.s2 === undefined || this.state.s3 === undefined) {
      throw new Error('secrets s2 and s3 should have been created');
    }
    this.state.g2 = this.state.makeDHSharedSecret(msg2.g2b, this.state.s2);
    this.state.g3 = this.state.makeDHSharedSecret(msg2.g3b, this.state.s3);
    if (
      !this.state.verifyPRQRProof(new BN(5), msg2.pb, msg2.qb, msg2.pbqbProof)
    ) {
      throw new InvalidProof();
    }
    // Save DH slices
    this.state.g2R = msg2.g2b;
    this.state.g3R = msg2.g3b;
    this.state.pR = msg2.pb;
    this.state.qR = msg2.qb;
    // Calculate `Pa` and `Qa`
    const [pa, qa, paqaProof] = this.state.makePLQL(new BN(6));
    this.state.pL = pa;
    this.state.qL = qa;
    // Calculate `Ra`
    const [ra, raProof] = this.state.makeRL(new BN(7), true);
    this.state.rL = ra;

    const msg3 = new SMPMessage3(pa, qa, paqaProof, ra, raProof);
    // Advance the step
    this.step = Step.SMPSTATE_EXPECT4;

    return msg3;
  }

  handleSMPMessage3(msg3: SMPMessage3): SMPMessage4 {
    if (this.step !== Step.SMPSTATE_EXPECT3) {
      throw new InvalidState();
    }
    // Verify
    if (
      !this.verifyMultiplicativeGroup(msg3.pa) ||
      !this.verifyMultiplicativeGroup(msg3.qa) ||
      !this.verifyMultiplicativeGroup(msg3.ra)
    ) {
      throw new InvalidElement();
    }
    if (
      !this.state.verifyPRQRProof(new BN(6), msg3.pa, msg3.qa, msg3.paqaProof)
    ) {
      throw new InvalidProof();
    }
    // NOTE: `Pa` is Bob's `Pb`
    this.state.pR = msg3.pa;
    this.state.qR = msg3.qa;
    // `Ra`
    if (!this.state.verifyRR(new BN(7), msg3.ra, msg3.raProof, false)) {
      throw new InvalidProof();
    }
    // NOTE: `Ra` is Bob's `Rb`
    this.state.rR = msg3.ra;
    // Calculate `Rb`
    const [rb, rbProof] = this.state.makeRL(new BN(8), false);
    // NOTE: `Rb` is Bob's `Ra`
    this.state.rL = rb;
    // Calculate `Rab`
    this.state.r = this.state.makeR();
    const msg4 = new SMPMessage4(rb, rbProof);
    // Advance the step
    // TODO: probably we just set something as finished here?
    this.step = Step.SMPSTATE_EXPECT1;
    return msg4;
  }
  handleSMPMessage4(msg4: SMPMessage4): void {
    if (this.step !== Step.SMPSTATE_EXPECT4) {
      throw new InvalidState();
    }
    // Verify
    if (!this.verifyMultiplicativeGroup(msg4.rb)) {
      throw new InvalidElement();
    }
    if (!this.state.verifyRR(new BN(8), msg4.rb, msg4.rbProof, true)) {
      throw new InvalidProof();
    }
    this.state.rR = msg4.rb;
    // Calculate `Rab`
    this.state.r = this.state.makeR();
    // Advance the step
    // TODO: probably we just set something as finished here?
    this.step = Step.SMPSTATE_EXPECT1;
  }
}

export { SMPState, SMPStateMachine };
