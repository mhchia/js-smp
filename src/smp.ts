import { randomBytes } from 'crypto';

import BN from 'bn.js';

import { MultiplicativeGroup } from './multiplicativeGroup';
import { Config, defaultConfig } from './config';
import { sha256ToInt } from './hash';

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
} from './proofs';

import {
  InvalidElement,
  InvalidProof,
} from './exceptions';


interface ISMPState {
  transit(msg: ISMPMessage | null): [ISMPState, ISMPMessage];
  getResult(): boolean | undefined;
  deserialize(str: string): ISMPMessage;
  serialize(msg: ISMPMessage): string;
}

abstract class BaseSMPState implements ISMPState {
  readonly config: Config;

  // SMP secret
  readonly x: BN;

  // Public
  readonly q: BN;
  readonly g1: MultiplicativeGroup;

  constructor(
    x: BN,
    config: Config = defaultConfig,
  ) {
    this.x = x;
    this.q = config.q;
    this.g1 = config.g;
    this.config = config;
  }

  abstract transit(msg: ISMPMessage | null): [ISMPState, ISMPMessage];
  abstract getResult(): boolean | undefined;

  getHashFunc(this: BaseSMPState, version: BN): THashFunc {
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

  verifyMultiplicativeGroup(g: MultiplicativeGroup): boolean {
    // 2 <= g.value <= (modulus - 2)
    return g.value.gtn(1) && g.value.lt(this.config.modulus.subn(1));
  }

  makePLQL(
    version: BN,
    g2: MultiplicativeGroup,
    g3: MultiplicativeGroup,
  ): [MultiplicativeGroup, MultiplicativeGroup, ProofEqualDiscreteCoordinates] {
    const randomValue = this.getRandomSecret();
    const pL = g3.exponentiate(randomValue);
    const qL = this.g1
      .exponentiate(randomValue)
      .operate(g2.exponentiate(this.x));
    const proof = makeProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      g3,
      this.g1,
      g2,
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
    g2: MultiplicativeGroup,
    g3: MultiplicativeGroup,
    pR: MultiplicativeGroup,
    qR: MultiplicativeGroup,
    proof: ProofEqualDiscreteCoordinates
  ): boolean {
    return verifyProofEqualDiscreteCoordinates(
      this.getHashFunc(version),
      g3,
      this.g1,
      g2,
      pR,
      qR,
      proof
    );
  }

  makeRL(
    version: BN,
    s3: BN,
    qa: MultiplicativeGroup,
    qb: MultiplicativeGroup,
  ): [MultiplicativeGroup, ProofEqualDiscreteLogs] {
    const qaDivQb = qa.operate(qb.inverse());
    const rL = qaDivQb.exponentiate(s3);
    const raProof = makeProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qaDivQb,
      s3,
      this.getRandomSecret(),
      this.q
    );
    return [rL, raProof];
  }

  verifyRR(
    version: BN,
    g3R: MultiplicativeGroup,
    rR: MultiplicativeGroup,
    proof: ProofEqualDiscreteLogs,
    qa: MultiplicativeGroup,
    qb: MultiplicativeGroup
  ): boolean {
    return verifyProofEqualDiscreteLogs(
      this.getHashFunc(version),
      this.g1,
      qa.operate(qb.inverse()),
      g3R,
      rR,
      proof
    );
  }

  makeRab(s3: BN, rR: MultiplicativeGroup): MultiplicativeGroup {
    return rR.exponentiate(s3);
  }
}

class SMPState1 extends BaseSMPState {
  // Our secrets
  s2: BN;
  s3: BN;

