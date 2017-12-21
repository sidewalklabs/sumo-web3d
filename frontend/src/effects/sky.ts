// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as dat from 'dat.gui/build/dat.gui.js';
import * as three from 'three';

// Must be powers of 2.
const SHADOW_MAP_SIZES = {
  low: 1024,
  medium: 4096,
  high: 8192,
};
const SHADOW_MAP_SIZE_DEFAULT = 'medium';

// Constants tweaked for Toronto, may need changes for other places.
const TARGET_OFFSET_X = -1000;
const TARGET_OFFSET_Z = -2000;
const POS_OFFSET_X = 500;
const POS_Y = 2500;
const POS_OFFSET_Z = -5000;
const LIGHT_WIDTH = 3000;

const AMBIENT_LIGHT_COLOR = 0x444444;
const DIRECTIONAL_LIGHT_COLOR = 0xffffff;

const CUBE_DIR = '/sky/';
const CUBE_FILES = [
  'TropicalSunnyDayLeft2048.png',
  'TropicalSunnyDayRight2048.png',
  'TropicalSunnyDayUp2048.png',
  'TropicalSunnyDayDown2048.png',
  'TropicalSunnyDayFront2048.png',
  'TropicalSunnyDayBack2048.png',
];

export default function addSky(
  gui: typeof dat.gui.GUI,
  scene: three.Scene,
  centerX: number,
  centerZ: number,
) {
  // Skybox from https://93i.de/p/free-skybox-texture-set/
  // SkyboxSet by Heiko Irrgang is licensed under a Creative Commons Attribution-ShareAlike 3.0
  // Unported License. Based on a work at 93i.de.
  scene.background = new three.CubeTextureLoader().setPath(CUBE_DIR).load(CUBE_FILES);

  const ambient = new three.AmbientLight(AMBIENT_LIGHT_COLOR);
  scene.add(ambient);

  const dirLight = new three.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, 1);
  const targetObject = new three.Object3D();
  scene.add(dirLight);
  scene.add(targetObject);

  targetObject.position.set(centerX + TARGET_OFFSET_X, 0, centerZ + TARGET_OFFSET_Z);

  dirLight.position.set(centerX + POS_OFFSET_X, POS_Y, centerZ + POS_OFFSET_Z);
  dirLight.target = targetObject;
  dirLight.castShadow = true;

  const shadow = dirLight.shadow;
  shadow.mapSize.width = shadow.mapSize.height = SHADOW_MAP_SIZES[SHADOW_MAP_SIZE_DEFAULT];
  shadow.camera.left = dirLight.shadow.camera.bottom = -LIGHT_WIDTH;
  shadow.camera.right = dirLight.shadow.camera.top = LIGHT_WIDTH;
  shadow.camera.near = 0.5;
  shadow.camera.far = 10000;

  // Add GUI
  const lightsOptions = {
    shadowsEnabled: true,
    shadowSize: SHADOW_MAP_SIZE_DEFAULT,
  };
  const lightsFolder = gui.addFolder('Lights');
  lightsFolder.add(lightsOptions, 'shadowsEnabled').onChange((v: boolean) => {
    dirLight.castShadow = v;
  });
  lightsFolder
    .add(lightsOptions, 'shadowSize', Object.keys(SHADOW_MAP_SIZES))
    .onChange((v: keyof typeof SHADOW_MAP_SIZES) => {
      shadow.mapSize.width = shadow.mapSize.height = SHADOW_MAP_SIZES[v];
    });
}
