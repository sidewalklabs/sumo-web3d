// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
declare namespace Chai {
  interface Assertion {
    roughly: RoughAssertion;
  }
}

interface RoughAssertion extends Chai.Assertion {
  (tolerance: number): Chai.Assertion;
}
