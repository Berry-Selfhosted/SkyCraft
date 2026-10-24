"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT=path.join(__dirname,"..");
const source=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const model=p=>fs.readFileSync(path.join(ROOT,'wwwroot/assets/models',p));

test('12 story chapters use hills-lake scenery and distinct map coordinates',()=>{
 const context={window:{SkycraftCampaign:{chapters:Array.from({length:12},(_,i)=>({id:`story-${i+1}`,title:`Chapter ${i+1}`}))}}};
 vm.runInNewContext(source('wwwroot/js/campaign-levels.js'),context);
 const levels=context.window.SkycraftCampaignLevels.storyLevels;
 assert.equal(levels.length,12);
 assert.equal(new Set(levels.map(l=>`${l.start.x}:${l.start.z}`)).size,12);
 for(const chapter of levels){
   assert.equal(chapter.terrainModel,'hills-lake-world');
   assert.equal(chapter.checkpoints.length,3);
   assert.ok(chapter.start.y>1.87);
   assert.ok(chapter.checkpoints.every(p=>p.y>2));
   assert.ok(chapter.boundary>100);
 }
});
test('native Blender terrain exported as a real GLB 2.0 scene',()=>{
 const bytes=model('hills-lake-world.glb');
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const len=bytes.readUInt32LE(12);
 const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
 assert.ok(gltf.nodes.length>50);
 assert.ok(gltf.meshes.length>40);
 assert.ok(gltf.nodes.some(x=>x.name==='HillsAndMountain'));
 assert.ok(gltf.nodes.some(x=>x.name==='LakeSurface'));
 assert.ok(gltf.nodes.some(x=>x.name?.startsWith('Pine_')));
 assert.equal(fs.existsSync(path.join(ROOT,'wwwroot/assets/models','forest-road-pbr.glb')),false);
});
test('Three.js retains PBR, shadows and a fixed world transform',()=>{
 const code=source('wwwroot/js/three-scene.js');
 assert.match(code,/GLTFLoader/);
 assert.match(code,/ACESFilmicToneMapping/);
 assert.match(code,/PCFSoftShadowMap/);
 assert.match(code,/hills-lake-world/);
 assert.match(code,/asset\.position\.set\(0, 0, 0\)/);
 assert.doesNotMatch(code,/forest-road/);
 assert.match(source('wwwroot/js/drone-scene.js'),/three-scene\.js\?v=0\.31\.0/);
});
test('heightfield and tree proxies use same terrain as mesh', async()=>{
 const heights=JSON.parse(source('wwwroot/assets/models/hills-lake-heightmap.json'));
 const obstacles=JSON.parse(source('wwwroot/assets/models/hills-lake-obstacles.json'));
 const window={};
 const fetch=async url=>({ok:true,json:async()=>url.includes('heightmap')?heights:obstacles});
 vm.runInNewContext(source('wwwroot/js/hills-terrain.js'),{window,fetch});
 const terrain=window.SkycraftHillsTerrain;
 await terrain.load();
 assert.ok(terrain.colliderBoxes().length>80);
 assert.ok(Number.isFinite(terrain.heightAt(-68,69)));
 assert.equal(terrain.heightAt(9999,9999),null);
 assert.ok(terrain.groundAt(-68,69)>1.87);
});
test('collisions include hills/lake tree trunks after loading',()=>{
 const obstacles=JSON.parse(source('wwwroot/assets/models/hills-lake-obstacles.json')).boxes;
 const context={window:{SkycraftHillsTerrain:{colliderBoxes:()=>obstacles}},module:{exports:{}}};
 vm.runInNewContext(source('wwwroot/js/flight-collisions.js'),context);
 const result=context.module.exports.build({terrainModel:'hills-lake-world',boundary:138,frontBoundary:125,backBoundary:-130,obstacles:[]});
 assert.ok(result.some(c=>c.name==='Ствол дерева'));
 assert.equal(result.filter(c=>c.name==='Граница полигона').length,4);
});
