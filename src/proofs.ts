/*
  hash
  {make|verify}proofDiscreteLog
  {make|verify}proofEqualDiscreteCoordinates
  {make|verify}proofEqualDiscreteLogs
*/

import BN from 'bn.js';
import { MultiplicativeGroup } from 'multiplicativeGroup';

type THashFunc = (version: BN, ...args: BN[]) => BN;

type ProofDiscreteLog = { c: BN; d: BN };
type ProofEqualDiscreteCoordinates = { c: BN; d0: BN; d1: BN };
type ProofEqualDiscreteLogs = { c: BN; d: BN };

function makeProofDiscreteLog(
  version: BN,
  hashFunc: THashFunc,
  g: MultiplicativeGroup,
  exponent: BN,
  randomValue: BN,
  q: BN
): ProofDiscreteLog {
  const c = hashFunc(version, g.exponentiate(randomValue).value);
  const d = randomValue.sub(exponent.mul(c)).umod(q);
  return { c: c, d: d };
}

function verifyProofDiscreteLog(
  version: BN,
  hashFunc: THashFunc,
  proof: ProofDiscreteLog,
  g: MultiplicativeGroup,
  y: MultiplicativeGroup
): boolean {
  return proof.c.eq(
    hashFunc(
      version,
      g.exponentiate(proof.d).operate(y.exponentiate(proof.c)).value
    )
  );
}

function makeProofEqualDiscreteCoordinates(
  version: BN,
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  g2: MultiplicativeGroup,
  exponent0: BN,
  exponent1: BN,
  randomValue0: BN,
  randomValue1: BN,
  q: BN
): ProofEqualDiscreteCoordinates {
  const c = hashFunc(
    version,
    g0.exponentiate(randomValue0).value,
    g1.exponentiate(randomValue0).operate(g2.exponentiate(randomValue1)).value
  );
  // d0 = (randomValue0 - exponent0 * c) % q
  const d0 = randomValue0.sub(exponent0.mul(c)).umod(q);
  // d1 = (randomValue1 - exponent1 * c) % q
  const d1 = randomValue1.sub(exponent1.mul(c)).umod(q);
  return { c: c, d0: d0, d1: d1 };
}

function verifyProofEqualDiscreteCoordinates(
  version: BN,
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  g2: MultiplicativeGroup,
  y0: MultiplicativeGroup,
  y1: MultiplicativeGroup,
  proof: ProofEqualDiscreteCoordinates
): boolean {
  return proof.c.eq(
    hashFunc(
      version,
      g0.exponentiate(proof.d0).operate(y0.exponentiate(proof.c)).value,
      g1
        .exponentiate(proof.d0)
        .operate(g2.exponentiate(proof.d1))
        .operate(y1.exponentiate(proof.c)).value
    )
  );
}

function makeProofEqualDiscreteLogs(
  version: BN,
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  exponent: BN,
  randomValue: BN,
  q: BN
): ProofEqualDiscreteLogs {
  const c = hashFunc(
    version,
    g0.exponentiate(randomValue).value,
    g1.exponentiate(randomValue).value
  );
  // d = (randomValue - exponent * c) % q
  const d = randomValue.sub(exponent.mul(c)).umod(q);
  return { c: c, d: d };
}

function verifyProofEqualDiscreteLogs(
  version: BN,
  hashFunc: THashFunc,
  g0: MultiplicativeGroup,
  g1: MultiplicativeGroup,
  y0: MultiplicativeGroup,
  y1: MultiplicativeGroup,
  proof: ProofEqualDiscreteLogs
): boolean {
  return proof.c.eq(
    hashFunc(
      version,
      g0.exponentiate(proof.d).operate(y0.exponentiate(proof.c)).value,
      g1.exponentiate(proof.d).operate(y1.exponentiate(proof.c)).value
    )
  );
}

export {
  THashFunc,
  ProofDiscreteLog,
  ProofEqualDiscreteCoordinates,
  ProofEqualDiscreteLogs,
  makeProofDiscreteLog,
  verifyProofDiscreteLog,
  makeProofEqualDiscreteCoordinates,
  verifyProofEqualDiscreteCoordinates,
  makeProofEqualDiscreteLogs,
  verifyProofEqualDiscreteLogs,
};
