import BN from 'bn.js';

import { Byte, Short, Int, MPI, TLV, concatUint8Array } from '../src/msgs';
import { ValueError } from '../src/exceptions';

// TODO: Add failure cases
// TODO: Add tests for `SMPMessage`s

describe('Fixed types', () => {
  const types = [Byte, Short, Int];
  test('hardcoded test', () => {
    const expectedSize = [1, 2, 4];
    const expectedValue = [255, 255, 255];
    const expectedSerialized = [
      new Uint8Array([255]),
      new Uint8Array([0, 255]),
      new Uint8Array([0, 0, 0, 255]),
    ];
    for (const index in types) {
      const Type = types[index];
      const b = new Type(expectedValue[index]);
      expect(Type.size).toEqual(expectedSize[index]);
      expect(b.value).toEqual(expectedValue[index]);
      expect(b.serialize()).toEqual(expectedSerialized[index]);
      expect(b.value).toEqual(
        Type.deserialize(expectedSerialized[index]).value
      );
    }
  });
  test('constructor fails', () => {
    // Too large
    for (const index in types) {
      const Type = types[index];
      expect(() => {
        new Type(2 ** (Type.size * 8));
      }).toThrowError(ValueError);
    }
    // Negative
    for (const Type of types) {
      expect(() => {
        new Type(-1);
      }).toThrowError(ValueError);
    }
  });
});

describe('MPI(variable-length integer)', () => {
  test('hardcoded test', () => {
    const values = [
      new BN(0),
      new BN(256),
      new BN(2).pow(new BN(64)).subn(1), // 2**64 - 1
    ];
    const expectedSerialized = [
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0]),
      new Uint8Array([0, 0, 0, 8, 255, 255, 255, 255, 255, 255, 255, 255]),
    ];
    for (const index in values) {
      const mpi = new MPI(values[index]);
      const expected = expectedSerialized[index];
      expect(mpi.serialize()).toEqual(expected);
      expect(MPI.deserialize(expected).value.eq(mpi.value));
    }
  });
  test('consume', () => {
    const bytes = concatUint8Array(
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0])
    );
    const [mpi1, bytesRemaining] = MPI.consume(bytes);
    expect(mpi1.value.eqn(0)).toBeTruthy();
    const [mpi2, bytesRemaining2] = MPI.consume(bytesRemaining);
    expect(mpi2.value.eqn(256)).toBeTruthy();
    expect(() => {
      MPI.consume(bytesRemaining2);
    }).toThrowError(ValueError);
    // We can consume only the prefix, i.e. [0, 0, 0, 1, 1].
    const b = new Uint8Array([0, 0, 0, 1, 1, 1]);
    const [mpi3, bRemaining] = MPI.consume(b);
    expect(() => {
      expect(mpi3.value.eqn(1)).toBeTruthy();
      expect(bRemaining).toEqual(new Uint8Array([1]));
    });
  });
  test('constructor fails', () => {
    // Negative
    expect(() => {
      new MPI(new BN(-1));
    }).toThrowError(ValueError);
  });
  test('deserialize fails', () => {
    // Empty
    expect(() => {
      MPI.deserialize(new Uint8Array([]));
    }).toThrowError(ValueError);
    // Wrong length
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 1, 1, 1]));
    }).toThrowError(ValueError);
  });
});

describe('TLV', () => {
  const types = [new Short(3), new Short(5), new Short(7)];
  const values = [
    new Uint8Array([5566, 5577]),
    new Uint8Array([1, 2, 3, 4, 5]),
    new Uint8Array([]),
  ];
  const expectedSerialized = [
    new Uint8Array([0, 3, 0, 2, 5566, 5577]),
    new Uint8Array([0, 5, 0, 5, 1, 2, 3, 4, 5]),
    new Uint8Array([0, 7, 0, 0]),
  ];
  test('hardcoded test', () => {
    for (const index in values) {
      const type = types[index];
      const value = values[index];
      const tlv = new TLV(type, value);
      const expected = expectedSerialized[index];
      expect(tlv.serialize()).toEqual(expected);
      const tlvFromExpected = TLV.deserialize(expected);
      expect(tlvFromExpected.type.value).toEqual(tlv.type.value);
      expect(tlvFromExpected.value).toEqual(tlv.value);
    }
  });
});
