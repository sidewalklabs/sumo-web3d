// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
// We're going to use imports-loader to inject three as a global into modules that expect it,
// then re-export the modules that got attached to three. Basically a bridge between a global
// three and an es6-module-based one. When three is entirely ported to modules, this may
// not be necessary.

import * as three from 'three';

// Re-export shaders
require('imports-loader?THREE=three!three/examples/js/shaders/CopyShader.js');
require('imports-loader?THREE=three!three/examples/js/shaders/SMAAShader.js');
require('imports-loader?THREE=three!three/examples/js/shaders/SSAOShader.js');

// Re-export passes
// Must inject Pass via EffectComposer first
require('imports-loader?THREE=three!three/examples/js/postprocessing/EffectComposer.js');
require('imports-loader?THREE=three!three/examples/js/postprocessing/SMAAPass.js');
require('imports-loader?THREE=three!three/examples/js/postprocessing/RenderPass.js');
require('imports-loader?THREE=three!three/examples/js/postprocessing/ShaderPass.js');

export const EffectComposer = (three as any).EffectComposer;
export const CopyShader = (three as any).CopyShader;
export const RenderPass = (three as any).RenderPass;
export const ShaderPass = (three as any).ShaderPass;
export const SSAOShader = (three as any).SSAOShader;
export const SMAAShader = (three as any).SMAAShader;
export const SMAAPass = (three as any).SMAAPass;
