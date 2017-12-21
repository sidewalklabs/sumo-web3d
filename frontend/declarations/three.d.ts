// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
// The @types/three package is incomplete for Renderer, MeshDepthMaterial, and Scene.
// Comments about individual additions are below.

import {
  Scene,
  Camera,
  Material,
  DepthPackingStrategies,
  MeshDepthMaterialParameters,
  WebGLRenderTarget,
  WebGLShadowMap,
  Object3D,
  IFog,
} from 'three';

declare module 'three' {
  interface Renderer {
    domElement: HTMLCanvasElement;
    autoClear: boolean;
    shadowMap: WebGLShadowMap;

    // Extended render method
    render(scene: Scene, camera: Camera, target?: WebGLRenderTarget, clear?: boolean): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
  }

  class MeshDepthMaterial extends Material {
    constructor(parameters?: MeshDepthMaterialParameters);

    // Added depthPacking
    depthPacking: DepthPackingStrategies;

    wireframe: boolean;
    wireframeLinewidth: number;

    setValues(parameters: MeshDepthMaterialParameters): void;
  }

  export class Scene extends Object3D {
    constructor();

    /**
     * A fog instance defining the type of fog that affects everything rendered in the scene. Default is null.
     */
    fog: IFog;

    /**
     * If not null, it will force everything in the scene to be rendered with that material. Default is null.
     */
    // Allow for null overrideMaterial
    overrideMaterial: Material | null;
    autoUpdate: boolean;
    background: any;

    toJSON(meta?: any): any;
  }
}
