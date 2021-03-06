/**
 * SMP state and state machine
 */

import { randomBytes } from 'crypto';

import BN from 'bn.js';
import { sha256 } from 'js-sha256';

import { MultiplicativeGroup } from './multiplicativeGroup';
import { Config, defaultConfig } from './config';
import { smpHash } from './hash';

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
  InvalidGroupElement,
  InvalidProof,
  ValueError,
  NotImplemented,
  SMPNotFinished,
} from './exceptions';

import { SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 } from './msgs';

import { TLV } from './msgs';

type TypeTLVOrNull = TLV | null;

interface ISMPState {
  /**
   * Transit the current state to the next state with the given `msg`.
   * @param msg - A SMP Message of `TLV` format.
   * @returns The next state, and a SMP Message to reply(if any).
   */
  transit(msg: TypeTLVOrNull): [ISMPState, TypeTLVOrNull];
  /**
   * Return the result of SMP protocol.
   * @returns The result if this state has a result(i.e. the protocol is finished). Otherwise,
   *  `null` is returned.
   */
  getResult(): boolean | null;
}

/**
 * Base class for SMP states. `BaseSMPState` contains configs and provides helper functions.
 * `transit` and `getResult` need to be implemented by the subclasses.
 */
abstract class BaseSMPState implements ISMPState {
  // Public
  readonly q: BN;
  readonly g1: MultiplicativeGroup;

  constructor(readonly x: BN, readonly config: Config) {
    this.q = config.q;
    this.g1 = config.g;
    this.config = config;
  }

  abstract transit(msg: TypeTLVOrNull): [ISMPState, TypeTLVOrNull];
  abstract getResult(): boolean | null;

  /**
   * Hash function used by SMP protocol. A `version` is prefixed before inputs.
   */
  getHashFunc(version: number): THashFunc {
    return (...args: BN[]): BN => {
      return smpHash(version, ...args);
    };
  }

  /**
   * Generate a random integer in the range [0, `this.config.modulus`).
   */
  getRandomSecret(): BN {
    const buf = randomBytes(this.config.modulusSize);
    return new BN(buf.toString('hex'), 'hex').umod(this.config.q);
  }

