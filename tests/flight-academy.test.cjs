"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const tutorial = require("../wwwroot/js/flight-tutorial.js");

function state(position = { x:0, y:1.87, z:12 }) {
    return { mode:"running", flightPhase:"disarmed", altitude:0,
        horizontalSpeed:0, position, heading:0, cameraMode:"third", completed:0 };
}
function completeLesson() {
    const lesson = tutorial.create(), sample = state();
    const tick = (dt = 0.02) => tutorial.update(lesson, sample, dt);
    tick(); // старт
    sample.flightPhase = "armed"; tick();
    sample.flightPhase = "flying"; sample.altitude = 3.6; tick();
    for (let i = 0; i < 120; i++) tick(1 / 60);
    sample.altitude = 5.3; tick();
    sample.position = {x:0,y:7.17,z:6}; tick();
    sample.position = {x:0,y:7.17,z:10}; tick();
    sample.position = {x:3.3,y:7.17,z:10}; tick();
    sample.heading = Math.PI/2; tick();
    sample.cameraMode = "first"; tick();
    sample.completed = 2; tick();
    return { lesson, sample, tick };
}

test("в академии 14 уроков, финальный всегда безопасная посадка", () => {
    assert.equal(tutorial.LESSONS.length, 14);
    assert.equal(tutorial.LESSONS[0].id, "start");
    assert.equal(tutorial.LESSONS.at(-1).id, "landing");
    const s = tutorial.create();
    assert.equal(tutorial.details(s).completed, 0);
    assert.equal(tutorial.details(s).progress, 0);
});

test("уроки считаются по физике: высота, инерция, смещение, угол и FPV", () => {
    const s = tutorial.create(), pos = { x:0, y:1.87, z:12 }, sample = state(pos);
    const tick = (dt = .02) => tutorial.update(s, sample, dt);
    tick(); assert.equal(tutorial.active(s).id, "motors");
    sample.flightPhase = "armed"; tick(); assert.equal(tutorial.active(s).id, "takeoff");
    sample.flightPhase = "flying"; sample.altitude = 3.6; tick(); assert.equal(tutorial.active(s).id, "hover");
    sample.horizontalSpeed = 4; tick(1); assert.equal(s.stableFor, 0);
    sample.horizontalSpeed = 0.1;
    for (let i=0; i<130; i++) tick(1/60);
    assert.equal(tutorial.active(s).id, "ascend");
    sample.altitude = 5.2; tick(); assert.equal(tutorial.active(s).id, "descend");
    sample.altitude = 3.4; tick(); assert.equal(tutorial.active(s).id, "forward");
    sample.position = { x:0, y:7.17, z:8 }; tick(); assert.equal(tutorial.active(s).id, "forward");
    sample.position = { x:0, y:7.17, z:4.5 }; tick(); assert.equal(tutorial.active(s).id, "backward");
    sample.position = { x:0, y:7.17, z:8 }; tick(); assert.equal(tutorial.active(s).id, "strafe");
    sample.position = { x:3.5, y:7.17, z:8 }; tick(); assert.equal(tutorial.active(s).id, "strafe-left");
    sample.position = { x:0, y:7.17, z:8 }; tick(); assert.equal(tutorial.active(s).id, "yaw");
    sample.heading = Math.PI/2; tick(); assert.equal(tutorial.active(s).id, "camera");
    sample.cameraMode = "first"; tick(); assert.equal(tutorial.active(s).id, "gates");
    sample.completed = 1; tick(); assert.equal(tutorial.active(s).id, "gates");
    sample.completed = 2; tick(); assert.equal(tutorial.active(s).id, "landing");
    sample.flightPhase = "disarmed"; sample.touchdown = true; tick();
    assert.equal(s.finished, false, "касания земли без команды L недостаточно");
    s.landingOrdered = true; tick(); assert.equal(s.finished,true);
    assert.equal(s.passed.length,14);
});

