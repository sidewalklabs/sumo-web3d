// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as stringHash from 'string-hash';
import * as three from 'three';

import {Signals, VehicleInfo} from './api';

// Turn/brake lights are temporarily disabled while we investigate performance issues around them.
const SHOW_LIGHTS = false;

const OFFSET_X = 0.8;
const OFFSET_Y = 0.644;
const OFFSET_Z_FRONT = 1.8;
const OFFSET_Z_BACK = -2.0;
const BRAKE_LIGHT_COLOR = 0xff0000;
const SIGNAL_LIGHT_COLOR = 0x0000ff;

export default class Vehicle {
  // TODO (Ananta): the frontend shouldn't need to retain a copy of all vehicle info.
  // Make it as lightweight as possible
  public vehicleInfo: VehicleInfo;
  public mesh: three.Group | three.Mesh;

  static fromInfo(
    vClassObjects: {[vClass: string]: three.Object3D[]},
    vehicleId: string,
    info: VehicleInfo,
  ): Vehicle | null {
    const objects = vClassObjects[info.vClass];
    if (!objects) {
      console.warn(`Unsupported vehicle type: ${info.vClass}`);
      return null;
    }
    const randomModelIndex = stringHash(vehicleId) % objects.length;
    const vehicleObj = objects[randomModelIndex];
    const mesh = vehicleObj.clone();
    return new Vehicle(mesh, vehicleId, info);
  }

  private constructor(mesh: three.Object3D, vehicleId: string, info: VehicleInfo) {
    mesh.name = vehicleId;
    mesh.userData = {
      type: info.type,
      vClass: info.vClass,
    };

    if (info.vClass === 'passenger' && SHOW_LIGHTS) {
      this.setupLights(mesh.userData, mesh);
    }

    this.vehicleInfo = info;
    this.mesh = mesh;
    return this;
  }

  addLight(mesh: three.Object3D, x: number, y: number, z: number, lightColor: number) {
    const sphereGeom = new three.SphereGeometry(0.12, 24, 24);
    const material = new three.MeshBasicMaterial({color: lightColor, transparent: false});
    const light = new three.Mesh(sphereGeom, material);
    light.position.set(x, y, z);
    mesh.add(light);
    return light;
  }

  setupLights(userData: any, mesh: three.Object3D) {
    userData.leftFrontLight = this.addLight(
      mesh,
      -OFFSET_X,
      OFFSET_Y,
      OFFSET_Z_FRONT,
      SIGNAL_LIGHT_COLOR,
    );
    userData.leftBackLight = this.addLight(
      mesh,
      OFFSET_X,
      OFFSET_Y,
      OFFSET_Z_BACK,
      BRAKE_LIGHT_COLOR,
    );
    userData.rightFrontLight = this.addLight(
      mesh,
      OFFSET_X,
      OFFSET_Y,
      OFFSET_Z_FRONT,
      SIGNAL_LIGHT_COLOR,
    );
    userData.rightBackLight = this.addLight(
      mesh,
      -OFFSET_X,
      OFFSET_Y,
      OFFSET_Z_BACK,
      BRAKE_LIGHT_COLOR,
    );
  }

  setSignals(signals: number) {
    if (!SHOW_LIGHTS) return;
    const isBraking = signals & Signals.BRAKE;
    const {userData} = this.mesh;
    userData.leftBackLight.visible = isBraking;
    userData.rightBackLight.visible = isBraking;
    userData.leftFrontLight.visible = signals & Signals.LEFT;
    userData.rightFrontLight.visible = signals & Signals.RIGHT;
  }
}
