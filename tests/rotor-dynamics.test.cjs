"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const rotor = require(path.join(root, "wwwroot/js/rotor-dynamics.js"));
const gravity = { weight: 12, speed: 60, time: 5, range: 800 };
const base = { motor: "motor-base", propeller: "prop-base", battery: "battery-base" };
const running = { mode: "running", specs: gravity, configuration: base, battery: 100 };
function run(options = running, seconds = 3, fps = 60) {
    const state = rotor.createState();
    for (let i = 0; i < Math.round(seconds * fps); i++) rotor.step(state, options, 1 / fps);
    return state;
}

test("чёткий порядок расположения и чередование направлений вращения", () => {
    assert.deepEqual(rotor.ROTORS.map(r => r.direction), [1, -1, -1, 1]);
    assert.equal(rotor.createState().rotors.length, 4);
});

test("в покое винты обесточены, в висении имеют тысячи RPM", () => {
    const idle = run({ ...running, mode: "ready" });
    assert.equal(rotor.averageRpm(idle), 0);
    const hover = run();
    assert.ok(rotor.averageRpm(hover) > 3400 && rotor.averageRpm(hover) < 4600);
    const values = hover.rotors.map(r => r.rpm);
    assert.ok(values.every(v => Math.abs(v - values[0]) < 1));
});

test("газ вверх увеличивает средние обороты, снижение уменьшает", () => {
    const hover = rotor.averageRpm(run());
    assert.ok(rotor.averageRpm(run({ ...running, input: { lift: 1 } })) > hover + 700);
    assert.ok(rotor.averageRpm(run({ ...running, input: { lift: -1 } })) < hover - 750);
});

test("команды крена и тангажа меняют разные пары моторов", () => {
    const pitch = rotor.calculateTargets({ ...running, input: { forward: 1 }, attitude: { pitch: 0 } }).targets;
    assert.ok(pitch[1] > pitch[0]);                                        
    assert.ok(pitch[3] > pitch[2]);
    const roll = rotor.calculateTargets({ ...running, input: { right: 1 }, attitude: { roll: 0 } }).targets;
    assert.ok(roll[0] > roll[2]);                                            
    assert.ok(roll[1] > roll[3]);
});

test("рыскание Q/E создаёт противоположный момент без изменения суммарной тяги", () => {
    const yawRight = rotor.calculateTargets({ ...running, input: { yaw: 1 } }).targets;
    const yawLeft = rotor.calculateTargets({ ...running, input: { yaw: -1 } }).targets;
    assert.ok(yawRight[0] < yawRight[1]);
    assert.ok(yawLeft[0] > yawLeft[1]);
    const x = yawRight.reduce((sum, rpm) => sum + rpm * rpm, 0);
    const y = yawLeft.reduce((sum, rpm) => sum + rpm * rpm, 0);
    assert.ok(Math.abs(x-y) / x < 0.001);
});

test("завершённый наклон почти выравнивает обороты", () => {
    const before = rotor.calculateTargets({ ...running, input: { forward: 1 }, attitude: { pitch: 0 } }).targets;
    const after = rotor.calculateTargets({ ...running, input: { forward: 1 }, attitude: { pitch: 0.43 } }).targets;
    assert.ok(Math.abs(after[1] - after[0]) < Math.abs(before[1] - before[0]));
});

test("масса, батарея, моторы и винты влияют на реальные целевые RPM", () => {
    const normal = rotor.calculateTargets(running);
    const heavy = rotor.calculateTargets({ ...running, specs: { ...gravity, weight: 19 } });
    const lowBattery = rotor.calculateTargets({ ...running, battery: 2 });
    assert.ok(heavy.targets[0] > normal.targets[0]);
    assert.ok(lowBattery.targets[0] < normal.targets[0]);
    assert.ok(rotor.getProfile({ ...base, motor: "motor-race" }).maxRpm > rotor.getProfile(base).maxRpm);
    assert.ok(rotor.getProfile({ ...base, propeller: "prop-quiet" }).maxRpm < rotor.getProfile(base).maxRpm);
    assert.ok(normal.targets.every(n => n >= 0 && n <= normal.profile.maxRpm));
});

test("ESC не ускоряет двигатель мгновенно и замедляется после выключения", () => {
    const state = rotor.createState();
    rotor.step(state, running, 1/60);
    assert.ok(rotor.averageRpm(state) > 0 && rotor.averageRpm(state) < 600);
    for (let i = 0; i < 90; i++) rotor.step(state, running, 1 / 60);
    const before = rotor.averageRpm(state);
    rotor.step(state, { ...running, mode: "done" }, 1 / 60);
    assert.ok(rotor.averageRpm(state) < before && rotor.averageRpm(state) > 0);
    for (let i = 0; i < 360; i++) rotor.step(state, { mode: "depleted" }, 1 / 60);
    assert.equal(rotor.averageRpm(state), 0);
});

test("на паузе RPM и фазы заморожены", () => {
    const state = run();
    const old = structuredClone(state);
    rotor.step(state, { ...running, mode: "paused", input: { lift: 1 } }, 0.2);
    assert.deepEqual(state, old);
});

test("фаза винтов вращается в правильные стороны, без переполнения угла", () => {
    const state = rotor.createState();
    rotor.step(state, running, 0.002);
    assert.ok(state.rotors.every(r => r.angle >= 0 && r.angle < Math.PI * 2));
    assert.ok(state.rotors[0].angle > 0 && state.rotors[1].angle > 0);
    assert.notEqual(state.rotors[0].angle, state.rotors[1].angle);
});

test("результаты вращения одинаковы на 30, 60 и 120 FPS", () => {
    const r30 = run(running, 5, 30);
    const r120 = run(running, 5, 120);
    assert.ok(Math.abs(rotor.averageRpm(r30) - rotor.averageRpm(r120)) < 1);
    assert.ok(Math.abs(r30.rotors[0].angle - r120.rotors[0].angle) < 0.5);
});

test("страница подключает модуль до рендера, присутствует HUD RPM", () => {
    const layout = readFileSync(path.join(root, "Pages/Shared/_Layout.cshtml"), "utf8");
    assert.ok(layout.indexOf('~/js/rotor-dynamics.js') < layout.indexOf('~/js/drone-scene.js'));
    assert.ok(layout.indexOf('~/js/rotor-dynamics.js') < layout.indexOf('~/js/flight-scene.js'));
    assert.match(readFileSync(path.join(root, "Pages/Flight.cshtml"), "utf8"), /id="flight-rpm"/);
    assert.match(readFileSync(path.join(root, "wwwroot/js/three-scene.js"), "utf8"), /controller\.rotorState\?\.rotors/);
});
