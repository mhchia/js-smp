import BN from 'bn.js';
import { hashToInt } from '../src/hash';

describe('version', () => {
  test('hardcoded test', () => {
    expect(hashToInt(new BN(1))).toEqual(
      new BN(
        '57153b76f61c2badabeb23203d690a2fe5509e76d1196658af70b2daf62c1aec',
        'hex'
      )
    );
  });
  test('versions serve as the prefixes', () => {
    const data1 = new BN(1);
    const data2 = new BN(2);
    const data1HashVersion1 = hashToInt(new BN(1), data1);
    const data1HashVersion2 = hashToInt(new BN(2), data1);
    const data2HashVersion1 = hashToInt(new BN(1), data2);
    expect(data1HashVersion1.eq(data1HashVersion2)).toBeFalsy();
    expect(data1HashVersion1.eq(data2HashVersion1)).toBeFalsy();
  });
});
