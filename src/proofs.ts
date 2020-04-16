/*
  hash
  {make|verify}proofDiscreteLog
  {make|verify}proofEqualDiscreteCoordinates
  {make|verify}proofEqualDiscreteLogs
*/

import BN from 'bn.js';
import { MultiplicativeGroup } from 'multiplicativeGroup';

type hashFuncType = (version: BN, ...args: BN[]) => BN;
type ProofDiscreteLog = { c: BN; d: BN };
// type ProofEqualDiscreteCoordinates = {c: BN, d0: BN, d1: BN};
// type ProofEqualDiscreteLogs = {c: BN, d: BN};

function makeProofDiscreteLog(
  version: BN,
  hashFunc: hashFuncType,
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
  hashFunc: hashFuncType,
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

export { makeProofDiscreteLog, verifyProofDiscreteLog };
