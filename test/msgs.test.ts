import * as TCP from 'net';
import BN from 'bn.js';

import { smpHash } from '../src/hash';
import {
  Byte,
  Short,
  Int,
  MPI,
  TLV,
  concatUint8Array,
  BaseSMPMessage,
  SMPMessage1,
  SMPMessage2,
  SMPMessage3,
  SMPMessage4,
} from '../src/msgs';
import { multiplicativeGroupFactory, secretFactory } from '../src/factories';
import { ValueError, FailedToReadData } from '../src/exceptions';
import { MultiplicativeGroup } from '../src/multiplicativeGroup';
import {
  makeProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
} from '../src/proofs';

describe('Fixed types', () => {
  const types = [Byte, Short, Int];
  test('succeeds', () => {
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
  test('succeeds', () => {
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
    // Length too short
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 1, 1, 1]));
    }).toThrowError(ValueError);
    // Length too long
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 2, 0]));
    }).toThrowError(ValueError);
  });
});

describe('TLV', () => {
  test('succeeds', () => {
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

  test('readFromSocket', async () => {
    const sendTLV = async (bytes: Uint8Array): Promise<void> => {
      const ip = '127.0.0.1';
      const port = 4000;

      const server = TCP.createServer((sock: TCP.Socket) => {
        sock.write(bytes);
      });
      server.listen(port, ip);
      const sockClient = new TCP.Socket();
      return new Promise((resolve, reject) => {
        sockClient.connect(port, ip, () => {});
        sockClient.on('readable', () => {
          try {
            TLV.readFromSocket(sockClient);
          } catch (e) {
            reject(e);
          } finally {
            server.close();
            sockClient.destroy();
          }
          resolve();
        });
      });
    };
    // Correct format
    const correctBytes = new Uint8Array([0, 0, 0, 2, 2, 3]);
    await sendTLV(correctBytes);
    // Wrong format
    const corruptedBytes = new Uint8Array([0, 0, 0, 2, 2]);
    await expect(sendTLV(corruptedBytes)).rejects.toThrowError(
      FailedToReadData
    );
  });
  test('deserialize fails', () => {
    // Empty
    expect(() => {
      TLV.deserialize(new Uint8Array([]));
    }).toThrowError(ValueError);
    // Wrong length
    expect(() => {
      TLV.deserialize(new Uint8Array([0, 0, 0, 3, 1, 1]));
    }).toThrowError(ValueError);
  });
});

describe('BaseSMPMessage', () => {
  test('getMPIsfromTLV succeeds', () => {
    const bytes = new Uint8Array([
      0,
      0,
      0,
      2, // Int: length=2
      0,
      0,
      0,
      1,
      1, // 1
      0,
      0,
      0,
      1,
      2, // 2
    ]);
    const type = new Short(0);
    const tlv = new TLV(type, bytes);
    const mpis = BaseSMPMessage.getMPIsfromTLV(type, 2, tlv);
    expect(mpis[0].value.eqn(1)).toBeTruthy();
    expect(mpis[1].value.eqn(2)).toBeTruthy();
  });
  test('getMPIsfromTLV fails', () => {
    const bytes = new Uint8Array([
      0,
      0,
      0,
      2, // Int: length=2
      0,
      0,
      0,
      1,
      1, // 1
      0,
      0,
      0,
      1,
      2, // 2
    ]);
    const type = new Short(0);
    const tlv = new TLV(type, bytes);
    const typeAnother = new Short(1);
    // Wrong type
    expect(() => {
      BaseSMPMessage.getMPIsfromTLV(typeAnother, 2, tlv);
    }).toThrowError(ValueError);
    // Wrong length
    expect(() => {
      BaseSMPMessage.getMPIsfromTLV(type, 3, tlv);
    }).toThrowError(ValueError);
    // Invalid MPI format
    const wrongMPIs = new Uint8Array([
      0,
      0,
      0,
      1, // length=1
      0,
    ]);
    const wrongTLV = new TLV(type, wrongMPIs);
    expect(() => {
      BaseSMPMessage.getMPIsfromTLV(type, 2, wrongTLV);
    }).toThrowError(ValueError);
  });
});

const version = 1;

function hash(...args: BN[]): BN {
  return smpHash(version, ...args);
}

describe('SMPMessages', () => {
  const areSMPMessagesEqual = (
    a: BaseSMPMessage,
    b: BaseSMPMessage
  ): boolean => {
    if (a.wireValues.length !== b.wireValues.length) {
      return false;
    }
    for (const index in a.wireValues) {
      const aField = a.wireValues[index];
      const bField = a.wireValues[index];
      if (aField instanceof BN && bField instanceof BN) {
        return aField.eq(bField);
      } else if (
        aField instanceof MultiplicativeGroup &&
        bField instanceof MultiplicativeGroup
      ) {
        return aField.equal(bField);
      } else {
        return false;
      }
    }
    return true;
  };
  const g = multiplicativeGroupFactory();
  const bn = secretFactory();
  const q = secretFactory();
  const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
  const proofEDC = makeProofEqualDiscreteCoordinates(
    hash,
    g,
    g,
    g,
    bn,
    bn,
    bn,
    bn,
    q
  );
  const proofEDL = makeProofEqualDiscreteLogs(hash, g, g, bn, bn, q);

  test('SMPMessage1 succeeds', () => {
    const g = multiplicativeGroupFactory();
    const bn = secretFactory();
    const q = secretFactory();
    const proofDiscreteLog = makeProofDiscreteLog(hash, g, bn, bn, q);
    const msg = new SMPMessage1(g, proofDiscreteLog, g, proofDiscreteLog);
    expect(
      areSMPMessagesEqual(msg, SMPMessage1.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage2 succeeds', () => {
    const msg = new SMPMessage2(
      g,
      proofDiscreteLog,
      g,
      proofDiscreteLog,
      g,
      g,
      proofEDC
    );
    expect(
      areSMPMessagesEqual(msg, SMPMessage2.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage3 succeeds', () => {
    const msg = new SMPMessage3(g, g, proofEDC, g, proofEDL);
    expect(
      areSMPMessagesEqual(msg, SMPMessage3.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
  test('SMPMessage4 succeeds', () => {
    const msg = new SMPMessage4(g, proofEDL);
    expect(
      areSMPMessagesEqual(msg, SMPMessage4.fromTLV(msg.toTLV(), q))
    ).toBeTruthy();
  });
});
