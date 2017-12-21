// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as dat from 'dat.gui/build/dat.gui.js';
import * as _ from 'lodash';
import Stats = require('stats.js');
import * as three from 'three';

import {LightInfo, SimulationState, VehicleInfo} from './api';
import FollowVehicleControls from './controls/follow-controls';
import PanAndRotateControls from './controls/pan-and-rotate-controls';
import {XZPlaneMatrix4} from './controls/utils';
import {getTransforms, LatLng, Transform} from './coords';
import Postprocessing, {FOG_RATE} from './effects/postprocessing';
import addSky from './effects/sky';
import {InitResources} from './initialization';
import {HIGHLIGHT} from './materials';
import {makeStaticObjects, MeshAndPosition, OsmIdToMesh} from './network';
import {pointCameraAtScene} from './scene-finder';
import TrafficLights from './traffic-lights';
import {forceArray} from './utils';
import Vehicle from './vehicle';

const {hostname} = window.location;
export const SUMO_ENDPOINT = `http://${hostname}:5000`;

export interface SumoState {
  time: number;
  payloadSize: number;
  vehicleCounts: {[vClass: string]: number};
  simulateSecs: number;
  snapshotSecs: number;
}

export interface NameAndUserData extends UserData {
  name: string;
}

export interface UserData {
  type: string;
  vClass?: string;
  osmId?: {
    id: number;
    type: 'node' | 'way' | 'relation';
  };
}

export interface SumoParams {
  onClick: (
    point: LatLng | null,
    sumoXY: [number, number] | null,
    objects: NameAndUserData[],
  ) => any;
  onUnfollow: () => any;
  onRemove: (id: string) => any;
  onUnhighlight: () => any;
}

interface HighlightedMesh {
  originalMesh: three.Object3D;
  highlightedMesh: three.Object3D;
}

interface HighlightedVehicle {
  id: string;
  originalMaterial: three.Material;
  vehicle: Vehicle;
}

/**
 * Visualize a Sumo simulation using three.js.
 *
 * This class expects the DOM to be ready and for all its resources to be loaded.
 */
export default class Sumo3D {
  parentElement: HTMLElement;

  public osmIdToMeshes: OsmIdToMesh;
  private transform: Transform;
  private vehicles: {[vehicleId: string]: Vehicle};
  private camera: three.PerspectiveCamera;
  private scene: three.Scene;
  private renderer: three.Renderer;
  private controls: PanAndRotateControls | FollowVehicleControls;
  public simulationState: SimulationState;
  private vClassObjects: {[vehicleClass: string]: three.Object3D[]};
  private trafficLights: TrafficLights;
  public highlightedMeshes: HighlightedMesh[];
  private highlightedVehicles: HighlightedVehicle[];
  private gui: typeof dat.gui.GUI;
  private postprocessing: Postprocessing;
  private stats: Stats;
  private simTimePanel: Stats.Panel;
  private maxSimTimeMs: number;
  private highlightedRoute: HighlightedMesh[];
  private groundPlane: three.Object3D;
  private cancelNextClick = false;

