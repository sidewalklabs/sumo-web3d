// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Coordinate transformations between SUMO and three.js.
 *
 * SUMO uses a coordinate system where the ground is the xy-plane and z points up.
 * Increasing x values go from left to right and increasing y goes from top to bottom.
 * This is a left-handed coordinate system.
 *
 * In three.js, it's conventional to have the ground be the xz-plane and have y point up.
 * To convert between these systems, we invert y (y --> bottom - y) and swap the
 * y and z coordinates. We use (bottom - y) instead of (-y) to keep the coordinates positive.
 */

import * as proj4 from 'proj4';

import {Network} from './api';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Transform {
  left: number;
  top: number;
  bottom: number;
  right: number;
  width(): number;
  height(): number;
  xyToXz(xy: number[]): [number, number];
  xyToXyz(xy: number[]): [number, number, number];
  xzToSumoXy(xz: number[]): [number, number];
  sumoXyzToXyz(xyz: number[]): [number, number, number];
  center(): [number, number];
  latLngToXZ(latLng: LatLng): [number, number] | null;
  toLatLng(xz: number[]): LatLng | null;
}

export function getTransforms(network: Network): Transform {
  const location = network.net.location;
  const [dx, dy] = location.netOffset.split(',').map(Number);
  const [left, top, right, bottom] = location.convBoundary.split(',').map(Number);
  const {projParameter} = location;

  const t: Transform = {
    left,
    top,
    bottom,
    right,
    xyToXz([x, y]: number[]) {
      return [x, bottom - y];
    },
    xyToXyz([x, y]: number[]) {
      return [x, 0, bottom - y];
    },
    center() {
      return [(left + right) / 2, (top + bottom) / 2];
    },
    width() {
      return Math.abs(right - left);
    },
    height() {
      return Math.abs(bottom - top);
    },
    sumoXyzToXyz([x, y, z]: number[]) {
      const [xp, , zp] = this.xyToXyz([x, y]);
      return [xp, z, zp];
    },
    xzToSumoXy([x, z]: number[]) {
      return [x, bottom - z];
    },
    latLngToXZ(latLng: LatLng) {
      if (projParameter === '!') return null;
      const [x, y] = proj4(projParameter).forward([latLng.lng, latLng.lat]);
      return this.xyToXz([x + dx, y + dy]);
    },
    toLatLng(xz: number[]) {
      if (projParameter === '!') return null;
      // First convert back to SUMO coordinates.
      const [sumoX, sumoY] = t.xzToSumoXy(xz);
      const projX = sumoX - dx;
      const projY = sumoY - dy;

      const [lng, lat] = proj4(projParameter).inverse([projX, projY]);
      return {lat, lng};
    },
  };
  return t;
}
