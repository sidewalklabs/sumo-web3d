// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as three from 'three';

import {KEY_CODES} from './key-tracker';
import {createYAxisRotationMatrix3} from './utils';

const ANGULAR_VELOCITY = 5;
const ZOOM_SPEED = 0.95;

interface PerspectiveVector {
  direction: three.Vector3;
  length: number;
}

function onScroll(vector: PerspectiveVector, event: WheelEvent) {
  const delta = Math.ceil(event.deltaY / 10);
  // don't allow the user to continually infinitely scrolling
  if (delta > 3 || delta < -3) {
    vector.length *= Math.pow(ZOOM_SPEED, -delta);
  }
}

function createOrbitKeyDown(angle: number) {
  const leftRotate = createYAxisRotationMatrix3(three.Math.degToRad(5));
  const rightRotate = createYAxisRotationMatrix3(three.Math.degToRad(-5));

  return (vector: PerspectiveVector, event: KeyboardEvent) => {
    event.preventDefault();
    // circle the object clockwise
    if (event.keyCode === KEY_CODES.LEFT) {
      vector.direction.applyMatrix3(leftRotate);
    } else if (event.keyCode === KEY_CODES.RIGHT) {
      // circle the object counterclockwise
      vector.direction.applyMatrix3(rightRotate);
    } else if (event.keyCode === KEY_CODES.UP) {
      // move the camera higher up away from the ground
      const fullVector = perspectiveVectorToThreeVector(vector);
      vector.direction = fullVector.setY(fullVector.y + 1).normalize();
    } else if (event.keyCode === KEY_CODES.DOWN) {
      // move the camera closer to the ground
      const fullVector = perspectiveVectorToThreeVector(vector);
      if (fullVector.y - 1 > 0) {
        vector.direction = fullVector.setY(fullVector.y - 1).normalize();
      }
    }
    return true;
  };
}

function perspectiveVectorToThreeVector(vector: PerspectiveVector) {
  return vector.direction.clone().multiplyScalar(vector.length);
}

export default class FollowVehicleControls {
  camera: three.Camera;
  object: three.Object3D;
  vector: PerspectiveVector;
  rotationMatrix: three.Matrix3;
  keyboardElement: HTMLElement;
  rotationFn: () => any;
  scrollFn: () => any;

  constructor(object: three.Object3D, camera: three.Camera, keyboardElement: HTMLElement) {
    if (camera instanceof three.PerspectiveCamera) {
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
    this.camera = camera;
    this.object = object;
    this.vector = {
      direction: new three.Vector3(1, 1, 1).normalize(),
      length: 18,
    };
    this.keyboardElement = keyboardElement;
    this.addControls(keyboardElement, this.vector);
  }

  addControls(element: HTMLElement, vector: PerspectiveVector) {
    const rotateFn = createOrbitKeyDown(ANGULAR_VELOCITY);
    this.rotationFn = rotateFn.bind(null, vector);
    this.scrollFn = onScroll.bind(null, vector);
    element.addEventListener('keydown', this.rotationFn);
    element.addEventListener('wheel', this.scrollFn);
  }

  dispose() {
    this.keyboardElement.removeEventListener('keydown', this.rotationFn, false);
    this.keyboardElement.removeEventListener('wheel', this.scrollFn, false);
  }

  update() {
    const objectPosition = this.object.getWorldPosition().clone();
    this.camera.position.copy(objectPosition.add(perspectiveVectorToThreeVector(this.vector)));
    this.camera.lookAt(this.object.position);
  }
}
