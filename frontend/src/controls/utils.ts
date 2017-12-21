// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as three from 'three';

export function createYAxisRotationMatrix3(angleRad: number) {
  const matrix = new three.Matrix3();
  matrix.fromArray([
    Math.cos(angleRad),
    0,
    Math.sin(angleRad),
    0,
    1,
    0,
    -1 * Math.sin(angleRad),
    0,
    Math.cos(angleRad),
  ]);
  return matrix;
}

export function createXAxisRotationMatrix4(angleRad: number) {
  const matrix = new three.Matrix4();
  matrix.fromArray([
    1,
    0,
    0,
    0,
    0,
    Math.cos(angleRad),
    Math.sin(angleRad),
    0,
    0,
    -1 * Math.sin(angleRad),
    Math.cos(angleRad),
    0,
    0,
    0,
    0,
    1,
  ]);
  return matrix;
}

function makeXZPlaneMatrix4() {
  const matrix = new three.Matrix4();
  matrix.fromArray([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return matrix;
}

export const XZPlaneMatrix4 = makeXZPlaneMatrix4();

export function rotateInWorldSpace(object: three.Object3D, axis: three.Vector3, radians: number) {
  const rotWorldMatrix = new three.Matrix4();
  rotWorldMatrix.makeRotationAxis(axis.normalize(), radians);
  const worldMatrx = new three.Matrix4().makeRotationFromQuaternion(object.getWorldQuaternion());
  rotWorldMatrix.multiply(worldMatrx);
  object.rotation.setFromRotationMatrix(rotWorldMatrix);
}
