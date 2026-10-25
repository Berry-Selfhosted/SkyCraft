"use strict";

  
                                                        
                                                       
                                                          
   
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scripts = path.resolve(__dirname, "..", "wwwroot", "js");
const browser = { window: {} };
vm.createContext(browser);

for (const name of ["drone-scene.js", "flight-levels.js", "flight-physics.js", "flight-operations.js", "flight-scene.js"]) {
    const file = fs.readFileSync(path.join(scripts, name), "utf8");
    vm.runInContext(file, browser, { filename: name });
}

const DroneScene = browser.window.SkycraftDroneScene;
const FlightScene = browser.window.SkycraftFlightScene;
const levels = browser.window.SkycraftLevels;

function makeFlight(level = levels[0]) {
                                                                        
    const scene = Object.create(FlightScene.prototype);
    scene.level = level;
    scene.keys = new Set();
    scene.lastStatusRefresh = 123;
    scene.collisionNoticeAt = 34;
    scene.observed = [];
    scene.onChange = state => scene.observed.push(state);
    scene.reset();
    return scene;
}

test("после сброса старое время не блокирует обновление HUD", () => {
    const scene = makeFlight();
    assert.equal(scene.lastStatusRefresh, 0);
    scene.start();
    const previousCount = scene.observed.length;
    scene.armMotors();
    scene.takeoff();
    scene.flightPhase = "flying";
    scene.position.y = 4;
    scene.keys.add("KeyW");
    scene.update(0.06);
    assert.ok(scene.observed.length > previousCount, "должно прийти новое значение HUD");
    assert.ok(scene.speed > 0);
    assert.ok(scene.position.z < scene.level.start.z);
});

test("после смены уровня высота и скорость обновляются снова", () => {
    const scene = makeFlight();
    scene.start();
    scene.update(1);
    scene.selectLevel(levels[2]);
    scene.start();
    scene.armMotors();
    scene.takeoff();
    scene.keys.add("Space");
    const previousCount = scene.observed.length;
    scene.update(0.06);
    assert.ok(scene.observed.length > previousCount);
    assert.ok(scene.position.y > browser.window.SkycraftFlightOperations.GROUND_Y);
    assert.ok(scene.speed > 0);
});

test("скорость обнуляется при упоре в границу по высоте", () => {
    const scene = makeFlight();
    scene.start();
    scene.armMotors();
    scene.takeoff();
    scene.flightPhase = "flying";
    scene.position.y = 11;
    scene.keys.add("Space");
    scene.update(0.25);
    assert.equal(scene.position.y, 11);
    assert.equal(scene.velocity.y, 0);
    assert.equal(scene.speed, 0);
});

test("полёт использует только WebGL/Three.js без Canvas2D", () => {
    const drone = fs.readFileSync(path.join(scripts, 'drone-scene.js'), 'utf8');
    const flight = fs.readFileSync(path.join(scripts, 'flight-scene.js'), 'utf8');
    assert.doesNotMatch(drone, /getContext\(["']2d["']/);
    assert.doesNotMatch(flight, /drawBackground\(|drawGround\(|drawPolygons\(/);
    assert.match(drone, /this\.modernRenderer\.render\(this\)/);
});
