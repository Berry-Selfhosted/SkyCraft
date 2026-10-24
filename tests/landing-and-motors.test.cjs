"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const browser = { window: {} };
vm.createContext(browser);
for (const name of ["drone-scene.js", "flight-levels.js", "flight-physics.js",
    "flight-operations.js", "rotor-dynamics.js", "flight-scene.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "wwwroot/js", name), "utf8"),
        browser, { filename: name });
}
const FlightScene = browser.window.SkycraftFlightScene;
const operations = browser.window.SkycraftFlightOperations;
function makeScene() {
    const scene = Object.create(FlightScene.prototype);
    scene.level = { ...browser.window.SkycraftLevels[0], obstacles: [], boundary: 500 };
    scene.keys = new Set();
    scene.flightSpecs = { weight: 12, speed: 60, time: 5, range: 800 };
    scene.configuration = { motor: "motor-base", propeller: "prop-base", battery: "battery-base" };
    scene.events = [];
    scene.onChange = (state) => scene.events.push(state);
    scene.reset();
    scene.start();
    return scene;
}
function inAir(scene) {
    assert.equal(scene.armMotors(), true);
    assert.equal(scene.takeoff(), true);
    scene.flightPhase = "flying";
    scene.position.y = 4.3;
    return scene;
}
function stepFor(scene, seconds, fps = 60) {
    for (let i = 0; i < Math.round(seconds * fps) && scene.mode === "running"; i++) {
        scene.update(1 / fps);
    }
}

test("на земле двигатели выключены и ввод W/Space не поднимает дрон", () => {
    const scene = makeScene();
    assert.equal(scene.flightPhase, "disarmed");
    assert.equal(scene.takeoff(), false);
    scene.keys.add("Space"); scene.keys.add("KeyW");
    stepFor(scene, 3);
    assert.equal(scene.position.y, operations.GROUND_Y);
    assert.equal(scene.speed, 0);
    assert.equal(scene.remainingBattery, 100);
    assert.equal(browser.window.SkycraftRotorDynamics.averageRpm(scene.rotorState), 0);
});

test("после запуска моторы работают на холостых, но тяга не сдвигает дрон", () => {
    const scene = makeScene();
    assert.equal(scene.armMotors(), true);
    scene.keys.add("KeyW");
    stepFor(scene, 1);
    assert.equal(scene.flightPhase, "armed");
    assert.equal(scene.speed, 0);
    assert.equal(scene.position.y, operations.GROUND_Y);
    assert.ok(browser.window.SkycraftRotorDynamics.averageRpm(scene.rotorState) > 500);
    assert.ok(scene.remainingBattery < 100);
    assert.equal(scene.disarmMotors(), true);
    stepFor(scene, 3);
    assert.ok(browser.window.SkycraftRotorDynamics.averageRpm(scene.rotorState) < 5);
});

test("взлёт возможен только после запуска моторов и заканчивается фазой flying", () => {
    const scene = makeScene();
    assert.equal(scene.takeoff(), false);
    scene.armMotors();
    assert.equal(scene.takeoff(), true);
    stepFor(scene, 6);
    assert.equal(scene.flightPhase, "flying");
    assert.ok(scene.position.y > 3.3);
    assert.ok(scene.speed <= scene.flightSpecs.speed + 0.001);
});

test("в воздухе нельзя выключить двигатели, в режиме автопосадки ввод блокируется", () => {
    const scene = inAir(makeScene());
    assert.equal(scene.disarmMotors(), false);
    scene.keys.add("KeyW");
    assert.equal(scene.land(), true);
    assert.equal(scene.flightPhase, "landing");
    assert.equal(scene.keys.size, 0);
    assert.equal(scene.disarmMotors(), false);
    assert.equal(scene.takeoff(), false);
});

test("автопосадка тормозит, опускается и выключает моторы, после чего полёт запрещён", () => {
    const scene = inAir(makeScene());
    scene.velocity.x = 2.1;
    scene.velocity.z = -1.6;
    assert.equal(scene.land(), true);
    stepFor(scene, 18);
    assert.equal(scene.flightPhase, "disarmed");
    assert.equal(scene.lastTouchdown, "soft");
    assert.equal(scene.position.y, operations.GROUND_Y);
    assert.equal(scene.speed, 0);
    assert.equal(scene.takeoff(), false);
    scene.keys.add("Space"); scene.keys.add("KeyW");
    stepFor(scene, 2);
    assert.equal(scene.speed, 0);
    assert.equal(scene.position.y, operations.GROUND_Y);
    assert.equal(scene.armMotors(), true);
    assert.equal(scene.takeoff(), true);
});

