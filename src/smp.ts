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

// TODO:
//  - Add SMPStateMachine according to the spec.
//  - Validate parameters.
//  - Make sure modulus is correct(using p or q).
//  - Refactor
class SMPState {
  config: Config;
  isInitiator: boolean;

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

  constructor(config: Config, x: BN, isInitiator: boolean) {
    this.config = config;
    this.x = x;
    this.isInitiator = isInitiator;
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

  makeRL(version: BN): [MultiplicativeGroup, ProofEqualDiscreteLogs] {
    if (
      this.qL === undefined ||
      this.qR === undefined ||
      this.s3 === undefined
    ) {
      throw new Error('require `qL`, `qR`, and `s3` to be set');
    }
    let qInitiatorDivResponder: MultiplicativeGroup;
    if (this.isInitiator) {
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
    proof: ProofEqualDiscreteLogs
  ): boolean {
    if (
      this.qL === undefined ||
      this.qR === undefined ||
      this.g3R === undefined
    ) {
      throw new Error('require `qL`, `qR`, and `g3R` to be set');
    }
    let qInitiatorDivResponder: MultiplicativeGroup;
    if (this.isInitiator) {
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

  getResult(): boolean {
    if (
      this.r === undefined ||
      this.pL === undefined ||
      this.pR === undefined
    ) {
      throw new Error('require `r`, `pL`, and `pR` to be set');
    }
    let pInitiatorDivResponder: MultiplicativeGroup;
    if (this.isInitiator) {
      pInitiatorDivResponder = this.pL.operate(this.pR.inverse());
    } else {
      pInitiatorDivResponder = this.pR.operate(this.pL.inverse());
    }
    return this.r.equal(pInitiatorDivResponder);
  }
}

export { SMPState };
