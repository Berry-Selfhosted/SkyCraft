"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ids=['hangar-floor','hangar-shell','hangar-structure','hangar-lighting','hangar-props'];
const src=name=>fs.readFileSync(path.join(root,name),'utf8');

test('пять деталей ангара — полноценные glTF 2.0',()=>{
  for(const id of ids){
    const data=fs.readFileSync(path.join(root,'wwwroot/assets/models',id+'.glb'));
    assert.equal(data.toString('ascii',0,4),'glTF');
    assert.equal(data.readUInt32LE(4),2);
    assert.equal(data.readUInt32LE(8),data.length);
  }
});
test('главное меню и мастерская используют Three.js и модульный ангар',()=>{
  const layout=src('Pages/Shared/_Layout.cshtml');
  const renderer=src('wwwroot/js/three-scene.js');
  assert.match(layout,/home-scene\.js/);
  assert.match(src('wwwroot/js/home-scene.js'),/new HomeScene\(canvas\)/);
  assert.match(renderer,/loadModel\(this\.assetLoader/);
  for(const id of ids) assert.match(renderer,new RegExp(id));
});
test('старый Canvas2D и резервный процедурный ангар удалены',()=>{
  const code=src('wwwroot/js/drone-scene.js');
  assert.doesNotMatch(code,/getContext\(["']2d["']/);
  assert.doesNotMatch(code,/buildHangar\(|drawPolygons\(/);
  assert.ok(!fs.existsSync(path.join(root,'wwwroot/js/webgl-renderer.js')));
});
