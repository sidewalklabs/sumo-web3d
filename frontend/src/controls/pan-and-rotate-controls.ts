// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as _ from 'lodash';
import * as three from 'three';

import {updateKeyStateWithEvent, KEY_CODES, KEY_STATE} from './key-tracker';
import {createXAxisRotationMatrix4, rotateInWorldSpace} from './utils';

// Note: the mouse controls derive from MapControls.js, see:
// https://github.com/grey-eminence/3DIT/blob/b1e475c672/js/controls/MapControls.js
// http://3dit.bordeaux.inria.fr/testbed.html#navigation_Map_Navigation

// degrees of rotation per keydown event
const VELOCITY = 5;
const VELOCITY_RAD = three.Math.degToRad(VELOCITY);
const UP_ROTATE = createXAxisRotationMatrix4(VELOCITY_RAD);
const DOWN_ROTATE = createXAxisRotationMatrix4(-VELOCITY_RAD);

// Constants from MapControls.js
const ROTATE_SPEED = 0.3;
const MIN_POLAR_ANGLE = 0; // radians; don't rotate past looking straight down.
const MAX_POLAR_ANGLE = Math.PI / 2; // radians; don't rotate below the ground.
const EPSILON = 0.000001;
const MIN_DISTANCE = 0;
const MAX_DISTANCE = Infinity;
const ZOOM_SPEED = 1.0;

enum State {
  NONE,
  PANNING,
  ROTATING,
}

/**
 * Binds keyboard and mouse controls to manipulate a three.js perspective camera.
 *
 * Keyboard Controls:
 *   h / a - pan the camera left
 *   j / s - pan the camera away from the direction it is facing
 *   k / w - pan the camera "forward" or in the direction the camera is facing
 *   l / d - pan the camera to the right
 *   up-arrow - rotate the camera upwards along the vertical axis
 *   down-arrow - rotate the camera downwards along the vertical axis
 *   left-arrow - rotate the camera to the left along the horizontal axis
 *   right-arrow - rotate the camera to the right along the horizontal axis
 *   ctrl + up-arrow - move the camera higher above the ground
 *   ctrl + down-arrow - move the camera towards the ground
 *
 * Mouse Controls:
 *   Holding down the left button engages panning mode
 *   Holding down the right button engages rotation mode
 *   The mouse wheel allows you to zoom in and out of a scene
 */
export default class PanAndRotateControls {
  camera: three.PerspectiveCamera;
  rotationMatrix: three.Matrix3;
  element: HTMLElement;
  state: State;
  groundPlane: three.Object3D;
  panStart: three.Vector3;
  target: three.Vector3;

  constructor(
    camera: three.PerspectiveCamera,
    mouseElement: HTMLElement,
    groundPlane: three.Object3D,
  ) {
    this.camera = camera;
    this.state = State.NONE;
    this.element = mouseElement;
    this.groundPlane = groundPlane;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    mouseElement.addEventListener('keydown', this.onKeyDown, false);
    mouseElement.addEventListener('mousedown', this.onMouseDown, false);
    mouseElement.addEventListener('mousewheel', this.onMouseWheel, false);
  }

  dispose() {
    this.element.removeEventListener('keydown', this.onKeyDown, false);
    this.element.removeEventListener('mousedown', this.onMouseDown, false);
    this.element.removeEventListener('mousewheel', this.onMouseWheel, false);
  }

  onKeyDown(event: KeyboardEvent) {
    // we might miss keyup events when you switch tabs, e.g. by pressing ctrl+tab.
    // event.ctrlKey and friends are a better source of truth for this.
    updateKeyStateWithEvent(event);

    // Note: the logic in this function should match that in update().
    if (event.altKey || event.shiftKey) return;

    let handledKeypress = false;
    const {keyCode} = event;
    const {UP, DOWN, LEFT, RIGHT} = KEY_CODES;
    const isArrow = keyCode === UP || keyCode === DOWN || keyCode === LEFT || keyCode === RIGHT;
    if (event.ctrlKey) {
      handledKeypress = isArrow;
    } else {
      handledKeypress =
        isArrow ||
        (keyCode === KEY_CODES.H || keyCode === KEY_CODES.A) ||
        (keyCode === KEY_CODES.L || keyCode === KEY_CODES.D) ||
        (keyCode === KEY_CODES.K || keyCode === KEY_CODES.W) ||
        (keyCode === KEY_CODES.J || keyCode === KEY_CODES.S);
    }
    if (handledKeypress) {
      event.preventDefault();
    }
  }

  onMouseWheel(event: MouseWheelEvent) {
    event.preventDefault();
    this.zoom(event.deltaY);
    return true;
  }

  zoom(delta: number) {
    const zoomOffset = new three.Vector3();
    const te = this.camera.matrix.elements;
    zoomOffset.set(te[8], te[9], te[10]);
    zoomOffset.multiplyScalar(delta * ZOOM_SPEED * this.camera.position.y / 1000);
    this.camera.position.addVectors(this.camera.position, zoomOffset);
  }

  /** Get the ground plane coordinates for the given screen coordinate. x, y \in [-1, 1] */
  private getGroundCoords(x: number, y: number): three.Vector3 | null {
    const intersections: three.Intersection[] = [];
    const raycaster = new three.Raycaster();
    raycaster.setFromCamera(new three.Vector2(x, y), this.camera);
    // This will produce results even if the groundPlane is hidden.
    this.groundPlane.raycast(raycaster, intersections);

    if (intersections.length !== 1) {
      return null;
    } else {
      return intersections[0].point;
    }
  }

