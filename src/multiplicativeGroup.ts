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

  // public exponentiate(exponent: BN): AbstractMultiplicativeGroup {
  //   let cur = this;
  //   let y = this.identity();
  //   if (exponent.isNeg()) {
  //     cur = cur.inverse();
  //     exponent = exponent.neg();
  //   }
  // }
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
}

export {IGroup, AbstractMultiplicativeGroup, MultiplicativeGroup};
