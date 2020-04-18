import BN from 'bn.js';
import { MultiplicativeGroup } from '../src/multiplicativeGroup';

function makeDHPubkey(
  g: MultiplicativeGroup,
  secretKey: BN
): MultiplicativeGroup {
  return g.exponentiate(secretKey);
}

function makeDHSharedSecret(
  gb: MultiplicativeGroup,
  secretKey: BN
): MultiplicativeGroup {
  return gb.exponentiate(secretKey);
}

function makePaQa(
  g1: MultiplicativeGroup,
  g2: MultiplicativeGroup,
  g3: MultiplicativeGroup,
  randomValue: BN,
  smpSecret: BN
): [MultiplicativeGroup, MultiplicativeGroup] {
  const pa = g3.exponentiate(randomValue);
  const qa = g1.exponentiate(randomValue).operate(g2.exponentiate(smpSecret));
  return [pa, qa];
}

function makeRa(
  qa: MultiplicativeGroup,
  qb: MultiplicativeGroup,
  a3: BN
): MultiplicativeGroup {
  return qa.operate(qb.inverse()).exponentiate(a3);
}

function makeRab(rb: MultiplicativeGroup, a3: BN): MultiplicativeGroup {
  return rb.exponentiate(a3);
}

function verifyRab(
  rab: MultiplicativeGroup,
  pa: MultiplicativeGroup,
  pb: MultiplicativeGroup
): boolean {
  return rab.equal(pa.operate(pb.inverse()));
}

export {
  makeDHPubkey,
  makeDHSharedSecret,
  makePaQa,
  makeRa,
  makeRab,
  verifyRab,
};
