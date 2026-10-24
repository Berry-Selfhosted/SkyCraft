'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('прежняя 2D-полигональная сцена не запускается даже при загрузке GLB', () => {
    const viewport = read('wwwroot/js/drone-scene.js');
    const flight = read('wwwroot/js/flight-scene.js');
    const layout = read('Pages/Shared/_Layout.cshtml');
    assert.doesNotMatch(viewport, /getContext\(["']2d["']/);
    assert.doesNotMatch(viewport, /drawBackground\(|drawPolygons\(|buildHangar\(/);
    assert.doesNotMatch(flight, /drawGround\(|drawObstacles\(|drawBackground\(/);
    assert.doesNotMatch(layout, /webgl-renderer\.js|glb-model-loader\.js/);
    assert.match(viewport, /setRenderStatus\('loading'/);
    assert.match(viewport, /setRenderStatus\('error'/);
});

test('у новой карты постоянный мировой трансформ, независимый от камеры и дрона', () => {
    const src = read('wwwroot/js/three-scene.js');
    assert.match(src, /this\.environment\.name = 'StaticWorld'/);
    assert.match(src, /this\.environment\.matrixAutoUpdate = false/);
    assert.match(src, /this\.drone\.name = 'PlayerDrone'/);
    assert.match(src, /this\.scene\.add\(this\.environment, this\.drone\)/);
    assert.match(src, /asset\.position\.set\(0, 0, 0\)/);
    assert.match(src, /asset\.rotation\.set\(0, 0, 0\)/);
    assert.match(src, /this\.camera\.lookAt\(cameraTarget\)/);
    assert.doesNotMatch(src, /this\.environment\.(?:position|rotation)\.(?:set|copy)\([^)]*(?:controller|attitude)/);
});

test('в сюжетных уровнях нет ссылок на устаревшие GLB-сцены', () => {
    const source=read('wwwroot/js/campaign-levels.js');
    assert.match(source, /terrainModel: "hills-lake-world"/);
    assert.doesNotMatch(source, /operation-valley|operation-skyline|detailModels:/);
    const models=path.join(root,'wwwroot/assets/models');
    assert.ok(fs.existsSync(path.join(models,'hills-lake-world.glb')));
    assert.ok(!fs.existsSync(path.join(models,'forest-road-pbr.glb')));
    assert.ok(!fs.existsSync(path.join(models,'operation-valley.glb')));
});