test("обучение не продвигается в паузе и не является покупкой", () => {
    const s = tutorial.create(), sample = state();
    sample.mode="paused";
    assert.equal(tutorial.update(s,sample,10),false);
    assert.equal(s.index,0);
    for (const file of ["wwwroot/js/flight-game.js","wwwroot/js/flight-tutorial.js"]) {
        assert.doesNotMatch(read(file), /assembleDrone\(|buyPart\(|sellPart\(/);
    }
});

test("обучение — отдельная 3D-карта с GLB, доступная без готового дрона", () => {
    const context={window:{}}; vm.createContext(context);
    vm.runInContext(read("wwwroot/js/flight-levels.js"),context);
    assert.equal(context.window.SkycraftLevels.length,4);
    const academy=context.window.SkycraftLevels.find(item=>item.tutorial);
    assert.equal(academy.id,"academy");
    assert.equal(academy.checkpoints.length,2);
    assert.deepEqual(Array.from(context.window.SkycraftLevels.filter(x=>!x.tutorial).map(x=>x.id)),
        ["hangar","training","canyon"]);
    assert.match(read("wwwroot/js/flight-game.js"),/loanerSpecs/);
    assert.match(read("wwwroot/js/flight-game.js"),/trainingKey/);
    for (const asset of ["academy-course","academy-beacons"]) {
        const raw=fs.readFileSync(path.join(root,`wwwroot/assets/models/${asset}.glb`));
        assert.equal(raw.toString("ascii",0,4),"glTF");
        assert.equal(raw.readUInt32LE(8),raw.length);
        assert.match(read("wwwroot/js/three-scene.js"),new RegExp(asset));
    }
});

test("уровни заперты, пока обучение не отмечено завершённым", () => {
    const game=read("wwwroot/js/flight-game.js");
    assert.match(game,/if \(!level\.tutorial && !trained\)/);
    assert.match(read("wwwroot/js/flight-select.js"), /if \(selected !== "academy" && !trained\)/);
    assert.match(game,/SkycraftProfiles\.storage\.setItem\(trainingKey, "true"\)/);
    assert.match(read("wwwroot/js/flight-select.js"), /mission-map-card/);
    assert.match(read("Pages/Flight.cshtml"),/id="flight-lesson-card"/);
});

// Проверяем интеграцию со сценой без браузера; обычная карта должна вести себя по-старому.
test("симулятор не завершает академию по двум воротам без посадки", () => {
    const context={window:{}}; vm.createContext(context);
    for(const file of ["drone-scene.js","flight-levels.js","flight-physics.js",
        "flight-operations.js","rotor-dynamics.js","flight-tutorial.js","flight-scene.js"])
        vm.runInContext(read(`wwwroot/js/${file}`),context,{filename:file});
    const Scene=context.window.SkycraftFlightScene;
    const scene=Object.create(Scene.prototype);
    scene.onChange=()=>{};
    scene.level=context.window.SkycraftLevels.find(level=>level.tutorial);
    scene.keys=new Set(); scene.flightSpecs={weight:12,speed:60,time:12,range:1200};
    scene.configuration={motor:"motor-base",propeller:"prop-base",battery:"battery-base"};
    scene.reset(); scene.start(); scene.armMotors(); scene.takeoff();
    assert.equal(scene.tutorial.passed[0],"start");
    assert.equal(scene.tutorial.passed[1],"motors");
    scene.flightPhase="flying"; scene.position.y=5.3;
    scene.tutorial.index=12; scene.tutorial.passed=Array.from({length:12},(_,i)=>tutorial.LESSONS[i].id);
    scene.completed=2;
    scene.updateTutorial(.016);
    assert.equal(scene.tutorial.index,13);
    assert.equal(scene.mode,"running");
    assert.equal(scene.land(),true);
    assert.equal(scene.tutorial.landingOrdered,true);
    scene.touchGround({hard:false});
    assert.equal(scene.mode,"done");
    assert.equal(scene.tutorial.finished,true);
});

test("жёсткая посадка в академии не открывает уровни", () => {
    const s = tutorial.create();
    s.index = 13;
    s.landingOrdered = true;
    const sample = state();
    sample.flightPhase = "disarmed";
    sample.touchdown = false;
    tutorial.update(s,sample,0);
    assert.equal(s.finished,false);
    assert.equal(tutorial.active(s).id,"landing");
});
