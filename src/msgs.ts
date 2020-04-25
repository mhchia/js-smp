import { MultiplicativeGroup } from './multiplicativeGroup';
import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
} from './proofs';
import { ENDIAN } from './constants';
import BN from 'bn.js';

class ParsingError extends Error {}
class ValueError extends ParsingError {}

interface IData {
  serialize(): Uint8Array;
}

// NOTE: a workaround type to make typing work with `createFixedIntClass`.
class BaseSerializable implements IData {
  static deserialize(bytes: Uint8Array): BaseSerializable {
    throw new Error(`not implemented: ${bytes}`); // Make tsc happy
  }
  serialize(): Uint8Array {
    throw new Error('not implemented'); // Make tsc happy
  }
}

class BaseFixedIntClass extends BaseSerializable {
  static size: number;
  constructor(readonly value: number) {
    super();
  }
  static deserialize(bytes: Uint8Array): BaseFixedIntClass {
    throw new Error(`not implemented: ${bytes}`); // Make tsc happy
  }
  serialize(): Uint8Array {
    throw new Error('not implemented'); // Make tsc happy
  }
}

function numberToUint8Array(value: number, size?: number): Uint8Array {
  return new Uint8Array(new BN(value).toArray(ENDIAN, size));
}

function uint8ArrayToNumber(a: Uint8Array): number {
  // the max value of `number` type is `2**53 - 1`
  if (a.length > 6) {
    throw new ValueError();
  }
  return new BN(a).toNumber();
}

function concatUint8Array(a: Uint8Array, b: Uint8Array): Uint8Array {
  let c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

function createFixedIntClass(size: number): typeof BaseFixedIntClass {
  class FixedIntClass extends BaseFixedIntClass {
    static size: number = size;

    static deserialize(bytes: Uint8Array): FixedIntClass {
      if (bytes.length !== size) {
        throw new ValueError();
      }
      return new FixedIntClass(uint8ArrayToNumber(bytes));
    }

    serialize(): Uint8Array {
      return numberToUint8Array(this.value, size);
    }
  }
  return FixedIntClass;
}

const Byte = createFixedIntClass(1);
const Short = createFixedIntClass(2);
const Int = createFixedIntClass(4);

class MPI implements BaseSerializable {
  static lengthSize: number = 4;

  constructor(readonly value: BN) {}

  serialize(): Uint8Array {
    const bytes = new Uint8Array(this.value.toArray(ENDIAN));
    const lenBytes = numberToUint8Array(bytes.length, MPI.lengthSize);
    return concatUint8Array(lenBytes, bytes);
  }

  static consume(bytes: Uint8Array): [MPI, Uint8Array] {
    const len = uint8ArrayToNumber(bytes.slice(0, this.lengthSize));
    if (bytes.length < this.lengthSize + len) {
      throw new ValueError('`bytes` does not long enough for `len`');
    }
    const value = new BN(bytes.slice(this.lengthSize, this.lengthSize + len));
    return [new MPI(value), bytes.slice(this.lengthSize + len)];
  }

  static deserialize(bytes: Uint8Array): MPI {
    const [mpi, bytesRemaining] = this.consume(bytes);
    if (bytesRemaining.length !== 0) {
      throw new ValueError(
        `bytes=${bytes} contains redundant bytes: bytesRemaining=${bytesRemaining}`
      );
    }
    return mpi;
  }
}

class TLV extends BaseSerializable {
  constructor(readonly type: BaseFixedIntClass, readonly value: Uint8Array) {
    super();
  }

  static deserialize(bytes: Uint8Array): TLV {
    const typeSize = Short.size;
    const lengthSize = Short.size;
    const type = Short.deserialize(bytes.slice(0, typeSize));
    const length = Short.deserialize(
      bytes.slice(typeSize, typeSize + lengthSize)
    );
    const expectedTLVTotalSize = typeSize + lengthSize + length.value;
    if (bytes.length < expectedTLVTotalSize) {
      throw new ValueError('`bytes` does not long enough');
    }
    const value = bytes.slice(typeSize + lengthSize, expectedTLVTotalSize);
    return new TLV(type, value);
  }

  serialize(): Uint8Array {
    const typeBytes = this.type.serialize();
    const lengthBytes = new Short(this.value.length).serialize();
    const valueBytes = this.value;
    return concatUint8Array(
      concatUint8Array(typeBytes, lengthBytes),
      valueBytes
    );
  }
}

// TODO:
//  - Use TLV in SMPMessage
//  - Add {de}serialization in SMPState

/*

Type 0: Padding
Type 1: Disconnected
Type 2: SMP Message 1
Type 3: SMP Message 2
Type 4: SMP Message 3
Type 5: SMP Message 4
Type 6: SMP Abort Message
Type 7: SMP Message 1Q
Type 8: Extra symmetric key

type 2 (SMP message 1)
type 3 TLVs (SMP message 2)
type 4 TLVs (SMP message 3)
type 5 TLVs (SMP message 4)
type 6 TLV (SMP abort):
type 7 (SMP message 1Q)

SMP Message TLVs (types 2-5) all carry data sharing the same general format:
  - MPI count (INT)
    - The number of MPIs contained in the remainder of the TLV.
  - MPI 1 (MPI)
    - The first MPI of the TLV, serialized into a byte array.
  - MPI 2 (MPI)
    - The second MPI of the TLV, serialized into a byte array.
*/

function bnToMPI(bn: BN): MPI {
  return new MPI(bn);
}

function multiplicativeGroupToMPI(g: MultiplicativeGroup): MPI {
  return new MPI(g.value);
}

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
  type: BaseFixedIntClass,
  ...elements: (BN | MultiplicativeGroup)[]
): TLV {
  const length = new Int(elements.length);
  let res = length.serialize();
  for (const element of elements) {
    let mpi: MPI;
    if (element instanceof BN) {
      mpi = bnToMPI(element);
    } else {
      mpi = multiplicativeGroupToMPI(element);
    }
    res = concatUint8Array(res, mpi.serialize());
  }
  return new TLV(type, res);
}

abstract class BaseSMPMessage {
  static getMPIsfromTLV(
    type: BaseFixedIntClass,
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
  static fromTLV(tlv: TLV, groupOrder: BN): BaseSMPMessage {
    throw new Error(`not implemented: ${tlv}, ${groupOrder}`);
  }
  abstract toTLV(): TLV;
}

// const TLVTypePadding = new Short(0);
const TLVTypeSMPMessage1 = new Short(2);
const TLVTypeSMPMessage2 = new Short(3);
const TLVTypeSMPMessage3 = new Short(4);
const TLVTypeSMPMessage4 = new Short(5);
// const TLVTypeSMPMessageAbort = new Short(6);
// const TLVTypeSMPMessage1Q = new Short(7);

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

export {
  BaseSMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
  Byte,
  Short,
  Int,
  MPI,
  TLV,
};
