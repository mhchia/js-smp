import BN from 'bn.js';

import { Byte, Short, Int, MPI } from '../src/msgs';

// TODO: Add failure cases

describe('Fixed types', () => {
  const types = [Byte, Short, Int];
  const expectedSize = [1, 2, 4];
  const expectedValue = [255, 255, 255];
  const expectedSerialized = [
    new Uint8Array([255]),
    new Uint8Array([0, 255]),
    new Uint8Array([0, 0, 0, 255]),
  ];
  test('hardcoded test', () => {
    for (const index in types) {
      const Type = types[index];
      const b = new Type(expectedValue[index]);
      expect(b.size).toEqual(expectedSize[index]);
      expect(b.value).toEqual(expectedValue[index]);
      expect(b.serialize()).toEqual(expectedSerialized[index]);
      expect(b.value).toEqual(
        Type.deserialize(expectedSerialized[index]).value
      );
    }
  });
});

describe('MPI(variable-length integer)', () => {
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
  test('hardcoded test', () => {
    for (const index in values) {
      const mpi = new MPI(values[index]);
      const expected = expectedSerialized[index];
      expect(mpi.serialize()).toEqual(expected);
      expect(MPI.deserialize(expected).value.eq(mpi.value));
    }
  });
});
