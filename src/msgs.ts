import * as TCP from 'net';

import { MultiplicativeGroup } from './multiplicativeGroup';
import {
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
} from './proofs';
import { ENDIAN } from './constants';
import BN from 'bn.js';

import { NotImplemented, ValueError, FailedToReadData } from './exceptions';

// NOTE: a workaround type to make typing work with `createFixedIntClass`.
abstract class BaseSerializable {
  static deserialize(_: Uint8Array): BaseSerializable {
    throw new NotImplemented(); // Make tsc happy
  }
  abstract serialize(): Uint8Array;
}

class BaseFixedInt extends BaseSerializable {
  static size: number;
  constructor(readonly value: number) {
    super();
  }
  static deserialize(_: Uint8Array): BaseFixedInt {
    throw new NotImplemented(); // Make tsc happy
  }
  serialize(): Uint8Array {
    throw new NotImplemented(); // Make tsc happy
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

function createFixedIntClass(size: number): typeof BaseFixedInt {
  class FixedIntClass extends BaseFixedInt {
    static size: number = size;

    constructor(readonly value: number) {
      super(value);
      if (value < 0 || value > 2 ** (size * 8) - 1) {
        throw new ValueError(
          `invalid value: value=${value}, maximum=${2 ** (size * 8) - 1}`
        );
      }
    }

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

  constructor(readonly value: BN) {
    if (value.isNeg()) {
      throw new ValueError('expect non-negative value');
    }
  }

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

  static fromMultiplicativeGroup(g: MultiplicativeGroup): MPI {
    return new MPI(g.value);
  }
}

class TLV extends BaseSerializable {
  constructor(readonly type: BaseFixedInt, readonly value: Uint8Array) {
    super();
  }

  static readFromSocket(socket: TCP.Socket): TLV {
    const typeBytes = socket.read(Short.size);
    if (
      typeBytes === null ||
      (typeBytes instanceof Buffer && typeBytes.length !== Short.size)
    ) {
      throw new FailedToReadData('failed to read type');
    }
    const type = Short.deserialize(typeBytes);
    const lengthBytes = socket.read(Short.size);
    if (
      lengthBytes === null ||
      (lengthBytes instanceof Buffer && lengthBytes.length !== Short.size)
    ) {
      throw new FailedToReadData('failed to read length');
    }
    const length = Short.deserialize(lengthBytes).value;
    const valueBytes = socket.read(length);
    if (
      valueBytes === null ||
      (valueBytes instanceof Buffer && valueBytes.length !== length)
    ) {
      throw new FailedToReadData('failed to read value');
    }
    const value = new Uint8Array(valueBytes);
    return new TLV(type, value);
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
  BaseFixedInt,
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
  concatUint8Array,
};
