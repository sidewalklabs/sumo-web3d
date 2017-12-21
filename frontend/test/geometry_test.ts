// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import {
  closestPointOnLineSegment,
  offsetLineSegment,
  pointAlongPolyline,
  polylineDistance,
} from '../src/geometry';

import {expect} from 'chai';
import * as chai from 'chai';
chai.use(require('chai-roughly'));

describe('geometry', () => {
  const sqrt2 = Math.sqrt(2);

  it('should find the distance to a line segment', () => {
    const a = [1, 0];
    const b = [3, 0];

    // A point to the left of the line.
    expect(closestPointOnLineSegment(a, b, [0, 0])).to.deep.equal({
      d2: 1,
      dLine: -1,
      dPerp: 0,
    });

    // A point to the right of the line.
    expect(closestPointOnLineSegment(a, b, [4, 0])).to.deep.equal({
      d2: 1,
      dLine: 3,
      dPerp: 0,
    });

    // A point above the line.
    expect(closestPointOnLineSegment(a, b, [2, 1])).to.deep.equal({
      d2: 1,
      dLine: 1,
      dPerp: 1,
    });

    // // A point below the line.
    expect(closestPointOnLineSegment(a, b, [2, -1])).to.deep.equal({
      d2: 1,
      dLine: 1,
      dPerp: -1,
    });
  });

  it('should find the distance to a polyline', () => {
    const vertices = [[0, 0], [2, 0], [4, 2]];
    expect(polylineDistance(vertices, [0, 1])).to.deep.equal({
      d2: 1,
      dLine: 0,
      dPerp: 1,
    });

    expect(polylineDistance(vertices, [2, 2])).to.roughly.deep.equal({
      d2: 2,
      dLine: 2 + sqrt2,
      dPerp: sqrt2,
    });

    expect(polylineDistance(vertices, [4, 0])).to.roughly.deep.equal({
      d2: 2,
      dLine: 2 + sqrt2,
      dPerp: -sqrt2,
    });
  });

  it('should find points along polylines', () => {
    const vertices = [[0, 0], [2, 0], [4, 2]];
    expect(pointAlongPolyline(vertices, 0)).to.deep.equal([0, 0]);
    expect(pointAlongPolyline(vertices, 1)).to.deep.equal([1, 0]);
    expect(pointAlongPolyline(vertices, 2)).to.deep.equal([2, 0]);
    expect(pointAlongPolyline(vertices, 2 + sqrt2)).to.roughly.deep.equal([3, 1]);
    expect(pointAlongPolyline(vertices, 2 + 2 * sqrt2)).to.roughly.deep.equal([4, 2]);
  });

  it('should offset line segments', () => {
    const vertices = [[0, 0], [10, 10]];
    expect(offsetLineSegment(vertices, Math.sqrt(2))).to.deep.equal([[1, -1], [11, 9]]);
  });
});
