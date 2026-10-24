"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.join(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const orientation=require('../wwwroot/js/flight-orientation.js');
const physics=require('../wwwroot/js/flight-physics.js');

function storyLevels() {
 const context={window:{SkycraftCampaign:{chapters:Array.from({length:12},(_,i)=>({id:`story-${i+1}`,title:`Mission ${i+1}`}))}}};
 vm.runInNewContext(read('wwwroot/js/campaign-levels.js'),context);
 return context.window.SkycraftCampaignLevels.storyLevels;
}

test('12 missions share exact new uploaded low-poly scenery',()=>{
 const levels=storyLevels();
 assert.equal(levels.length,12);
 assert.equal(new Set(levels.map(l=>l.id)).size,12);
 for(const level of levels) {
  assert.equal(level.terrainModel,'hills-lake-world');
  assert.deepEqual([...level.extraColliders],[]);
  assert.deepEqual([...level.obstacles],[]);
  assert.equal(level.checkpoints.length,3);
 }
 const renderer=read('wwwroot/js/three-scene.js');
 assert.match(renderer,/asset\.name = 'UploadedHillsLakeGLB'/);
 assert.match(renderer,/asset\.scale\.setScalar\(1\)/);
 assert.match(renderer,/asset\.position\.set\(0, 0, 0\)/);
 assert.doesNotMatch(renderer,/forest-road-pbr|forest-road-mobile/);
});

test('world is >250 metres wide and the original drone mesh is unchanged',()=>{
 const source=fs.readFileSync(path.join(root,'wwwroot/assets/models/hills-lake-world.glb'));
 assert.equal(source.toString('ascii',0,4),'glTF');
 assert.equal(source.readUInt32LE(8),source.length);
 const model=JSON.parse(source.subarray(20,20+source.readUInt32LE(12)));
 assert.ok(model.nodes.some(n=>n.name==='HillsAndMountain'));
 assert.ok(model.nodes.some(n=>n.name==='LakeSurface'));
 assert.ok(model.nodes.filter(n=>n.name?.startsWith('Pine_')).length>=100);
 const map=JSON.parse(read('wwwroot/assets/models/hills-lake-heightmap.json'));
 assert.ok((map.width-1)*map.step>250);
 assert.ok((map.height-1)*map.step>250);
 assert.ok(fs.existsSync(path.join(root,'wwwroot/assets/models/frame-light.glb')));
});

test('story gate and start positions follow the actual exported terrain surface',async()=>{
 const levels=storyLevels();
 const heights=JSON.parse(read('wwwroot/assets/models/hills-lake-heightmap.json'));
 const boxes=JSON.parse(read('wwwroot/assets/models/hills-lake-obstacles.json'));
 const sandbox={window:{},fetch:async url=>({ok:true,json:async()=>url.includes('heightmap')?heights:boxes})};
 vm.runInNewContext(read('wwwroot/js/hills-terrain.js'),sandbox);
 const terrain=sandbox.window.SkycraftHillsTerrain;
 await terrain.load();
 for(const level of levels) {
  const start=level.start;
  const y=terrain.heightAt(start.x,start.z);
  assert.ok(Number.isFinite(y),`no terrain at ${level.id}`);
  assert.ok(Math.abs(start.y-y-1.87)<1.2,`start embedded in landscape ${level.id}`);
  for(const gate of level.checkpoints) {
   assert.ok(Math.abs(gate.x)<140 && Math.abs(gate.z)<140);
   const gy=terrain.heightAt(gate.x,gate.z);
   assert.ok(Number.isFinite(gy),`gate outside model ${level.id}`);
   assert.ok(gate.y>gy+3,`gate underground ${level.id}`);
  }
 }
});

test('camera-relative WASD preserves screen-facing direction after camera orbit',()=>{
 const testInput={forward:1,right:0,yaw:0,lift:0};
 const atZero=orientation.cameraRelativeInput(testInput,0);
 assert.equal(atZero.forward,1);
 assert.equal(atZero.right,0);
 const atRightAngle=orientation.cameraRelativeInput(testInput,Math.PI/2);
 assert.ok(Math.abs(atRightAngle.forward)<1e-10);
 assert.ok(Math.abs(atRightAngle.right+1)<1e-10);
 const yaw=Math.PI/3, orbit=-Math.PI/2;
 const rotate=orientation.cameraRelativeInput({forward:0,right:1,yaw:0},orbit);
 const p=physics.createState();p.attitude.yaw=yaw;
 for(let i=0;i<90;i++) physics.step(p,rotate,1/120,{weight:12,speed:60});
 const cameraYaw=yaw-orbit;
 const cameraRight=[Math.cos(cameraYaw),Math.sin(cameraYaw)];
 assert.ok(p.velocity.x*cameraRight[0]+p.velocity.z*cameraRight[1]>.4);
 const scene=read('wwwroot/js/flight-scene.js');
 assert.match(scene,/SkycraftFlightOrientation\.cameraRelativeInput/);
 assert.match(scene,/this\.cameraMode === "third"/);
});

test('old heavy forest assets are removed and new model referenced by layout',()=>{
 const models=path.join(root,'wwwroot/assets/models');
 for(const name of ['forest-road-pbr.glb','forest-road-mobile.glb','forest-road-heightmap.json']) {
  assert.equal(fs.existsSync(path.join(models,name)),false,`obsolete asset still present: ${name}`);
 }
 const layout=read('Pages/Shared/_Layout.cshtml');
 assert.match(layout,/hills-terrain\.js/);
 assert.doesNotMatch(layout,/forest-terrain\.js/);
 const scene=read('wwwroot/js/flight-scene.js');
 assert.match(scene,/supportGroundAt\(this\.position\.x, this\.position\.z/);
 assert.match(scene,/const ceiling = this\.level\.story/);
});
