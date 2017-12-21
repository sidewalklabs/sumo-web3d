// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as _ from 'lodash';

/**
 * General geometric operations.
 */

export interface PolyLineDistance {
  d2: number; // square of the distance from point to closest point on the polyline
  dLine: number; // distance along the line (or polyline). May be negative.
  dPerp: number; // perpendicular distance from the line. Negative = point is right of line.
}

function add(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1]];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function vectorNorm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

function scale(v: number[], k: number): number[] {
  return [v[0] * k, v[1] * k];
}

function distance2(a: number[], b: number[]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function distance(a: number[], b: number[]) {
  return Math.sqrt(distance2(a, b));
}

// Determine the closest point on the line segment a->b, its distance along the
// line segment and its distance perpendicular to the line segment.
export function closestPointOnLineSegment(
  a: number[],
  b: number[],
  pt: number[],
): PolyLineDistance {
  // The strategy here is to do a change of basis from the usual x- and y-axes to one where
  // the basis for R2 is (b-a) and a vector perpendicular to (b-a).
  // With that basis, the distance to the line is the perpendicular coordinate.
  const bMinusA = sub(b, a);
  const bAnorm = vectorNorm(bMinusA);
  const ab = scale(bMinusA, 1 / bAnorm);
  const [dx, dy] = ab;
  const ptA = sub(pt, a);

  const dLine = dx * ptA[0] + dy * ptA[1];
  const dPerp = dx * ptA[1] - dy * ptA[0];

  // For an infinite line, we'd only need the last case.
  // But since this is a line segment, we need to check whether the closest point is a or b.
  if (dLine < 0) {
    // Closest point is A.
    return {d2: distance2(a, pt), dLine, dPerp};
  } else if (dLine > bAnorm) {
    // Closest point is B.
    return {d2: distance2(pt, b), dLine, dPerp};
  } else {
    // Closest point is along the line.
    return {d2: dPerp * dPerp, dLine, dPerp};
  }
}

/** Find the distance from a point to the closest point on a polyline. */
export function polylineDistance(
  vertices: number[][],
  pt: number[],
  isClosed = false,
): PolyLineDistance {
  let totalD = 0; // total distance along the polyline.
  let closestD: PolyLineDistance | null = null;

  const lastIndex = isClosed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const thisD = closestPointOnLineSegment(a, b, pt);
    if (!closestD || thisD.d2 < closestD.d2) {
      closestD = thisD;
      closestD.dLine += totalD;
    }
    const len = distance(a, b);
    totalD += len;
  }

  if (!closestD) {
    throw new Error('polylines must have 2+ vertices');
  }

  return closestD;
}

/** Return the point at distance d along a polyline. */
export function pointAlongPolyline(vertices: number[][], d: number, isClosed = false): number[] {
  let totalD = 0; // total distance along the polyline.

  const lastIndex = isClosed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const len = distance(a, b);
    if (totalD + len >= d) {
      const frac = (d - totalD) / len;
      return [a[0] * (1 - frac) + b[0] * frac, a[1] * (1 - frac) + b[1] * frac];
    }
    totalD += len;
  }
  throw new Error('distance is too great for polyline');
}

/** Implementation of parallel offset. A positive amount offsets to the right. */
export function offsetLineSegment(vertices: number[][], amount: number): number[][] {
  if (vertices.length !== 2) {
    throw new Error('offsetLineSegment is only implemented for simple line segments.');
  }
  const [a, b] = vertices;

  const v = sub(b, a);
  const vNorm = scale(v, 1 / vectorNorm(v));
  const vOffset = scale([vNorm[1], -vNorm[0]], amount);
  return [add(a, vOffset), add(b, vOffset)];
}

export function findClosestPoint(point: number[], points: number[][]) {
  return _.minBy(points, element => distance(element, point));
}
