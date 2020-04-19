import BN from 'bn.js';

import { MultiplicativeGroup } from '../src/multiplicativeGroup';
import { Config } from '../src/config';
import { sha256ToInt } from '../src/hash';
import { randomBytes } from 'crypto';

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
} from '../src/proofs';

// Contain versions and steps?
class SMPState {
  config: Config;
  isInitiator: boolean;

  // Shared
  g1: MultiplicativeGroup;
  q: BN;

  // Our secrets
  x: BN;
  a2?: BN;
  a3?: BN;
  s?: BN;

  // Our public
  g2a?: MultiplicativeGroup;
  g3a?: MultiplicativeGroup;
  pa?: MultiplicativeGroup;
  qa?: MultiplicativeGroup;
  ra?: MultiplicativeGroup;

  // Their public
  g2b?: MultiplicativeGroup;
  g3b?: MultiplicativeGroup;
  pb?: MultiplicativeGroup;
  qb?: MultiplicativeGroup;
  rb?: MultiplicativeGroup;

  // DH shared
  rab?: MultiplicativeGroup;
  g2?: MultiplicativeGroup;
  g3?: MultiplicativeGroup;

  constructor(config: Config, x: BN, isInitiator: boolean) {
    this.config = config;
    this.x = x;
    this.isInitiator = isInitiator;
    this.g1 = config.g;
    this.q = config.q;
  }

  hash(this: SMPState, version: BN, ...args: BN[]): BN {
    return sha256ToInt(this.config.modulusSize, version, ...args);
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
      version,
      this.hash.bind(this),
      this.g1,
      secretKey,
      this.getRandomSecret(),
      this.q
    );
    return [pubkey, proof];
  }

  makeG2a(version: BN): [MultiplicativeGroup, ProofDiscreteLog] {
    if (this.a2 === undefined) {
      throw new Error('require `a2` to be set');
    }
    return this.makeDHPubkey(version, this.a2);
  }

  makeG3a(version: BN): [MultiplicativeGroup, ProofDiscreteLog] {
    if (this.a3 === undefined) {
      throw new Error('require `a3` to be set');
    }
    return this.makeDHPubkey(version, this.a3);
  }

  verifyDHPubkey(
    version: BN,
    pubkey: MultiplicativeGroup,
    proof: ProofDiscreteLog
  ): boolean {
    return verifyProofDiscreteLog(
      version,
      this.hash.bind(this),
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

  makePaQa(
    version: BN
  ): [MultiplicativeGroup, MultiplicativeGroup, ProofEqualDiscreteCoordinates] {
    if (
      this.g2 === undefined ||
      this.g3 === undefined ||
      this.s === undefined
    ) {
      throw new Error('require `g2`, `g3`, and the secret `s` to be set');
    }
    const pa = this.g3.exponentiate(this.s);
    const qa = this.g1
      .exponentiate(this.s)
      .operate(this.g2.exponentiate(this.x));
    const paQaProof = makeProofEqualDiscreteCoordinates(
      version,
      this.hash.bind(this),
      this.g3,
      this.g1,
      this.g2,
      this.s,
      this.x,
      this.getRandomSecret(),
      this.getRandomSecret(),
      this.q
    );
    return [pa, qa, paQaProof];
  }

  verifyPbQbProof(
    version: BN,
    pb: MultiplicativeGroup,
    qb: MultiplicativeGroup,
    proof: ProofEqualDiscreteCoordinates
  ) {
    if (this.g2 === undefined || this.g3 === undefined) {
      throw new Error('require `g2` and `g3` to be set');
    }
    return verifyProofEqualDiscreteCoordinates(
      version,
      this.hash.bind(this),
      this.g3,
      this.g1,
      this.g2,
      pb,
      qb,
      proof
    );
  }

  makeRa(
    this: SMPState,
    version: BN
  ): [MultiplicativeGroup, ProofEqualDiscreteLogs] {
    if (
      this.qa === undefined ||
      this.qb === undefined ||
      this.a3 === undefined
    ) {
      throw new Error('require `qa`, `qb`, and `a3` to be set');
    }
    let qaDivQb: MultiplicativeGroup;
    if (this.isInitiator) {
      qaDivQb = this.qa.operate(this.qb.inverse());
    } else {
      qaDivQb = this.qb.operate(this.qa.inverse());
    }
    const ra = qaDivQb.exponentiate(this.a3);
    const raProof = makeProofEqualDiscreteLogs(
      version,
      this.hash.bind(this),
      this.g1,
      qaDivQb,
      this.a3,
      this.getRandomSecret(),
      this.q
    );
    return [ra, raProof];
  }

  verifyRb(
    version: BN,
    rb: MultiplicativeGroup,
    proof: ProofEqualDiscreteLogs
  ): boolean {
    if (
      this.qa === undefined ||
      this.qb === undefined ||
      this.g3b === undefined
    ) {
      throw new Error('require `qa`, `qb`, and `g3b` to be set');
    }
    let qaDivQb: MultiplicativeGroup;
    if (this.isInitiator) {
      qaDivQb = this.qa.operate(this.qb.inverse());
    } else {
      qaDivQb = this.qb.operate(this.qa.inverse());
    }
    return verifyProofEqualDiscreteLogs(
      version,
      this.hash.bind(this),
      this.g1,
      qaDivQb,
      this.g3b,
      rb,
      proof
    );
  }

  makeRab(): MultiplicativeGroup {
    if (this.rb === undefined || this.a3 === undefined) {
      throw new Error('require `rb`, `a3` to be set');
    }
    return this.rb.exponentiate(this.a3);
  }

  getResult(): boolean {
    if (
      this.rab === undefined ||
      this.pa === undefined ||
      this.pb === undefined
    ) {
      throw new Error('require `rab`, `pa`, and `pb` to be set');
    }
    let paDivPb: MultiplicativeGroup;
    if (this.isInitiator) {
      paDivPb = this.pa.operate(this.pb.inverse());
    } else {
      paDivPb = this.pb.operate(this.pa.inverse());
    }
    return this.rab.equal(paDivPb);
  }
}

export { SMPState };