  constructor(parentElement: HTMLElement, init: InitResources, private params: SumoParams) {
    const startMs = window.performance.now();

    this.parentElement = parentElement;
    const width = parentElement.clientWidth;
    const height = parentElement.clientHeight;

    this.simulationState = init.simulationState;
    this.transform = getTransforms(init.network);
    this.vClassObjects = init.vehicles;
    this.vehicles = {};
    this.highlightedRoute = [];
    this.highlightedMeshes = [];
    this.highlightedVehicles = [];

    this.trafficLights = new TrafficLights(init);

    this.renderer = new three.WebGLRenderer();
    (this.renderer as any).setPixelRatio(window.devicePixelRatio);
    // disable the ability to right click in order to allow rotating with the right button
    this.renderer.domElement.oncontextmenu = (e: PointerEvent) => false;
    this.renderer.domElement.tabIndex = 1;
    this.renderer.setSize(width, height);

    this.scene = new three.Scene();

    this.camera = new three.PerspectiveCamera(75, width / height, 1, 20000);
    let [centerX, centerZ] = this.transform.xyToXz(this.transform.center());
    let initZoom = 200;
    if (init.settings && init.settings.viewsettings.viewport) {
      const {x, y, zoom} = init.settings.viewsettings.viewport;
      console.log('Focusing on ', x, y);
      [centerX, centerZ] = this.transform.xyToXz([Number(x), Number(y)]);
      if (zoom) initZoom = Number(zoom);
    }
    const maxInitY = 0.5 / FOG_RATE; // beyond this, you can't see anything.
    // Distance at which whole scene is visible, see https://stackoverflow.com/a/31777283/388951.
    const initY = Math.min(
      this.transform.width() * 100 / initZoom / (2 * Math.tan(this.camera.fov * Math.PI / 360)),
      maxInitY,
    );
    this.camera.position.set(centerX, initY, centerZ);

    this.gui = new dat.gui.GUI();
    addSky(this.gui, this.scene, centerX, centerZ);
    this.postprocessing = new Postprocessing(
      this.camera,
      this.scene,
      this.renderer,
      this.gui,
      width,
      height,
      centerX,
      centerZ,
    );

    let staticGroup: three.Group;
    [staticGroup, this.osmIdToMeshes] = makeStaticObjects(
      init.network,
      init.additional,
      init.water,
      this.transform,
    );

    this.scene.add(staticGroup);
    pointCameraAtScene(this.camera, this.scene);

    this.scene.add(this.trafficLights.loadNetwork(init.network, this.transform));
    this.trafficLights.addLogic(forceArray(init.network.net.tlLogic));
    if (init.additional && init.additional.tlLogic) {
      this.trafficLights.addLogic(forceArray(init.additional.tlLogic));
    }
    this.groundPlane = this.scene.getObjectByName('Land');

    this.animate = this.animate.bind(this);
    this.moveCameraTo = this.moveCameraTo.bind(this);
    this.moveCameraToRandomVehicleOfClass = this.moveCameraToRandomVehicleOfClass.bind(this);

    const sceneFolder = this.gui.addFolder('Scene');
    const sceneOptions = {
      showGroundPlane: true,
    };
    sceneFolder.add(sceneOptions, 'showGroundPlane').onChange((v: boolean) => {
      this.groundPlane.visible = v;
    });

    parentElement.appendChild(this.renderer.domElement);

    this.controls = new PanAndRotateControls(
      this.camera,
      this.renderer.domElement,
      this.groundPlane,
    );

    this.stats = new Stats();
    this.simTimePanel = this.stats.addPanel(new Stats.Panel('simMs', '#fff', '#777'));
    this.maxSimTimeMs = 0;
    this.stats.showPanel(0); // 0 = show stats on FPS
    parentElement.appendChild(this.stats.dom);
    this.stats.dom.style.position = 'absolute'; // top left of container, not the page.
    this.animate();

    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));

    window.addEventListener('resize', this.onResize.bind(this));

    const endMs = window.performance.now();
    console.log('Initialized three.js scene in ', endMs - startMs, ' ms.');
  }

  purgeVehicles() {
    // cleanup scene
    for (const vehId in this.vehicles) {
      this.scene.remove(this.vehicles[vehId].mesh);
    }
    this.vehicles = {};
  }

  // Helper function to bring the state of the object representing the vehicle
  // up to date with its VehicleInfo.
  updateVehicleMesh(vehicle: Vehicle) {
    // In SUMO, the position of a vehicle is the front/center.
    // But the rotation is around its center/center.
    // Our models are built with (0, 0) at the center/center, so we rotate and then offset.
    const v = vehicle.vehicleInfo;
    const obj = vehicle.mesh;
    const [x, y, z] = this.transform.sumoXyzToXyz([v.x, v.y, v.z]);
    const angle = three.Math.degToRad(180 - v.angle);
    obj.position.set(x - v.length / 2 * Math.sin(angle), y, z - v.length / 2 * Math.cos(angle));
    obj.rotation.set(0, angle, 0);
    if (v.type === 'passenger') {
      vehicle.setSignals(v.signals); // update turn & brake signals.
    }
    obj.visible = !v.vehicle; // Don't render objects which are contained in vehicles.
  }

  createVehicleObject(vehicleId: string, info: VehicleInfo) {
    const vehicle = Vehicle.fromInfo(this.vClassObjects, vehicleId, info);
    if (vehicle) {
      this.vehicles[vehicleId] = vehicle;
      this.updateVehicleMesh(vehicle);
      this.scene.add(vehicle.mesh);
    }
  }

  updateVehicleObject(vehicleId: string, update: VehicleInfo) {
    const vehicle = this.vehicles[vehicleId];
    if (vehicle) {
      _.extend(vehicle.vehicleInfo, update);
      this.updateVehicleMesh(vehicle);
    }
  }

  removeVehicleObject(vehicleId: string) {
    let highlightedIndex = null;
    this.highlightedVehicles.forEach(({id}, index) => {
      if (vehicleId === id) {
        this.params.onUnhighlight();
        highlightedIndex = index;
      }
    });

    if (highlightedIndex) {
      this.highlightedVehicles.splice(highlightedIndex, 1);
    }

    const vehicle = this.vehicles[vehicleId];
    if (vehicle) {
      this.scene.remove(vehicle.mesh);
      if (
        this.controls instanceof FollowVehicleControls &&
        vehicleId === this.controls.object.name
      ) {
        this.params.onUnfollow();
      }
      this.params.onRemove(vehicleId);
      delete this.vehicles[vehicleId];
    }
  }

  updateLightObject(lightId: string, update: LightInfo) {
    const {programID, phase} = update;
    if (programID !== undefined) {
      this.trafficLights.setLightProgram(lightId, programID);
    }
    if (phase !== undefined) {
      this.trafficLights.setPhase(lightId, phase);
    }
  }

  updateStats(stats: SumoState) {
    const simTimeMs = stats.simulateSecs * 1000;
    this.maxSimTimeMs = Math.max(simTimeMs, this.maxSimTimeMs);
    this.simTimePanel.update(simTimeMs, 100);
  }

  animate() {
    this.controls.update();
    this.postprocessing.render();
    this.stats.update();

    requestAnimationFrame(this.animate);
  }

  onSelectFollowPOV(vehicleId: string) {
    const vehicle = this.vehicles[vehicleId];
    if (vehicle) {
      const object = vehicle.mesh;
      this.controls.dispose();
      this.controls = new FollowVehicleControls(object, this.camera, document.body);
      this.controls.update();
    }
  }

  unfollowPOV() {
    if (this.controls instanceof FollowVehicleControls) {
      // Place camera over vehicle's arrival location
      const translation = new three.Vector3(0, 100, 0);
      this.camera.position.copy(translation.applyMatrix4(this.controls.object.matrix));
      this.controls.dispose();
      this.controls = new PanAndRotateControls(
        this.camera,
        this.renderer.domElement,
        this.groundPlane,
      );
      // Have the camera look out over the horizon
      this.camera.setRotationFromMatrix(XZPlaneMatrix4);
    }
  }

  onShowRouteObject(edgeIds: string[]) {
    this.highlightedRoute = _.flatten(edgeIds.map(id => this.highlightByOsmId(id, false)));
    return;
  }

  /** Point the camera down at some SUMO coordinates. */
  moveCameraTo(sumoX: number, sumoY: number, sumoZ: number) {
    if (!(this.controls instanceof FollowVehicleControls)) {
      const [x, y, z] = this.transform.sumoXyzToXyz([sumoX, sumoY, sumoZ]);
      this.camera.position.set(x, y, z);
    }
  }

  moveCameraToRandomVehicleOfClass(vehicleClass: string) {
    const vehicles = _.filter(this.vehicles, v => v.vehicleInfo.vClass === vehicleClass);
    const randomVehicle = _.sample<Vehicle>(vehicles);
    if (randomVehicle) {
      const {x, y, z} = randomVehicle.mesh.position;
      // the offsets put the camera slightly behind the vehicle and above the road
      this.camera.position.set(x, y + 2, z + 10);
    } else {
      console.warn('cannot find a random', vehicleClass);
    }
  }

  moveCameraToRandomLight() {
    const randomLight = this.trafficLights.getRandomLight();
    if (randomLight) {
      const {x, y, z} = randomLight.position;
      // the offset puts the camera slightly behind the light
      this.camera.position.set(x, y, z + 10);
    } else {
      console.warn('cannot find a random traffic light');
    }
  }

  moveCameraToLatitudeAndLongitude(lat: number, lng: number) {
    const simulationCoords = this.transform.latLngToXZ({lat, lng});
    if (simulationCoords) {
      const [x, z] = simulationCoords;
      this.camera.position.set(x, this.camera.position.y, z);
      this.camera.lookAt(new three.Vector3(x, 0, z));
    }
  }

  checkParentsAndFaceForUserData(intersect: three.Intersection): any {
    // first check the face for userData. This comes from a merged geometry.
    const faceData = (intersect.face as any).userData;
    if (faceData) {
      return faceData;
    }
    // Otherwise look for userData on this object or its parents.
    return this.checkParentsForUserData(intersect.object);
  }

  checkParentsForUserData(obj: three.Object3D): any {
    if (!obj.parent) {
      return null;
    } else if (obj.userData['type']) {
      return {name: obj.name, ...obj.userData};
    } else {
      return this.checkParentsForUserData(obj.parent);
    }
  }

  highlightMesh(mesh: three.Mesh) {
    const newMesh = mesh.clone();
    newMesh.material = HIGHLIGHT;
    return newMesh;
  }

  highlightObject(obj: three.Object3D) {
    if (obj instanceof three.Mesh) {
      return this.highlightMesh(obj as three.Mesh);
    }
    const {highlightObject} = this;
    const highlightObjectFn = highlightObject.bind(this);
    const newObject = obj.clone();
    newObject.children = newObject.children.map(child => {
      if (child instanceof three.Mesh) {
        child = highlightObjectFn(child);
      }
      return child;
    });
    return newObject;
  }

  highlightByOsmId(osmId: string, changeCamera: boolean) {
    if (this.osmIdToMeshes[osmId]) {
      const selected: MeshAndPosition[] = this.osmIdToMeshes[osmId];
      const {scene, highlightMesh} = this;
      this.highlightedMeshes = this.highlightedMeshes.concat(
        selected.map(({mesh, position}) => {
          const originalMesh = mesh;
          const highlightedMesh = highlightMesh(mesh);
          originalMesh.visible = false;
          scene.add(highlightedMesh);
          return {highlightedMesh, originalMesh};
        }),
      );
      const positionUpdate = selected[0].position;
      if (changeCamera && positionUpdate !== null) {
        this.camera.position.copy(positionUpdate);
        this.camera.position.add(new three.Vector3(0, 50, 0));
        this.camera.lookAt(positionUpdate);
        this.camera.updateProjectionMatrix();
      }
    }
    return this.highlightedMeshes;
  }

  highlightByVehicleId(sumoId: string, changeCamera: boolean) {
    if (this.vehicles[sumoId]) {
      const originalMesh = this.vehicles[sumoId].mesh.clone();
      const update = this.highlightObject(this.vehicles[sumoId].mesh);
      this.highlightedVehicles.push({
        vehicle: this.vehicles[sumoId],
        id: sumoId,
        originalMaterial: (this.vehicles[sumoId].mesh.children[0] as three.Mesh).material.clone(),
      });
      (this.vehicles[sumoId].mesh.children[0] as three.Mesh).material = (update
        .children[0] as three.Mesh).material.clone();
      const {position} = originalMesh;
      if (changeCamera && position !== null) {
        this.camera.position.copy(position);
        this.camera.position.add(new three.Vector3(0, 50, 0));
        this.camera.lookAt(position);
        this.camera.updateProjectionMatrix();
      }
    }
    return this.highlightedVehicles.length > 0;
  }

  unhighlightRoute() {
    this.highlightedRoute.forEach(({highlightedMesh, originalMesh}) => {
      this.scene.remove(highlightedMesh);
      originalMesh.visible = true;
    });
  }

  unselectMeshes() {
    const {removeVehicleObject, createVehicleObject} = this;
    const remove = removeVehicleObject.bind(this);
    const create = createVehicleObject.bind(this);
    this.highlightedVehicles.forEach(vehicle => {
      remove(vehicle.id);
      create(vehicle.id, vehicle.vehicle.vehicleInfo);
    });
    this.highlightedVehicles = [];
    this.highlightedMeshes.forEach(({highlightedMesh, originalMesh}) => {
      this.scene.remove(highlightedMesh);
      originalMesh.visible = true;
    });
    this.highlightedMeshes = [];
    return;
  }

  onMouseDown(evnet: MouseEvent) {
    // Drags shouldn't lead to clicks.
    const {domElement} = this.renderer;
    this.cancelNextClick = false;
    const onMouseMove = () => {
      this.cancelNextClick = true;
    };
    const onMouseUp = () => {
      domElement.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('mouseup', onMouseUp);
    };
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mouseup', onMouseUp);
  }

  onClick(event: MouseEvent) {
    if (this.cancelNextClick) {
      // This was probably a drag, not a click.
      this.cancelNextClick = false;
      return;
    }

    const mouse = new three.Vector2();
    const el: HTMLElement = event.target as any;

    // Normalize coordinates to [-1, +1].
    mouse.x = event.offsetX / el.offsetWidth * 2 - 1;
    mouse.y = -(event.offsetY / el.offsetHeight) * 2 + 1;

    const raycaster = new three.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const intersections = raycaster.intersectObjects(this.scene.children, true);
    const groundObj = intersections.find(obj => obj.object.name === 'Land');
    const objects = intersections
      .map(intersect => this.checkParentsAndFaceForUserData(intersect))
      .filter(userData => !!userData);

    if (groundObj) {
      const {x, z} = groundObj.point;
      const sumoPoint = this.transform.xzToSumoXy([x, z]);
      const latLng = this.transform.toLatLng([x, z]);
      this.params.onClick(latLng, sumoPoint, objects);
    } else {
      this.params.onClick(null, null, objects);
    }
  }

  getVehicleInfo(vehicleId: string): VehicleInfo {
    return this.vehicles[vehicleId].vehicleInfo;
  }

  onResize() {
    const width = this.parentElement.clientWidth;
    const height = this.parentElement.clientHeight;

    // resize WebGL canvas in response to window resizes
    this.renderer.setSize(width, height);

    this.postprocessing.onResize(width, height);

    // also readjust camera so images aren't stretched or squished
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
