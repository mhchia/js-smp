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
class BaseFixedIntClass implements IData {
  size: number;
  constructor(readonly value: number) {
    this.size = 0; // Make tsc happy
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
  if (a.length > 4) {
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
    size: number;
    constructor(value: number) {
      super(value);
      this.size = size; // Override `size`'s value
    }

    static deserialize(bytes: Uint8Array): FixedIntClass {
      if (bytes.length !== size) {
        throw new ValueError();
      }
      return new FixedIntClass(uint8ArrayToNumber(bytes));
    }

    serialize(): Uint8Array {
      return numberToUint8Array(this.value, this.size);
    }
  }
  return FixedIntClass;
}

const Byte = createFixedIntClass(1);
const Short = createFixedIntClass(2);
const Int = createFixedIntClass(4);

class MPI implements IData {
  static sizeLength: number = 4;

  constructor(readonly value: BN) {}

  serialize(): Uint8Array {
    const bytes = new Uint8Array(this.value.toArray(ENDIAN));
    const lenBytes = numberToUint8Array(bytes.length, MPI.sizeLength);
    return concatUint8Array(lenBytes, bytes);
  }
  static deserialize(bytes: Uint8Array): MPI {
    const len = uint8ArrayToNumber(bytes.slice(0, this.sizeLength));
    if (bytes.length < this.sizeLength + len) {
      throw new ValueError('`bytes` does not long enough for `len`');
    }
    const value = new BN(bytes.slice(this.sizeLength, this.sizeLength + len));
    return new MPI(value);
  }
}

// TODO:
//  - TLVs
//  - Use TLV in SMPMessage
//  - Add {de}serialization in SMPState

/*

TLV
  - Type (SHORT)
    - The type of this record. Records with unrecognized types should be ignored.
  - Length (SHORT)
    - The length of the following field
  - Value (len BYTEs) [where len is the value of the Length field]
    - Any pertinent data for the record type.

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


interface ISMPMessage {
  serialize(...args: any[]): any;
  deserialize(...args: any[]): any;
}

class SMPMessageEmpty implements ISMPMessage {
  serialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
  deserialize(...args: any[]): any {
    throw new Error(`Not implemented yet ${args}`);
  }
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

export {
  ISMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
  SMPMessageEmpty,
  Byte,
  Short,
  Int,
  MPI,
};