  /**
   * Make Diffie-Hellman public key from secretKey`.
   * @param version - Used when generating the proof.
   * @param secretKey - Our private key.
   */
  makeDHPubkey(
    version: number,
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

  /**
   * Verify a Diffie-Hellman public key with its proof, generated by `makeDHPubkey`.
   */
  verifyDHPubkey(
    version: number,
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

  /**
   * Generate the Diffie-Hellman shared secret with our private key and the public key
   *  from the other.
   * @param g - Public key from the other.
   * @param secretKey - Our private key.
   */
  makeDHSharedSecret(
    g: MultiplicativeGroup,
    secretKey: BN
  ): MultiplicativeGroup {
    return g.exponentiate(secretKey);
  }

  /**
   * Check if a multiplicative group element is valid for SMP protocol.
   * @param g - A multiplicative group element used in SMP protocol.
   */
  verifyMultiplicativeGroup(g: MultiplicativeGroup): boolean {
    // 2 <= g.value <= (modulus - 2)
    return g.value.gtn(1) && g.value.lt(this.config.modulus.subn(1));
  }

  /**
   * Generate our partial `P` and `Q`. They are `Pa` and `Qa` in the spec if we are an initiator,
   *  otherwise, `Pb` and `Qb`. A `ProofEqualDiscreteCoordinates` is generated altogether.
   *
   * @param version - The prefixed version, used when generating the proof.
   * @param g2 - `g2` in the spec.
   * @param g3 - `g3` in the spec.
   */
  makePLQL(
    version: number,
    g2: MultiplicativeGroup,
    g3: MultiplicativeGroup
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

  /**
   * Verify `P` and `Q` from the remote with its the proof, generated by `makePLQL`.
   *
   * @param version - The prefixed version, used when verifying the proof.
   * @param g2 - `g2` in the spec.
   * @param g3 - `g3` in the spec.
   * @param pR - `P` from the remote.
   * @param qR - `Q` from the remote.
   * @param proof - The zk proof for `pR` and `qR`.
   */
  verifyPRQRProof(
    version: number,
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

  /**
   * Generate our partial `R`. It is `Ra`in the spec if we are an initiator, otherwise, `Rb`.
   *
   * @param version - The prefixed version, used when generating the proof.
   * @param s3 - Our 3rd secret.
   * @param qa - `Qa` in the spec.
   * @param qb - `Qb` in the sepc.
   */
  makeRL(
    version: number,
    s3: BN,
    qa: MultiplicativeGroup,
    qb: MultiplicativeGroup
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

  /**
   * Verify the partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   *
   * @param version - The prefixed version, used when verifying the proof.
   * @param g3R - The Diffie-Hellman public key from remote, which is used to generate `g3`.
   * @param rR - Partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   * @param proof - The proof for the partial `R`, which is generated by `makeRL` from remote.
   * @param qa - `Qa` in the spec.
   * @param qb - `Qb` in the spec.
   */
  verifyRR(
    version: number,
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

  /**
   * Generate `Rab` in the spec.
   * @param s3 - The 3rd secret in the spec.
   * @param rR - Partial `R` from the remote. It is `Rb` in the spec if we are an initiator,
   *  otherwise, `Ra`.
   */
  makeRab(s3: BN, rR: MultiplicativeGroup): MultiplicativeGroup {
    return rR.exponentiate(s3);
  }
}

class SMPState1 extends BaseSMPState {
  s2: BN;
  s3: BN;

  constructor(x: BN, config: Config) {
    super(x, config);
    this.s2 = this.getRandomSecret();
    this.s3 = this.getRandomSecret();
  }
  getResult(): boolean | null {
    return null;
  }
  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      /* Step 0: Alice initaites smp, sending `g2a`, `g3a` to Bob. */
      const [g2a, g2aProof] = this.makeDHPubkey(1, this.s2);
      const [g3a, g3aProof] = this.makeDHPubkey(2, this.s3);
      const msg = new SMPMessage1(g2a, g2aProof, g3a, g3aProof);
      const state = new SMPState2(
        this.x,
        this.config,
        this.s2,
        this.s3,
        g2a,
        g3a
      );
      return [state, msg.toTLV()];
    } else {
      /*
        Step 1: Bob verifies received data, makes its slice of DH, and sends
        `g2b`, `g3b`, `Pb`, `Qb` to Alice.
      */
      const msg = SMPMessage1.fromTLV(tlv, this.config.modulus);
      // Verify pubkey's value
      if (
        !this.verifyMultiplicativeGroup(msg.g2a) ||
        !this.verifyMultiplicativeGroup(msg.g3a)
      ) {
        throw new InvalidGroupElement();
      }
      // Verify the proofs
      if (!this.verifyDHPubkey(1, msg.g2a, msg.g2aProof)) {
        throw new InvalidProof();
      }
      if (!this.verifyDHPubkey(2, msg.g3a, msg.g3aProof)) {
        throw new InvalidProof();
      }
      const [g2b, g2bProof] = this.makeDHPubkey(3, this.s2);
      const [g3b, g3bProof] = this.makeDHPubkey(4, this.s3);
      const g2 = this.makeDHSharedSecret(msg.g2a, this.s2);
      const g3 = this.makeDHSharedSecret(msg.g3a, this.s3);
      // Make `Pb` and `Qb`
      const [pb, qb, pbqbProof] = this.makePLQL(5, g2, g3);

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
        this.x,
        this.config,
        this.s2,
        this.s3,
        g2b,
        g3b,
        g2,
        g3,
        msg.g2a,
        msg.g3a,
        pb,
        qb
      );
      return [state, msg2.toTLV()];
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
    readonly g3L: MultiplicativeGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }

  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = SMPMessage2.fromTLV(tlv, this.config.modulus);
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
      throw new InvalidGroupElement();
    }
    if (!this.verifyDHPubkey(3, msg.g2b, msg.g2bProof)) {
      throw new InvalidProof();
    }
    if (!this.verifyDHPubkey(4, msg.g3b, msg.g3bProof)) {
      throw new InvalidProof();
    }
    // Perform DH
    const g2 = this.makeDHSharedSecret(msg.g2b, this.s2);
    const g3 = this.makeDHSharedSecret(msg.g3b, this.s3);
    if (!this.verifyPRQRProof(5, g2, g3, msg.pb, msg.qb, msg.pbqbProof)) {
      throw new InvalidProof();
    }
    // Calculate `Pa` and `Qa`
    const [pa, qa, paqaProof] = this.makePLQL(6, g2, g3);
    // Calculate `Ra`
    const [ra, raProof] = this.makeRL(7, this.s3, qa, msg.qb);

    const msg3 = new SMPMessage3(pa, qa, paqaProof, ra, raProof);
    // Advance the step
    const state = new SMPState4(
      this.x,
      this.config,
      this.s2,
      this.s3,
      this.g2L,
      this.g3L,
      msg.g2b,
      msg.g3b,
      g2,
      g3,
      pa,
      qa,
      msg.pb,
      msg.qb,
      ra
    );

    return [state, msg3.toTLV()];
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
    readonly qL: MultiplicativeGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }
  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = SMPMessage3.fromTLV(tlv, this.config.modulus);
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
      throw new InvalidGroupElement();
    }
    if (
      !this.verifyPRQRProof(6, this.g2, this.g3, msg.pa, msg.qa, msg.paqaProof)
    ) {
      throw new InvalidProof();
    }
    // `Ra`
    if (!this.verifyRR(7, this.g3R, msg.ra, msg.raProof, msg.qa, this.qL)) {
      throw new InvalidProof();
    }
    const [rb, rbProof] = this.makeRL(8, this.s3, msg.qa, this.qL);
    const msg4 = new SMPMessage4(rb, rbProof);
    const rab = this.makeRab(this.s3, msg.ra);
    const state = new SMPStateFinished(
      this.x,
      this.config,
      msg.pa,
      this.pL,
      rab
    );
    return [state, msg4.toTLV()];
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
    readonly rL: MultiplicativeGroup
  ) {
    super(x, config);
  }
  getResult(): boolean | null {
    return null;
  }

