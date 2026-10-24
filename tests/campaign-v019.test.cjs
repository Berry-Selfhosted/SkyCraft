"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root=path.join(__dirname,"..");
const { chapters, createStore, SAVE_KEY } = require("../wwwroot/js/campaign-story.js");
const effects = require("../wwwroot/js/campaign-effects.js");
function memory() { const data=new Map(); return { getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)) }; }
function file(p) { return fs.readFileSync(path.join(root,p),"utf8"); }
test("Сюжет состоит ровно из 12 уникальных глав и 24 решений",()=>{
    assert.equal(chapters.length,12);
    assert.equal(new Set(chapters.map(c=>c.id)).size,12);
    chapters.forEach((c,i)=>{
        assert.equal(c.index,i+1);
        assert.equal(c.choices.length,2);
        assert.ok(c.summary.length>30);
        assert.notEqual(c.choices[0].modifier,c.choices[1].modifier);
    });
});
test("Все 12 глав используют импортированную GLB-сцену холмов и озера",()=>{
    assert.equal(chapters.length,12);
    for(const name of ['hills-lake-world.glb']) {
        const b=fs.readFileSync(path.join(root,'wwwroot/assets/models',name));
        assert.equal(b.toString('ascii',0,4),'glTF');
        assert.equal(b.readUInt32LE(4),2);
        assert.equal(b.readUInt32LE(8),b.length);
    }
    const code=file('wwwroot/js/campaign-levels.js');
    assert.match(code,/terrainModel: "hills-lake-world"/);
    assert.doesNotMatch(code,/detailModels:|model: "operation-valley"/);
});
test("Нельзя открыть следующую главу до дебрифинга",()=>{
    const st=createStore(memory());
    assert.equal(st.unlocked(1),true);
    assert.equal(st.unlocked(2),false);
    assert.equal(st.choose(1,"high"),false);
    assert.equal(st.complete(1,74),true);
    assert.equal(st.unlocked(2),false);
    assert.equal(st.choose(1,"high"),true);
    assert.equal(st.unlocked(2),true);
    assert.equal(st.modifierFor(2),"wind");
});
test("Смена решения в прошлом обнуляет последующие главы, но не расходует экономику",()=>{
    const local=memory(),store=createStore(local);
    store.complete(1,79);store.choose(1,"high");
    store.complete(2,90);store.choose(2,"audio");
    assert.equal(store.unlocked(3),true);
    store.choose(1,"low");
    assert.equal(store.modifierFor(2),"gps");
    assert.equal(store.unlocked(3),false);
    assert.equal(store.read().finished[2],undefined);
    assert.equal(local.getItem(SAVE_KEY).includes('"choices"'),true);
});
test("У двенадцатой главы два исхода кампании",()=>{
    for(const [decision,ending] of [["cable","rescue"],["beacon","beacon"]]){
        const state=memory(),st=createStore(state);
        for(let i=1;i<=12;i++){
            st.complete(i,50+i);
            st.choose(i,i===12?decision:chapters[i-1].choices[0].id);
        }
        assert.equal(st.ending(),ending);
        assert.equal(st.read().finished[12],true);
    }
});
test("Экологические воздействия связаны с вводом, временем и батареей",()=>{
    const a=effects.create("wind"), physics={position:{x:0,y:2,z:0},velocity:{x:0,y:0,z:0}};
    effects.before(a,{forward:0,right:0,lift:0,yaw:0},.12);
    effects.after(a,physics,.12,"river");
    assert.notEqual(physics.velocity.x,0);
    assert.equal(effects.range(effects.create("range"),800),95);
    assert.ok(effects.drain(effects.create("battery"),3)>1);
    const lag=effects.create("lag");
    assert.equal(effects.before(lag,{forward:1,right:0,lift:0,yaw:0},.05).forward,0);
    assert.ok(effects.action(effects.create("lidar")).length>10);
});
test("Полёт загружает карты, открывает дебрифинг и сохраняет решение",()=>{
    const layout=file("Pages/Shared/_Layout.cshtml");
    const flight=file("wwwroot/js/flight-game.js");
    const scene=file("wwwroot/js/flight-scene.js");
    assert.match(layout,/campaign-levels\.js/);
    assert.doesNotMatch(scene,/this\.drawGround\(/);
    assert.match(file("wwwroot/js/three-scene.js"), /asset\.name = 'UploadedHillsLakeGLB'/);
    assert.match(flight,/campaignStore\?\.complete/);
    assert.match(flight,/campaignStore\?\.choose/);
    assert.match(file("Pages/Campaign.cshtml"),/id="campaign-chapters"/);
    assert.match(file("Pages/Flight.cshtml"),/id="flight-campaign-debrief"/);
});
