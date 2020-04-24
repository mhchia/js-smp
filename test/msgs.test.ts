import BN from 'bn.js';

import { Byte, Short, Int, MPI, TLV } from '../src/msgs';

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
      expect(Type.size).toEqual(expectedSize[index]);
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