  transit(tlv: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    /*
      Step 4: Alice receives `Rb` and calculate `Rab` as well.
    */
    // Verify
    if (tlv === null) {
      throw new ValueError();
    }
    const msg = SMPMessage4.fromTLV(tlv, this.config.modulus);
    if (!this.verifyMultiplicativeGroup(msg.rb)) {
      throw new InvalidGroupElement();
    }
    if (!this.verifyRR(8, this.g3R, msg.rb, msg.rbProof, this.qL, this.qR)) {
      throw new InvalidProof();
    }
    const rab = this.makeRab(this.s3, msg.rb);
    const state = new SMPStateFinished(
      this.x,
      this.config,
      this.pL,
      this.pR,
      rab
    );
    return [state, null];
  }
}

class SMPStateFinished extends BaseSMPState {
  constructor(
    x: BN,
    config: Config,
    readonly pa: MultiplicativeGroup,
    readonly pb: MultiplicativeGroup,
    readonly rab: MultiplicativeGroup
  ) {
    super(x, config);
  }
  getResult(): boolean {
    return this.rab.equal(this.pa.operate(this.pb.inverse()));
  }
  transit(_: TypeTLVOrNull): [ISMPState, TypeTLVOrNull] {
    throw new NotImplemented();
  }
}

type TSecret = number | string | BN | Uint8Array;

/**
 * SMP state machine in the spec. `SMPStateMachine` is initialized, performs state transition with
 *  the supplied SMP messages, and returns the final result when the protocol is complete.
 *
 * NOTE: It is slightly deviated from the spec for implementation reason:
 *  - state transition "SMP Abort" which is used to reset the state to `SMPState1` is omitted.
 *    It's because we can just initialize another `SMPStateMachine` to restart from `SMPState1`.
 *    Check out "SMP Abort Message" in the spec for more details.
 *  - `SMPStateFinished` is the final state, instead of `SMPState1` in the spec. It's the same
 *    reason as above since we don't need to reuse `SMPStateMachine`.
 *
 * TODO: Refactor: It seems `SMPStateFinished` is not necessary. We know SMP protocol is finished
 *  when `transit` returns `null`.
 */
class SMPStateMachine {
  state: ISMPState;

  /**
   * @param x - Our secret to be compared in SMP protocol.
   * @param config - Config for the underlying math and serialization.
   */
  constructor(x: TSecret, config: Config = defaultConfig) {
    this.state = new SMPState1(this.normalizeSecret(x).umod(config.q), config);
  }

  /**
   * Transform the secret from different types to the internal type `BN`. Multiple types are
   * accepted for the secret to make it convenient for users, but we use `BN` internally.
   *
   * @param x - Our SMP secret.
   */
  private normalizeSecret(x: TSecret): BN {
    let res: BN;
    if (typeof x === 'number') {
      res = new BN(x);
    } else if (typeof x === 'string') {
      res = new BN(sha256(x), 'hex');
    } else if (x instanceof Uint8Array) {
      res = new BN(x);
    } else if (x instanceof BN) {
      res = x;
    } else {
      // Sanity check
      throw new ValueError('secret can only be the type of `TSecret`');
    }
    return res;
  }

  // TODO: Add initiate, which makes `transit` get rid of `null`.

  /**
   * Transit our state based on the current state and the input SMP messages.
   *
   * @param msg - Either a `TLV` type SMP message or `null` are accepted. `null` indicates we are
   *  the initiator of the SMP protocol.
   * @returns A `TLV` type SMP message or `null`. `null` is returned when there is nothing to
   *  return.
   *
   * TODO: Probably we don't even need to expose `TLV`. Just make `SMPStateMachine` output or
   *  consume from `Uint8Array`.
   */
  transit(msg: TypeTLVOrNull): TypeTLVOrNull {
    const [newState, retMsg] = this.state.transit(msg);
    this.state = newState;
    return retMsg;
  }

  /**
   * Return the final result.
   *
   * @throws `SMPNotFinished` when SMP protocol is not complete yet.
   */
  getResult(): boolean {
    const result = this.state.getResult();
    if (result === null) {
      throw new SMPNotFinished();
    }
    return result;
  }

  /**
   * Return whether SMP protocol is complete.
   */
  isFinished(): boolean {
    return this.state.getResult() !== null;
  }
}

export { SMPStateMachine, TypeTLVOrNull };
