import BN from 'bn.js';

interface IGroup {
  identity(): IGroup;
  operate(g: IGroup): IGroup;
  inverse(): IGroup;
  exponentiate(exponent: BN): IGroup;
  equal(g: IGroup): boolean;
}

abstract class BaseGroup implements IGroup {
  abstract identity(): BaseGroup;
  abstract operate(g: BaseGroup): BaseGroup;
  abstract inverse(): BaseGroup;
  abstract equal(g: BaseGroup): boolean;
  exponentiate(exponent: BN): BaseGroup {
    let cur: BaseGroup = this;
    let y = this.identity();
    if (exponent.isNeg()) {
      cur = cur.inverse();
      exponent = exponent.neg();
    }
    if (exponent.isZero()) {
      return y;
    }
    while (exponent.gtn(1)) {
      if (exponent.isEven()) {
        cur = cur.operate(cur);
        exponent = exponent.divn(2);
      } else {
        y = cur.operate(y);
        cur = cur.operate(cur);
        exponent = exponent.subn(1).divn(2);
      }
    }
    return y.operate(cur);
  }
}

class MultiplicativeGroup extends BaseGroup {
  constructor(readonly n: BN, readonly value: BN) {
    super();
  }
  isValid(this: MultiplicativeGroup): boolean {
    return this.value.gcd(this.n).eqn(1);
  }
  identity(): MultiplicativeGroup {
    return new MultiplicativeGroup(this.n, new BN(1));
  }
  inverse(): MultiplicativeGroup {
    const value = this.value.invm(this.n);
    return new MultiplicativeGroup(this.n, value);
  }
  operate(g: MultiplicativeGroup): MultiplicativeGroup {
    const value = this.value.mul(g.value);
    return new MultiplicativeGroup(this.n, value.umod(this.n));
  }
  equal(this: MultiplicativeGroup, g: MultiplicativeGroup): boolean {
    return this.n.eq(g.n) && this.value.eq(g.value);
  }
  exponentiate(exponent: BN): MultiplicativeGroup {
    return super.exponentiate(exponent) as MultiplicativeGroup;
  }
}

export { IGroup, MultiplicativeGroup };