  constructor(x: BN, config: Config) {
    super(x, config);
    this.s2 = this.getRandomSecret();
    this.s3 = this.getRandomSecret();
  }
  getResult(): boolean | undefined {
    return undefined;
  }
  transit(msg: SMPMessage1 | null): [ISMPState, SMPMessage1 | SMPMessage2] {
    if (msg === null) {
      /* Step 0: Alice initaites smp, sending `g2a`, `g3a` to Bob. */
      const [g2a, g2aProof] = this.makeDHPubkey(new BN(1), this.s2);
      const [g3a, g3aProof] = this.makeDHPubkey(new BN(2), this.s3);
      const msg = new SMPMessage1(g2a, g2aProof, g3a, g3aProof);
      const state = new SMPState2(this.x, this.config, this.s2, this.s3, g2a, g3a);
      return [state, msg];
    } else {
      /*
        Step 1: Bob verifies received data, makes its slice of DH, and sends
        `g2b`, `g3b`, `Pb`, `Qb` to Alice.
      */
      // Verify pubkey's value
      if (
        !this.verifyMultiplicativeGroup(msg.g2a) ||
        !this.verifyMultiplicativeGroup(msg.g3a)
      ) {
        throw new InvalidElement();
      }
      // Verify the proofs
      if (!this.verifyDHPubkey(new BN(1), msg.g2a, msg.g2aProof)) {
        throw new InvalidProof();
      }
      if (!this.verifyDHPubkey(new BN(2), msg.g3a, msg.g3aProof)) {
        throw new InvalidProof();
      }
      const [g2b, g2bProof] = this.makeDHPubkey(new BN(3), this.s2);
      const [g3b, g3bProof] = this.makeDHPubkey(new BN(4), this.s3);
      const g2 = this.makeDHSharedSecret(msg.g2a, this.s2);
      const g3 = this.makeDHSharedSecret(msg.g3a, this.s3);
      // Make `Pb` and `Qb`
      const [pb, qb, pbqbProof] = this.makePLQL(new BN(5), g2, g3);

      const msg2 = new SMPMessage2(
        g2b,
        g2bProof,
        g3b,
        g3bProof,
        pb,
        qb,
        pbqbProof
      );
      const state = new SMPState3(
        this.x, this.config, this.s2, this.s3, g2b, g3b, g2, g3, msg.g2a, msg.g3a, pb, qb
      );
      return [state, msg2];
    }
  }
}

class SMPState2 extends BaseSMPState {
  constructor(
    x: BN,
    config: Config,
    readonly s2: BN,
    readonly s3: BN,
    readonly g2L: MultiplicativeGroup,
    readonly g3L: MultiplicativeGroup,
  ) {
    super(x, config);
  }
  getResult(): boolean | undefined {
    return undefined;
  }

  transit(msg: SMPMessage2): [ISMPState, SMPMessage3] {
    /*
      Step 2: Alice receives bob's DH slices, P Q, and their proofs.
    */
    // Verify
    if (
      !this.verifyMultiplicativeGroup(msg.g2b) ||
      !this.verifyMultiplicativeGroup(msg.g3b) ||
      !this.verifyMultiplicativeGroup(msg.pb) ||
      !this.verifyMultiplicativeGroup(msg.qb)
    ) {
      throw new InvalidElement();
    }
    if (!this.verifyDHPubkey(new BN(3), msg.g2b, msg.g2bProof)) {
      throw new InvalidProof();
    }
    if (!this.verifyDHPubkey(new BN(4), msg.g3b, msg.g3bProof)) {
      throw new InvalidProof();
    }
    // Perform DH
    const g2 = this.makeDHSharedSecret(msg.g2b, this.s2);
    const g3 = this.makeDHSharedSecret(msg.g3b, this.s3);
    if (!this.verifyPRQRProof(new BN(5), g2, g3, msg.pb, msg.qb, msg.pbqbProof)) {
      throw new InvalidProof();
    }
    // Calculate `Pa` and `Qa`
    const [pa, qa, paqaProof] = this.makePLQL(new BN(6), g2, g3);
    // Calculate `Ra`
    const [ra, raProof] = this.makeRL(new BN(7), this.s3, qa, msg.qb);

    const msg3 = new SMPMessage3(pa, qa, paqaProof, ra, raProof);
    // Advance the step
    const state = new SMPState4(
      this.x, this.config,this.s2,this.s3, this.g2L, this.g3L, msg.g2b, msg.g3b, g2, g3,
      pa,qa,msg.pb,msg.pb, ra
    );

    return [state, msg3];
  }
}

