"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "wwwroot/js/flight-collisions.js");
const collisions = require(modulePath);
const levelsVm = { window: {} };
vm.createContext(levelsVm);
vm.runInContext(fs.readFileSync(path.join(root,"wwwroot/js/flight-levels.js"),"utf8"), levelsVm);
const levels = levelsVm.window.SkycraftLevels;

const p = (x,y,z) => ({x,y,z});

test("прохождение через тонкую стену на большой скорости невозможно", () => {
    const wall = collisions.box("Стена", [0,3,0], [12,6,0.08]);
    const v = p(0,0,-60);
    const result = collisions.move(p(0,3,6), p(0,3,-6),v,[wall]);
    assert.equal(result.collision.name,"Стена");
    assert.ok(result.position.z > 0.9, `collision stop should be in front of wall: ${result.position.z}`);
    assert.ok(result.velocity.z > -5, "velocity should lose normal component");
});

test("при ударе под углом сохраняется скольжение вдоль стены", () => {
    const wall = collisions.box("Стена",[0,3,0],[12,6,.2]);
    const result = collisions.move(p(0,3,3), p(4,3,-3), p(7,0,-11), [wall]);
    assert.ok(result.position.x > 1.0, "sliding must preserve tangential movement");
    assert.ok(result.position.z > 1.0, "no penetration");
    assert.ok(result.velocity.x > 0);
});

test("вертикальный перелёт выше ящика не сталкивается с ним", () => {
    const crate=collisions.box("Контейнер",[0,1,0],[2,2,2]);
    const result=collisions.move(p(0,5,5),p(0,5,-5),p(0,0,-10),[crate]);
    assert.equal(result.collision,null);
    assert.equal(result.position.z,-5);
});

test("коллайдеры имеют размеры по объектам уровней и не мешают старту", () => {
    for (const level of levels) {
        const world=collisions.build(level);
        assert.ok(world.length >= 4);
        assert.ok(world.every(item => [item.min.x,item.min.y,item.min.z,item.max.x,item.max.y,item.max.z].every(Number.isFinite)));
        const center=p(level.start.x, 1.87, level.start.z);
        assert.equal(collisions.sweep(center, center, world),null,`spawn must be clear: ${level.id}`);
    }
});

test("академические мачты и колонны ангара не являются декорацией без коллизии", () => {
    const academy=collisions.build(levels.find(l=>l.id==="academy"));
    const hangar=collisions.build(levels.find(l=>l.id==="hangar"));
    assert.ok(academy.some(c=>c.name==="Мачта академии"));
    assert.ok(hangar.some(c=>c.name==="Колонна ангара"));
    const hit=collisions.sweep(p(12,3,15),p(23,3,15),academy);
    assert.equal(hit.collider.name,"Мачта академии");
});

test("третье лицо может ограничить дистанцию камеры по столкновению", () => {
    const blocker=collisions.box("Стена",[0,3,4],[8,6,.4]);
    const hit=collisions.sweep(p(0,3,0),p(0,3,10),[blocker],.25);
    assert.ok(hit && hit.t > .3 && hit.t < .5);
});

test("Three.js обеспечивает освещение PBR, fog и аппаратный Z-буфер", () => {
    const renderer=fs.readFileSync(path.join(root,"wwwroot/js/three-scene.js"),"utf8");
    for (const token of ["WebGLRenderer", "HemisphereLight", "DirectionalLight",
        "FogExp2", "ACESFilmicToneMapping", "GLTFLoader"]) {
        assert.ok(renderer.includes(token),token);
    }
    assert.equal(fs.existsSync(path.join(root,"wwwroot/js/webgl-renderer.js")),false);
});

test("порядок подключений на странице полёта: коллизии перед сценой", () => {
    const razor=fs.readFileSync(path.join(root,"Pages/Shared/_Layout.cshtml"),"utf8");
    assert.ok(razor.includes("~/js/flight-collisions.js"));
    assert.ok(razor.indexOf("~/js/flight-collisions.js") < razor.indexOf("~/js/flight-scene.js"));
});

test("система FlightScene использует sweep и не проходит через коробку", () => {
    const context = { window: { SkycraftCollisions: collisions }, HTMLElement: class {} };
    vm.createContext(context);
    for (const filename of ["drone-scene.js", "flight-physics.js", "flight-operations.js", "flight-scene.js"]) {
        vm.runInContext(fs.readFileSync(path.join(root, "wwwroot/js", filename), "utf8"), context, {filename});
    }
    const level = {
        kind: "training", start: p(0, 2.2, 4), boundary: 30,
        obstacles: [{ type:"crate", x:0, z:0, size:2 }],
        checkpoints: [{ x:0,y:3,z:-20,radius:2 }]
    };
    const scene = Object.create(context.window.SkycraftFlightScene.prototype);
    scene.level = level;
    scene.keys = new Set();
    scene.colliders = collisions.build(level);
    scene.onChange = () => {};
    scene.reset(); scene.start(); scene.armMotors(); scene.takeoff();
    scene.flightPhase = "flying";
    scene.position.y = 2.5;
    scene.position.z = 3.5;
    scene.velocity.z = -16;
    scene.update(.25);
    assert.ok(scene.position.z > 1.8, `physics should stop at collider: ${scene.position.z}`);
    assert.ok(scene.velocity.z > -8, "normal velocity must be damped");
});
