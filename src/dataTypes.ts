import * as TCP from 'net';

import { MultiplicativeGroup } from './multiplicativeGroup';
import { ENDIAN } from './constants';
import BN from 'bn.js';

import { concatUint8Array } from './utils';
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

/**
 * Returns the average of two numbers.

 * @param x - The first input number
 * @param y - The second input number
 * @returns The arithmetic mean of `x` and `y`
 *
 */
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

export { BaseFixedInt, Byte, Short, Int, MPI, TLV };