test("автопосадку разрешено отменить до касания земли", () => {
    const scene = inAir(makeScene());
    scene.land();
    stepFor(scene, 0.4);
    assert.equal(scene.land(), true);
    assert.equal(scene.flightPhase, "flying");
    assert.equal(scene.failsafeLanding, false);
});

test("резкое падение распознаётся как жёсткая посадка и выключает моторы", () => {
    const scene = inAir(makeScene());
    scene.position.y = operations.GROUND_Y + 0.05;
    scene.velocity.y = -4;
    stepFor(scene, 0.05);
    assert.equal(scene.flightPhase, "disarmed");
    assert.equal(scene.lastTouchdown, "hard");
    assert.equal(scene.speed, 0);
});

test("при снижении батареи до 10% запускается посадка, которую нельзя отменить", () => {
    const scene = inAir(makeScene());
    scene.batteryUsed = scene.flightSpecs.time * 60 * 0.90;
    stepFor(scene, 0.15);
    assert.equal(scene.failsafeLanding, true);
    assert.equal(scene.flightPhase, "landing");
    assert.equal(scene.land(), false);
    stepFor(scene, 18);
    assert.equal(scene.mode, "depleted");
    assert.equal(scene.flightPhase, "disarmed");
});

test("финиш трассы ожидает посадку и только потом завершает испытание", () => {
    const scene = inAir(makeScene());
    scene.completed = scene.level.checkpoints.length - 1;
    const target = scene.level.checkpoints.at(-1);
    scene.position.x = target.x;
    scene.position.y = target.y;
    scene.position.z = target.z;
    scene.update(1/60);
    assert.equal(scene.completionPending, true);
    assert.equal(scene.flightPhase, "landing");
    assert.equal(scene.mode, "running");
    stepFor(scene, 20);
    assert.equal(scene.mode, "done");
    assert.equal(scene.flightPhase, "disarmed");
});

test("полёт без нижней плашки: двигатели, взлёт и посадка доступны с клавиатуры", () => {
    const html = fs.readFileSync(path.join(root, "Pages/Flight.cshtml"), "utf8");
    const ui = fs.readFileSync(path.join(root, "wwwroot/js/flight-game.js"), "utf8");
    const layout = fs.readFileSync(path.join(root, "Pages/Shared/_Layout.cshtml"), "utf8");
    assert.doesNotMatch(html, /id="flight-motors"|id="flight-takeoff"|id="flight-land"/);
    assert.doesNotMatch(html, /class="flight-controls-bottom"/);
    assert.match(html, /<kbd>M<\/kbd>/);
    assert.match(html, /<kbd>L<\/kbd>/);
    assert.match(ui, /event\.code === "Enter"/);
    assert.match(fs.readFileSync(path.join(root, "wwwroot/js/flight-scene.js"), "utf8"), /this\.armMotors\(\)/);
    assert.match(fs.readFileSync(path.join(root, "wwwroot/js/flight-scene.js"), "utf8"), /this\.land\(\)/);
    assert.ok(layout.indexOf('~/js/flight-operations.js') < layout.indexOf('~/js/flight-scene.js'));
});


test("клавиатура M, Space и L вызывает те же действия, что и кнопки", () => {
    browser.HTMLElement = class HTMLElement {};
    const scene = makeScene();
    const press = (code) => scene.handleKey({
        type: "keydown", code, repeat: false, target: {}, preventDefault() {}
    });
    press("Space");
    assert.equal(scene.flightPhase, "disarmed");
    press("KeyM");
    assert.equal(scene.flightPhase, "armed");
    press("Space");
    assert.equal(scene.flightPhase, "takeoff");
    press("KeyM");
    assert.equal(scene.flightPhase, "takeoff", "в воздухе M не отключает моторы");
    press("KeyL");
    assert.equal(scene.flightPhase, "landing");
});

test("пауза сохраняет фазу, высоту и заряд", () => {
    const scene = inAir(makeScene());
    stepFor(scene, 0.2);
    scene.pause();
    const position = { ...scene.position };
    const time = scene.time;
    const battery = scene.remainingBattery;
    stepFor(scene, 5);
    assert.equal(scene.mode, "paused");
    assert.deepEqual({ ...scene.position }, position);
    assert.equal(scene.time, time);
    assert.equal(scene.remainingBattery, battery);
    scene.pause();
    assert.equal(scene.mode, "running");
});
