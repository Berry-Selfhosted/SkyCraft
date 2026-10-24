"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const models = ['frame-light','frame-heavy','frame-carbon','motor-base',
'motor-race','motor-eco','prop-base','prop-sport','prop-quiet',
'battery-base','battery-long','battery-light','chip-base','chip-nav','chip-ai'];

test('все 15 деталей остаются валидными glTF 2.0', () => {
    for (const name of models) {
        const data = fs.readFileSync(path.join(root,'wwwroot/assets/models',name+'.glb'));
        assert.equal(data.toString('ascii',0,4),'glTF',name);
        assert.equal(data.readUInt32LE(4),2,name);
        assert.equal(data.readUInt32LE(8),data.length,name);
    }
});
test('сборка тела и четырёх пропеллеров происходит в Three.js без Canvas2D', () => {
    const src=fs.readFileSync(path.join(root,'wwwroot/js/three-scene.js'),'utf8');
    assert.match(src, /async rebuildDrone\(configuration\)/);
    assert.match(src, /for \(const x of \[(-2\.33|[-.0-9, ]+)\]/);
    assert.match(src, /this\.rotors\.push\(p\)/);
    assert.match(src, /GLTFLoader/);
    assert.doesNotMatch(fs.readFileSync(path.join(root,'wwwroot/js/drone-scene.js'),'utf8'), /getContext\(["']2d["']/);
});
