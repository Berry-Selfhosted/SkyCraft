"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const js = path.join(root, "wwwroot/js");
const physics = require(path.join(js, "flight-physics.js"));
const specs = { weight: 12, speed: 60, time: 5, range: 800 };

function move(input, seconds = 2, fps = 60, data = specs) {
    const state = physics.createState();
    for (let i = 0; i < Math.round(seconds * fps); i++) {
        physics.step(state, input, 1 / fps, data);
    }
    return state;
}

test("W наклоняет нос и даёт инерционный разгон в направлении -Z", () => {
    const state = move({ forward: 1 });
    assert.ok(state.attitude.pitch > .4 && state.attitude.pitch < .44);
    assert.ok(state.velocity.z < -2.5);
    assert.ok(state.position.z < 8);
    assert.ok(state.velocity.x < 0.01);
});

test("отпускание газа не вызывает мгновенной остановки, противоположный тангаж тормозит", () => {
    const coast = move({ forward: 1 }, 2);
    const braking = structuredClone(coast);
    const cruising = structuredClone(coast);
    physics.step(cruising, {}, 0.05, specs);
    physics.step(braking, { forward: -1 }, 0.05, specs);
    assert.ok(Math.abs(cruising.velocity.z) > 1);
    assert.ok(Math.abs(braking.velocity.z) < Math.abs(cruising.velocity.z));
});

test("Q/E плавно вращают дрон, W после разворота ведёт в сторону курса", () => {
    const state = physics.createState();
    for (let i = 0; i < 120; i++) physics.step(state, { yaw: 1 }, 1 / 60, specs);
    assert.ok(state.attitude.yaw > 1.5);
    for (let i = 0; i < 60; i++) physics.step(state, { forward: 1 }, 1 / 60, specs);
    // После поворота почти на 180° движение вперёд идёт в сторону +Z.
    assert.ok(state.position.z > 11.5);
});

test("тяга изменяет высоту с инерцией, в нейтрали стабилизация высоты", () => {
    const raised = move({ lift: 1 }, 1);
    assert.ok(raised.position.y > 2.5);
    assert.ok(raised.velocity.y > 0);
    const before = raised.velocity.y;
    physics.step(raised, {}, 0.1, specs);
    assert.ok(raised.velocity.y > 0 && raised.velocity.y < before);
});

test("масса влияет на ускорение, предел скорости зависит от сборки", () => {
    const light = move({ forward: 1 }, 3, 60, specs);
    const heavy = move({ forward: 1 }, 3, 60, { ...specs, weight: 22 });
    assert.ok(Math.abs(light.velocity.z) > Math.abs(heavy.velocity.z));
    const fast = move({ forward: 1 }, 8, 60, { ...specs, speed: 90 });
    const slow = move({ forward: 1 }, 8, 60, { ...specs, speed: 35 });
    assert.ok(Math.abs(fast.velocity.z) > Math.abs(slow.velocity.z));
    assert.ok(Math.hypot(...Object.values(slow.velocity)) * 3.6 <= 35 + 1e-6);
});

test("подшаги физики дают почти одинаковую траекторию на 30 и 120 FPS", () => {
    const a = move({ forward: 1, right: 1, yaw: 1 }, 2, 30);
    const b = move({ forward: 1, right: 1, yaw: 1 }, 2, 120);
    assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) < .05);
});

const browser = { window: {} };
vm.createContext(browser);
for (const filename of ["drone-scene.js", "flight-levels.js", "flight-physics.js", "flight-operations.js", "flight-orientation.js", "flight-scene.js"]) {
    vm.runInContext(readFileSync(path.join(js, filename), "utf8"), browser, { filename });
}
const FlightScene = browser.window.SkycraftFlightScene;
const sampleLevel = browser.window.SkycraftLevels[0];
function sceneMock() {
    const scene = Object.create(FlightScene.prototype);
    scene.level = sampleLevel;
    scene.keys = new Set();
    scene.onChange = () => {};
    scene.yaw = 0.22; scene.elevation = 0.38; scene.distance = 17;
    scene.cameraMode = "third";
    scene.width = 960; scene.height = 600;
    scene.reset();
    return scene;
}

test("переключатель V меняет камеру и не сбрасывает физику, таймер или ворота", () => {
    const scene = sceneMock();
    scene.start();
    scene.update(0.20);
    scene.completed = 1;
    const elapsed = scene.time, pos = { ...scene.position };
    scene.toggleCameraMode();
    assert.equal(scene.cameraMode, "first");
    assert.equal(scene.time, elapsed);
    assert.equal(scene.completed, 1);
    assert.deepEqual({ ...scene.position }, pos);
    scene.updateCamera();
    const firstCamera = scene.camera.position;
    scene.toggleCameraMode();
    scene.updateCamera();
    assert.equal(scene.cameraMode, "third");
    assert.ok(Math.hypot(...firstCamera.map((n,i) => n - scene.camera.position[i])) > 5);
});

test("FPV направлена вперёд по курсу и скрывает внешний корпус в рендере", () => {
    const scene = sceneMock();
    scene.setCameraMode("first");
    scene.attitude.yaw = Math.PI / 2;
    scene.updateCamera();
    assert.ok(scene.camera.forward[0] > .99);
    assert.ok(Math.abs(scene.camera.forward[2]) < .01);
    assert.match(readFileSync(path.join(js, "three-scene.js"), "utf8"),
        /this\.drone\.visible = controller\.cameraMode !== 'first'/);
});

test("страница содержит доступную кнопку FPV, подсказку V и управление рысканьем", () => {
    const html = readFileSync(path.join(root, "Pages/Flight.cshtml"), "utf8");
    const layout = readFileSync(path.join(root, "Pages/Shared/_Layout.cshtml"), "utf8");
    assert.match(html, /id="flight-camera-toggle"/);
    assert.match(html, /data-flight-stick="lift"/);
    assert.match(html, /data-flight-action="camera"/);
    assert.ok(layout.indexOf("~/js/flight-physics.js") < layout.indexOf("~/js/flight-scene.js"));
});