class SMPState3 extends BaseSMPState {
  constructor(
    x: BN,
    config: Config,
    readonly s2: BN,
    readonly s3: BN,
    readonly g2L: MultiplicativeGroup,
    readonly g3L: MultiplicativeGroup,
    readonly g2: MultiplicativeGroup,
    readonly g3: MultiplicativeGroup,
    readonly g2R: MultiplicativeGroup,
    readonly g3R: MultiplicativeGroup,
    readonly pL: MultiplicativeGroup,
    readonly qL: MultiplicativeGroup,
  ) {
    super(x, config);
  }
  getResult(): boolean | undefined {
    return undefined;
  }
  transit(msg: SMPMessage3): [ISMPState, SMPMessage4] {
    /*
      Step 3: Bob receives `Pa`, `Qa`, `Ra` along with their proofs,
      calculates `Rb` and `Rab` accordingly.
    */
    // Verify
    if (
      !this.verifyMultiplicativeGroup(msg.pa) ||
      !this.verifyMultiplicativeGroup(msg.qa) ||
      !this.verifyMultiplicativeGroup(msg.ra)
    ) {
      throw new InvalidElement();
    }
    if (!this.verifyPRQRProof(new BN(6), this.g2, this.g3, msg.pa, msg.qa, msg.paqaProof)) {
      throw new InvalidProof();
    }
    // `Ra`
    if (
      !this.verifyRR(new BN(7), this.g3R, msg.ra, msg.raProof, msg.qa, this.qL)
    ) {
      throw new InvalidProof();
    }
    // Calculate `Rb`
    const [rb, rbProof] = this.makeRL(new BN(8), this.s3, msg.qa, this.qL);
    const msg4 = new SMPMessage4(rb, rbProof);
    // Calculate `Rab`
    const rab = this.makeRab(this.s3, msg.ra);
    const state = new SMPStateFinished(this.x, this.config, msg.pa, this.pL, rab);
    return [state, msg4];
  }
}

class SMPState4 extends BaseSMPState {
  constructor(
    x: BN,
    config: Config,
    readonly s2: BN,
    readonly s3: BN,
    readonly g2L: MultiplicativeGroup,
    readonly g3L: MultiplicativeGroup,
    readonly g2R: MultiplicativeGroup,
    readonly g3R: MultiplicativeGroup,
    readonly g2: MultiplicativeGroup,
    readonly g3: MultiplicativeGroup,
    readonly pL: MultiplicativeGroup,
    readonly qL: MultiplicativeGroup,
    readonly pR: MultiplicativeGroup,
    readonly qR: MultiplicativeGroup,
    readonly rL: MultiplicativeGroup,
  ) {
    super(x, config);
  }
  getResult(): boolean | undefined {
    return undefined;
  }
  transit(msg: SMPMessage4): [ISMPState, ISMPMessage] {
    /*
      Step 4: Alice receives `Rb` and calculate `Rab` as well.
    */
    // Verify
    if (!this.verifyMultiplicativeGroup(msg.rb)) {
      throw new InvalidElement();
    }
    if (
      !this.verifyRR(
        new BN(8),
        this.g3R,
        msg.rb,
        msg.rbProof,
        this.qL,
        this.qR
      )
    ) {
      throw new InvalidProof();
    }
    // Calculate `Rab`
    const rab = this.makeRab(this.s3, msg.rb);
    const state = new SMPStateFinished(this.x, this.config, this.pL, this.pR, rab);
    return [state, new SMPMessageEmpty()];
  }
}

class SMPStateFinished extends BaseSMPState {
  constructor(
    x: BN,
    config: Config,
    readonly pa: MultiplicativeGroup,
    readonly pb: MultiplicativeGroup,
    readonly rab: MultiplicativeGroup,
  ) {
    super(x, config);
  }
  getResult(): boolean {
    return this.rab.equal(
      this.pa.operate(this.pb.inverse())
    );
  }
  transit(_: ISMPMessage): [ISMPState, ISMPMessage] {
    throw new Error("finished");
  }
}


/*
A            B
SMPSTATE_EXPECT1, SMPSTATE_EXPECT1
SMPSTATE_EXPECT2, SMPSTATE_EXPECT1
SMPSTATE_EXPECT2, SMPSTATE_EXPECT3
SMPSTATE_EXPECT4, SMPSTATE_EXPECT3
SMPSTATE_EXPECT4, SMPSTATE_EXPECT1
SMPSTATE_EXPECT1, SMPSTATE_EXPECT1

*/


class SMPStateMachine {
  state: ISMPState;

  constructor(x: BN, config: Config = defaultConfig) {
    this.state = new SMPState1(x, config);
  }

  transit(msg: ISMPMessage | null): ISMPMessage {
    const [newState, retMsg] = this.state.transit(msg);
    this.state = newState;
    return retMsg;
  }
  getResult(): boolean | undefined {
    return this.state.getResult();
  }
}

export { SMPStateMachine };
