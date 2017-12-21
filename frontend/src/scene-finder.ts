// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Given a three.js scene and a position, figure out which direction to point the camera so that
 * it's looking at the most content.
 *
 * The idea here is that the camera starts pointing straight down at the ground.
 * We want to do the equivalent of right-clicking and dragging to rotate it so that it's showing
 * the most interesting content.
 *
 * We hard-code the vertical part of the rotate to 60° (i.e 30° off the ground).
 * The horizontal part of the rotation is harder, since it's scene dependent.
 * To find an interesting part of the scene to look at, we figure out how many polygon faces would
 * be visible at each degree of rotation and look at the one with the most.
 */

import * as _ from 'lodash';
import * as three from 'three';

const temp = new three.Vector3();

/** What angle (in degrees) does the center of the face make with the x-axis in the xz-plane? */
function angleForFace(
  face: three.Face3,
  geometry: three.Geometry,
  obj: three.Mesh,
  cameraPos: three.Vector3,
) {
  const {vertices} = geometry;
  const {a, b, c} = face;
  temp.addVectors(vertices[a], vertices[b]);
  temp.add(vertices[c]);
  temp.divideScalar(3);
  obj.localToWorld(temp);
  const {x, z} = temp;
  return three.Math.radToDeg(Math.atan2(z - cameraPos.z, x - cameraPos.x));
}

/** Returns a 360-element array, with counts of faces whose centers are in each direction. */
function getAngleCounts(scene: three.Object3D, cameraPos: three.Vector3): number[] {
  const angleCounts = _.range(0, 360).map(() => 0);
  scene.traverse(obj => {
    if (!(obj instanceof three.Mesh)) return;
    const {geometry} = obj;
    if (!(geometry instanceof three.Geometry)) return;
    for (const face of geometry.faces) {
      let angleDegs = angleForFace(face, geometry, obj, cameraPos);
      angleDegs = Math.floor((360 + angleDegs) % 360);
      angleCounts[angleDegs] += 1;
    }
  });
  return angleCounts;
}

// xs is an array, kernel is an array of (dx, coefficient) pairs.
// exported for testing
export function convolve(xs: number[], kernel: number[][]): number[] {
  const out = xs.map(() => 0);
  const n = xs.length;
  xs.forEach((v, i) => {
    let value = 0;
    kernel.forEach(([dx, coeff]) => {
      value += coeff * xs[(i + dx + n) % n];
    });
    out[i] = value;
  });
  return out;
}

function makeGaussianKernel(width: number, sigma: number): number[][] {
  const kernel: number[][] = [];
  for (let dx = Math.ceil(-width / 2); dx < Math.ceil(width / 2); dx++) {
    kernel.push([dx, Math.exp(-dx * dx / (2 * sigma * sigma))]);
  }
  return kernel;
}

// Use a gaussian kernel to find an angle with the largest counts.
function findBusiestAngle(angleCounts: number[], fieldOfView: number): number {
  const kernel = makeGaussianKernel(fieldOfView, fieldOfView / 2);
  const windowedCounts = convolve(angleCounts, kernel);
  return windowedCounts.indexOf(_.max(windowedCounts) as number);
}

/**
 * Pretend the camera is on a sphere with its center directly beneath it on the ground.
 * Rotate it towards the ground so that it's looking at the most interesting part of the scene.
 */
export function pointCameraAtScene(camera: three.PerspectiveCamera, scene: three.Scene) {
  const {position, fov} = camera;
  const angleCounts = getAngleCounts(scene, position);
  const cameraAngle = findBusiestAngle(angleCounts, fov);
  console.log('angle', cameraAngle);

  // Move the camera away from this angle, 30 degrees off the ground.
  const {x, y, z} = position;
  const groundCenter = new three.Vector3(x, 0, z);
  const theta = three.Math.degToRad(180 + cameraAngle);
  const phi = three.Math.degToRad(60); // 60 degrees from vertical, i.e. 30 degs off the ground.
  const radius = y;
  const offset = new three.Vector3();
  offset.x = radius * Math.sin(phi) * Math.cos(theta);
  offset.y = radius * Math.cos(phi);
  offset.z = radius * Math.sin(phi) * Math.sin(theta);

  camera.position.addVectors(groundCenter, offset);
  camera.lookAt(groundCenter);
}
