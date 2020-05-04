import { MultiplicativeGroup } from './multiplicativeGroup';
import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
} from './proofs';
import BN from 'bn.js';

import { BaseFixedInt, Short, Int, MPI, TLV } from './dataTypes';

import { concatUint8Array } from './utils';
import { NotImplemented, ValueError } from './exceptions';

function deserializeSMPTLV(tlv: TLV): MPI[] {
  let bytes = tlv.value;
  const mpiCount = Int.deserialize(bytes.slice(0, Int.size));
  let bytesRemaining = bytes.slice(Int.size);
  const elements: MPI[] = [];
  let mpi: MPI;
  for (let i = 0; i < mpiCount.value; i++) {
    [mpi, bytesRemaining] = MPI.consume(bytesRemaining);
    elements.push(mpi);
  }
  return elements;
}

function serializeSMPTLV(
  type: BaseFixedInt,
  ...elements: (BN | MultiplicativeGroup)[]
): TLV {
  const length = new Int(elements.length);
  let res = length.serialize();
  for (const element of elements) {
    let mpi: MPI;
    if (element instanceof BN) {
      mpi = new MPI(element);
    } else {
      mpi = MPI.fromMultiplicativeGroup(element);
    }
    res = concatUint8Array(res, mpi.serialize());
  }
  return new TLV(type, res);
}

abstract class BaseSMPMessage {
  abstract wireValues: (BN | MultiplicativeGroup)[];

  static getMPIsfromTLV(
    type: BaseFixedInt,
    expectedLength: number,
    tlv: TLV
  ): MPI[] {
    if (type.value !== tlv.type.value) {
      throw new ValueError(
        `type mismatch: type.value=${type.value}, tlv.type.value=${tlv.type.value}`
      );
    }
    const mpis = deserializeSMPTLV(tlv);
    if (expectedLength !== mpis.length) {
      throw new ValueError(
        `length of tlv=${tlv} mismatches: expectedLength=${expectedLength}`
      );
    }
    return mpis;
  }

  // abstract methods
  static fromTLV(_: TLV, __: BN): BaseSMPMessage {
    throw new NotImplemented();
  }
  abstract toTLV(): TLV;
}

const TLVTypeSMPMessage1 = new Short(2);
const TLVTypeSMPMessage2 = new Short(3);
const TLVTypeSMPMessage3 = new Short(4);
const TLVTypeSMPMessage4 = new Short(5);

class SMPMessage1 extends BaseSMPMessage {
  wireValues: [MultiplicativeGroup, BN, BN, MultiplicativeGroup, BN, BN];

  constructor(
    readonly g2a: MultiplicativeGroup,
    readonly g2aProof: ProofDiscreteLog,
    readonly g3a: MultiplicativeGroup,
    readonly g3aProof: ProofDiscreteLog
  ) {
    super();
    this.wireValues = [
      g2a,
      g2aProof.c,
      g2aProof.d,
      g3a,
      g3aProof.c,
      g3aProof.d,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage1 {
    const mpis = this.getMPIsfromTLV(TLVTypeSMPMessage1, 6, tlv);
    return new SMPMessage1(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      { c: mpis[1].value, d: mpis[2].value },
      new MultiplicativeGroup(groupOrder, mpis[3].value),
      { c: mpis[4].value, d: mpis[5].value }
    );
  }

  toTLV(): TLV {
    return serializeSMPTLV(TLVTypeSMPMessage1, ...this.wireValues);
  }
}

class SMPMessage2 extends BaseSMPMessage {
  wireValues: [
    MultiplicativeGroup,
    BN,
    BN,
    MultiplicativeGroup,
    BN,
    BN,
    MultiplicativeGroup,
    MultiplicativeGroup,
    BN,
    BN,
    BN
  ];

  constructor(
    readonly g2b: MultiplicativeGroup,
    readonly g2bProof: ProofDiscreteLog,
    readonly g3b: MultiplicativeGroup,
    readonly g3bProof: ProofDiscreteLog,
    readonly pb: MultiplicativeGroup,
    readonly qb: MultiplicativeGroup,
    readonly pbqbProof: ProofEqualDiscreteCoordinates
  ) {
    super();
    this.wireValues = [
      g2b,
      g2bProof.c,
      g2bProof.d,
      g3b,
      g3bProof.c,
      g3bProof.d,
      pb,
      qb,
      pbqbProof.c,
      pbqbProof.d0,
      pbqbProof.d1,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage2 {
    const mpis = this.getMPIsfromTLV(TLVTypeSMPMessage2, 11, tlv);
    return new SMPMessage2(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      { c: mpis[1].value, d: mpis[2].value },
      new MultiplicativeGroup(groupOrder, mpis[3].value),
      { c: mpis[4].value, d: mpis[5].value },
      new MultiplicativeGroup(groupOrder, mpis[6].value),
      new MultiplicativeGroup(groupOrder, mpis[7].value),
      { c: mpis[8].value, d0: mpis[9].value, d1: mpis[10].value }
    );
  }

  toTLV(): TLV {
    return serializeSMPTLV(TLVTypeSMPMessage2, ...this.wireValues);
  }
}

class SMPMessage3 extends BaseSMPMessage {
  wireValues: [
    MultiplicativeGroup,
    MultiplicativeGroup,
    BN,
    BN,
    BN,
    MultiplicativeGroup,
    BN,
    BN
  ];

  constructor(
    readonly pa: MultiplicativeGroup,
    readonly qa: MultiplicativeGroup,
    readonly paqaProof: ProofEqualDiscreteCoordinates,
    readonly ra: MultiplicativeGroup,
    readonly raProof: ProofEqualDiscreteLogs
  ) {
    super();
    this.wireValues = [
      pa,
      qa,
      paqaProof.c,
      paqaProof.d0,
      paqaProof.d1,
      ra,
      raProof.c,
      raProof.d,
    ];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage3 {
    const mpis = this.getMPIsfromTLV(TLVTypeSMPMessage3, 8, tlv);
    return new SMPMessage3(
      new MultiplicativeGroup(groupOrder, mpis[0].value),
      new MultiplicativeGroup(groupOrder, mpis[1].value),
      { c: mpis[2].value, d0: mpis[3].value, d1: mpis[4].value },
      new MultiplicativeGroup(groupOrder, mpis[5].value),
      { c: mpis[6].value, d: mpis[7].value }
    );
  }

  toTLV(): TLV {
    return serializeSMPTLV(TLVTypeSMPMessage3, ...this.wireValues);
  }
}

class SMPMessage4 extends BaseSMPMessage {
  wireValues: [MultiplicativeGroup, BN, BN];
  constructor(
    readonly rb: MultiplicativeGroup,
    readonly rbProof: ProofEqualDiscreteLogs
  ) {
    super();
    this.wireValues = [rb, rbProof.c, rbProof.d];
  }

  static fromTLV(tlv: TLV, groupOrder: BN): SMPMessage4 {
    const mpis = this.getMPIsfromTLV(TLVTypeSMPMessage4, 3, tlv);
    return new SMPMessage4(new MultiplicativeGroup(groupOrder, mpis[0].value), {
      c: mpis[1].value,
      d: mpis[2].value,
    });
  }

  toTLV(): TLV {
    return serializeSMPTLV(TLVTypeSMPMessage4, ...this.wireValues);
  }
}

export { BaseSMPMessage, SMPMessage1, SMPMessage2, SMPMessage3, SMPMessage4 };
