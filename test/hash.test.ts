import BN from 'bn.js';

import { sha256ToInt } from '../src/hash';
import { defaultConfig } from '../src/config';

describe('version', () => {
  const intSize = defaultConfig.modulusSize;
  test('hardcoded test', () => {
    expect(sha256ToInt(intSize, new BN(1))).toEqual(
      new BN(
        '57153b76f61c2badabeb23203d690a2fe5509e76d1196658af70b2daf62c1aec',
        'hex'
      )
    );
  });
});
