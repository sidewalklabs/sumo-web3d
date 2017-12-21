// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import {expect} from 'chai';
import {convolve} from '../src/scene-finder';

describe('scene-finder', () => {
  it('should run a convolution', () => {
    const kernel = [[-1, 0.25], [0, 0.5], [+1, 0.25]];
    const xs = [1, 2, 3, 4];
    expect(convolve(xs, kernel)).to.deep.equal([
      0.25 * 4 + 0.5 * 1 + 0.25 * 2,
      0.25 * 1 + 0.5 * 2 + 0.25 * 3,
      0.25 * 2 + 0.5 * 3 + 0.25 * 4,
      0.25 * 3 + 0.5 * 4 + 0.25 * 1,
    ]);
  });
});
