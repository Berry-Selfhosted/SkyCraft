'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const heightmap=JSON.parse(read('wwwroot/assets/models/hills-lake-heightmap.json'));
const sandbox={window:{SkycraftCampaign:{chapters:Array.from({length:12},(_,i)=>({id:`story-${String(i+1).padStart(2,'0')}`}))}}};
vm.runInNewContext(read('wwwroot/js/campaign-levels.js'),sandbox);
const levels=sandbox.window.SkycraftCampaignLevels.storyLevels;
function heightAt(x,z){
 const {xMin,zMin,step,width,height,heights}=heightmap;
 const fx=(x-xMin)/step,fz=(z-zMin)/step;
 assert.ok(fx>=0&&fx<width-1&&fz>=0&&fz<height-1,'within heightfield');
 const ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz;
 const a=heights[iz*width+ix],b=heights[iz*width+ix+1],c=heights[(iz+1)*width+ix],d=heights[(iz+1)*width+ix+1];
 return a*(1-tx)*(1-tz)+b*tx*(1-tz)+c*(1-tx)*tz+d*tx*tz;
}
test('all rescue objectives in 12 chapters have traversable map coordinates and valid heights',()=>{
 assert.equal(levels.length,12);
 for(const l of levels){
  assert.equal(l.checkpoints.length,3,l.id);
  for(const p of [l.start,...l.checkpoints]){
   assert.ok(Math.abs(p.x)<l.boundary && p.z>=l.backBoundary && p.z<=l.frontBoundary,`${l.id} unreachable target at ${p.x},${p.z}`);
   const expected=heightAt(p.x,p.z)+(p===l.start?1.87:5.5);
   assert.ok(Math.abs(p.y-expected)<0.005,`${l.id} incorrect height at ${p.x},${p.z}`);
  }
 }
});
test('visual target and drone objectives use the same heightfield, and weather effects are real 3D primitives',()=>{
 const renderer=read('wwwroot/js/three-scene.js');
 assert.match(renderer,/SkycraftHillsTerrain\?\.heightAt\(point\.x, point\.z\)/);
 assert.match(renderer,/point\.y = groundY \+ 5\.2/);
 assert.match(renderer,/makeRescueTarget\(THREE, markerPoint/);
 assert.match(renderer,/new THREE\.LineSegments\(geometry, material\)/);
 assert.match(renderer,/new THREE\.Points\(geometry, material\)/);
 for(const biome of ['storm','snow','mud','lake']) assert.match(renderer,new RegExp(`'${biome}'`));
});
