import BN from "bn.js";


interface IGroup {
  identity(): IGroup;
  operate(g: IGroup): IGroup;
  inverse(): IGroup;
}

abstract class AbstractMultiplicativeGroup implements IGroup {
  abstract identity(): AbstractMultiplicativeGroup;
  abstract operate(g: AbstractMultiplicativeGroup): AbstractMultiplicativeGroup;
  abstract inverse(): AbstractMultiplicativeGroup;
  abstract exponentiate(exponent: BN): AbstractMultiplicativeGroup;
}

class MultiplicativeGroup extends AbstractMultiplicativeGroup {
  constructor (readonly n: BN, readonly value: BN) {
    super();
    if (!value.gcd(n).eqn(1)) {
      throw new Error(
        "n must be coprime to value: " +
        `n=${ n }, value=${value}`
      )
    }
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

  exponentiate(exponent: BN): MultiplicativeGroup {
    let cur: MultiplicativeGroup = this;
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
        exponent = exponent.subn(1).divn(2);
      }
    }
    return y.operate(cur);
  }
}

export {IGroup, AbstractMultiplicativeGroup, MultiplicativeGroup};