  private getGroundCoordsForEvent(event: MouseEvent): three.Vector3 | null {
    const el: HTMLElement = event.target as any;

    // Normalize coordinates to [-1, +1].
    const x = event.offsetX / el.offsetWidth * 2 - 1;
    const y = -(event.offsetY / el.offsetHeight) * 2 + 1;
    return this.getGroundCoords(x, y);
  }

  onMouseDown(event: MouseEvent) {
    // programmatically force focus when you click on the element
    this.element.focus();
    let handleEvent = true;
    if (event.button === three.MOUSE.LEFT) {
      const panStart = this.getGroundCoordsForEvent(event);
      if (panStart) {
        this.state = State.PANNING;
        this.panStart = panStart;
      }
    } else if (event.button === three.MOUSE.RIGHT) {
      // Ideally we'd like to orbit the ground coords for the center of the screen, (0, 0).
      // If the ground plane doesn't go through there, we'll orbit around the coordinates under
      // the cursor. It'll produce a jump at first, but at least you can rotate!
      const target = this.getGroundCoords(0, 0) || this.getGroundCoordsForEvent(event);
      if (target) {
        this.state = State.ROTATING;
        this.target = target;
      }
    } else {
      handleEvent = false;
    }
    if (handleEvent) {
      window.addEventListener('mousemove', this.onMouseMove, false);
      window.addEventListener('mouseup', this.onMouseUp, false);
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.state === State.PANNING) {
      const panDelta = this.getGroundCoordsForEvent(event);
      if (!panDelta) return;

      const delta = new three.Vector3();
      delta.subVectors(this.panStart, panDelta);
      this.camera.position.addVectors(this.camera.position, delta);
    } else if (this.state === State.ROTATING) {
      const rotateDelta = new three.Vector2(event.movementX, event.movementY);
      const {offsetWidth, offsetHeight} = this.element;

      const thetaDelta = -2 * Math.PI * rotateDelta.x / offsetWidth * ROTATE_SPEED;
      const phiDelta = -2 * Math.PI * rotateDelta.y / offsetHeight * ROTATE_SPEED;

      const position = this.camera.position;
      const offset = position.clone().sub(this.target);

      // angle from z-axis around y-axis
      let theta = Math.atan2(offset.x, offset.z);

      // angle from y-axis
      let phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

      theta += thetaDelta;
      phi += phiDelta;

      // restrict phi and radius to be between desired limits
      phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, phi));
      phi = Math.max(EPSILON, Math.min(Math.PI - EPSILON, phi));
      const radius = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, offset.length()));

      offset.x = radius * Math.sin(phi) * Math.sin(theta);
      offset.y = radius * Math.cos(phi);
      offset.z = radius * Math.sin(phi) * Math.cos(theta);

      position.copy(this.target).add(offset);

      this.camera.lookAt(this.target);
    }
  }

  onMouseUp(event: MouseEvent) {
    this.state = State.NONE;
    window.removeEventListener('mousemove', this.onMouseMove, false);
    window.removeEventListener('mouseup', this.onMouseUp, false);
  }

  update() {
    // Note: the logic in this function should match that in onKeyDown().
    if (_.isEmpty(KEY_STATE)) return; // early out in the common case.

    // this is a hack to only update the camera when the canvas element is in focus
    const ctrlKey = KEY_STATE[KEY_CODES.CTRL];
    const altKey = KEY_STATE[KEY_CODES.ALT];
    const shiftKey = KEY_STATE[KEY_CODES.SHIFT];

    if (altKey || shiftKey) return;

    if (ctrlKey) {
      if (KEY_STATE[KEY_CODES.UP]) {
        this.camera.position.setY(this.camera.position.y + VELOCITY);
      }
      if (KEY_STATE[KEY_CODES.DOWN]) {
        this.camera.position.setY(this.camera.position.y - VELOCITY);
      }
    } else {
      if (KEY_STATE[KEY_CODES.H] || KEY_STATE[KEY_CODES.A]) {
        const direction = this.camera.getWorldDirection();
        const horizontal = direction
          .clone()
          .cross(new three.Vector3(0, 1, 0))
          .multiplyScalar(-VELOCITY);
        this.camera.position.add(horizontal);
      }
      if (KEY_STATE[KEY_CODES.L] || KEY_STATE[KEY_CODES.D]) {
        const direction = this.camera.getWorldDirection();
        const horizontal = direction
          .clone()
          .cross(new three.Vector3(0, 1, 0))
          .multiplyScalar(VELOCITY);
        this.camera.position.add(horizontal);
      }
      if (KEY_STATE[KEY_CODES.K] || KEY_STATE[KEY_CODES.W]) {
        this.zoom(-50);
      }
      if (KEY_STATE[KEY_CODES.J] || KEY_STATE[KEY_CODES.S]) {
        this.zoom(+50);
      }
      if (KEY_STATE[KEY_CODES.LEFT]) {
        rotateInWorldSpace(this.camera, new three.Vector3(0, 1, 0), VELOCITY_RAD);
      }
      if (KEY_STATE[KEY_CODES.RIGHT]) {
        rotateInWorldSpace(this.camera, new three.Vector3(0, 1, 0), -VELOCITY_RAD);
      }
      if (KEY_STATE[KEY_CODES.UP]) {
        this.camera.setRotationFromMatrix(this.camera.matrix.multiply(UP_ROTATE));
      }
      if (KEY_STATE[KEY_CODES.DOWN]) {
        this.camera.setRotationFromMatrix(this.camera.matrix.multiply(DOWN_ROTATE));
      }
    }
  }
}
