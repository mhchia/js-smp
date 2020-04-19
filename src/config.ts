import BN from 'bn.js';

import { MODULUS, MODULUS_BITS, GENERATOR, ENDIAN } from './constants';
import { MultiplicativeGroup } from './multiplicativeGroup';

const modulusInt = new BN(MODULUS.replace('\n', '').replace(' ', ''), 'hex');

type Config = {
  modulus: BN;
  modulusSize: number;
  q: BN;
  g: MultiplicativeGroup;
  endian: 'be' | 'le';
};

const defaultConfig: Config = {
  modulus: modulusInt,
  modulusSize: MODULUS_BITS / 8, // in bytes
  q: modulusInt.subn(1).divn(2), // q = (p - 1) / 2
  g: new MultiplicativeGroup(modulusInt, new BN(GENERATOR)),
  endian: ENDIAN,
};

export { Config, defaultConfig };
