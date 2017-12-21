// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as dat from 'dat.gui/build/dat.gui.js';
import * as three from 'three';
import {
  CopyShader,
  EffectComposer,
  RenderPass,
  ShaderPass,
  SMAAPass,
  SSAOShader,
} from './vendor-shaders';

// TODO(canderson): magic numbers
const FOG_COLOR = 0xaaaaaa;
export const FOG_RATE = 0.0005;

export default class Effects {
  private camera: three.Camera;
  private scene: three.Scene;
  private renderer: three.Renderer;
  private gui: typeof dat.gui.GUI;

  private depthMaterial: three.MeshDepthMaterial;
  private depthRenderTarget: three.WebGLRenderTarget;
  private composer: typeof EffectComposer;

  private effectsEnabled: {
    ssao: boolean;
    smaa: boolean;
    fog: boolean;
  };
  private ssaoPass: typeof ShaderPass;
  private ssaoParams: {
    cameraNear: number;
    cameraFar: number;
    radius: number;
    aoClamp: number;
    lumInfluence: number;
    onlyAO: boolean;
  };
  private smaaPass: typeof SMAAPass;
  private fog: three.IFog;

  constructor(
    camera: three.Camera,
    scene: three.Scene,
    renderer: three.Renderer,
    gui: typeof dat.gui.GUI,
    width: number,
    height: number,
    centerX: number,
    centerZ: number,
  ) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.gui = gui;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = three.PCFSoftShadowMap;

    this.scene.fog = this.fog = new three.FogExp2(FOG_COLOR, FOG_RATE);

    this.depthMaterial = new three.MeshDepthMaterial();
    this.depthMaterial.depthPacking = three.RGBADepthPacking;
    this.depthMaterial.blending = three.NoBlending;
    this.depthRenderTarget = new three.WebGLRenderTarget(width, height, {
      minFilter: three.LinearFilter,
      magFilter: three.LinearFilter,
      format: three.RGBAFormat,
    });

    this.initPostprocessing(width, height);
    this.onResize(width, height);
  }

  private initPostprocessing(width: number, height: number) {
    const effectsFolder = this.gui.addFolder('Effects');
    const ssaoFolder = this.gui.addFolder('SSAO');

    const updateSSAO = () => {
      this.ssaoPass.uniforms['cameraNear'].value = this.ssaoParams.cameraNear;
      this.ssaoPass.uniforms['cameraFar'].value = this.ssaoParams.cameraFar;
      this.ssaoPass.uniforms['radius'].value = this.ssaoParams.radius;
      this.ssaoPass.uniforms['aoClamp'].value = this.ssaoParams.aoClamp;
      this.ssaoPass.uniforms['lumInfluence'].value = this.ssaoParams.lumInfluence;
      this.ssaoPass.uniforms['onlyAO'].value = this.ssaoParams.onlyAO;
    };
    this.ssaoParams = {
      cameraNear: 7,
      cameraFar: 3000,
      radius: 128,
      aoClamp: 0.5,
      lumInfluence: 0.9,
      onlyAO: false,
    };
    ssaoFolder.add(this.ssaoParams, 'cameraNear', 0.1, 100).onChange(updateSSAO);
    ssaoFolder.add(this.ssaoParams, 'cameraFar', 100, 5000).onChange(updateSSAO);
    ssaoFolder.add(this.ssaoParams, 'radius', 1, 256).onChange(updateSSAO);
    ssaoFolder.add(this.ssaoParams, 'aoClamp', 0, 1).onChange(updateSSAO);
    ssaoFolder.add(this.ssaoParams, 'lumInfluence', 0, 1).onChange(updateSSAO);
    ssaoFolder.add(this.ssaoParams, 'onlyAO').onChange(updateSSAO);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);

    // Screen Space Ambient Occlusion approximates true ambient occlusion, which is the fact
    // that ambient light does not travel to interiors.
    this.ssaoPass = new ShaderPass(SSAOShader);
    this.ssaoPass.uniforms['tDepth'].value = this.depthRenderTarget.texture;
    this.ssaoPass.uniforms['size'].value.set(width, height);

    // Subpixel Morphological Antialiasing is an efficient technique to provide antialiasing.
    this.smaaPass = new SMAAPass(width, height);
    this.smaaPass.needsSwap = true;
    const copyPass = new ShaderPass(CopyShader);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.smaaPass);
    this.composer.addPass(this.ssaoPass);
    copyPass.renderToScreen = true;
    this.composer.addPass(copyPass);

    this.effectsEnabled = {
      ssao: true,
      smaa: true,
      fog: true,
    };
    effectsFolder.add(this.effectsEnabled, 'smaa').onChange((v: boolean) => {
      this.smaaPass.enabled = v;
    });
    effectsFolder.add(this.effectsEnabled, 'ssao').onChange((v: boolean) => {
      this.ssaoPass.enabled = v;
    });
    effectsFolder.add(this.effectsEnabled, 'fog').onChange((v: boolean) => {
      if (v) {
        this.scene.fog = this.fog;
      } else {
        this.scene.fog = null as any;
      }
    });
  }

  render() {
    this.composer.render();
  }

  onResize(width: number, height: number) {
    const pixelRatio = window.devicePixelRatio;
    const newWidth = Math.floor(width * pixelRatio) || width;
    const newHeight = Math.floor(height * pixelRatio) || height;
    this.composer.setSize(newWidth, newHeight);
  }
}
