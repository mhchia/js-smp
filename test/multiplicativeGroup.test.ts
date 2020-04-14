import BN from "bn.js";
import { MultiplicativeGroup } from "../src/multiplicativeGroup"


// TODO: Add factories

function isEqual(a: MultiplicativeGroup, b: MultiplicativeGroup): boolean {
  return a.n.eq(b.n) && a.value.eq(b.value);
}

describe("constructor", () => {
  test("succeeds", () => {
    // TODO: A more specific error
    expect(() => {new MultiplicativeGroup(new BN(35), new BN(9))}).not.toThrow();
  });
  test("throws when the value and modulus are not co-prime", () => {
    // TODO: A more specific error
    expect(() => {new MultiplicativeGroup(new BN(35), new BN(7))}).toThrow();
  });
});

describe("identity", () => {
  test("hardcoded test", () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    const identityExpected = new MultiplicativeGroup(new BN(35), new BN(1));
    expect(isEqual(mg.identity(), identityExpected)).toBeTruthy();
  });
  test("every group element with the same modulus share the same identity", () => {
    const mg0 = new MultiplicativeGroup(new BN(35), new BN(9));
    const mg1 = new MultiplicativeGroup(new BN(35), new BN(6));
    expect(isEqual(mg0.identity(), mg1.identity())).toBeTruthy();
  });
});

describe("inverse", () => {
  test("hardcoded test", () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    const inverseExpected = new MultiplicativeGroup(new BN(35), new BN(4));
    expect(isEqual(mg.inverse(), inverseExpected)).toBeTruthy();
  });
});

describe("operate", () => {
  test("operate with identity", () => {
    const mg = new MultiplicativeGroup(new BN(35, 10), new BN(9));
    expect(isEqual(mg.operate(mg.identity()), mg)).toBeTruthy();
  });
  test("operate with inverse", () => {
    const mg = new MultiplicativeGroup(new BN(35), new BN(9));
    expect(isEqual(mg.operate(mg.inverse()), mg.identity())).toBeTruthy();
  });
  test("hardcoded test", () => {
    const mg0 = new MultiplicativeGroup(new BN(35), new BN(9));
    const mg1 = new MultiplicativeGroup(new BN(35), new BN(6));
    const mgExpected = new MultiplicativeGroup(new BN(35), new BN(19));
    expect(isEqual(mg0.operate(mg1), mgExpected)).toBeTruthy();
  });
});

