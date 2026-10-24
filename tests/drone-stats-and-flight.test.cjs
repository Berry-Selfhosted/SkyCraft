"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const project = path.resolve(__dirname, "..");
const model = require(path.join(project, "wwwroot/js/drone-stats.js"));
const source = fs.readFileSync(path.join(project, "Models/DroneCatalog.cs"), "utf8");
const pattern = /new\("([\w-]+)", "([\w-]+)", "[^"]+", "[^"]+", "[^"]+", ([\d.]+)m, (-?\d+), (-?\d+), (-?\d+), (\d+), (\d+), "[^"]+"\)/g;
const catalog = [...source.matchAll(pattern)].map((item) => ({
    id: item[1], category: item[2], weight: +item[3], speed: +item[4],
    time: +item[5], range: +item[6], price: +item[7]
}));
const base = { ...model.DEFAULTS };
const variants = (category) => catalog.filter((part) => part.category === category);
const byId = new Map(catalog.map(part => [part.id, part]));

// C# сериализует свойства в PascalCase, тогда как мастерская даёт camelCase.
test("каталог C# читается в обоих форматах и базовая сборка не меняется", () => {
    assert.equal(catalog.length, 15);
    const fromCSharp = catalog.map(part => ({
        Id: part.id, Category: part.category, WeightKg: part.weight,
        SpeedModifier: part.speed, FlightTimeModifier: part.time,
        RangeModifier: part.range, Price: part.price
    }));
    const expected = { weight: 12, speed: 60, time: 5, range: 800, price: 300 };
    assert.deepEqual(model.calculate(base, catalog), expected);
    assert.deepEqual(model.calculate(base, fromCSharp), expected);
});

test("масса и цена каждой из 243 возможных сборок считаются по количеству деталей", () => {
    let checked = 0;
    for (const frame of variants("frame"))
    for (const motor of variants("motor"))
    for (const propeller of variants("propeller"))
    for (const battery of variants("battery"))
    for (const electronics of variants("electronics")) {
        const selection = Object.fromEntries([frame, motor, propeller, battery, electronics]
            .map(part => [part.category, part.id]));
        const specs = model.calculate(selection, catalog);
        const expectedWeight = [frame, battery, electronics].reduce((n, p) => n + p.weight, 0)
            + 4 * (motor.weight + propeller.weight);
        const expectedPrice = frame.price + 4 * motor.price + 4 * propeller.price
            + battery.price + electronics.price;
        assert.ok(Math.abs(specs.weight - expectedWeight) < 0.051);
        assert.equal(specs.price, expectedPrice);
        assert.ok(specs.speed >= 15 && specs.speed <= 130);
        assert.ok(specs.time >= 1 && specs.time <= 25);
        assert.ok(specs.range >= 100);
        assert.ok(Number.isFinite(specs.range));
        checked++;
    }
    assert.equal(checked, 243);
});

test("детали меняют характеристики в ожидаемом направлении", () => {
    const baseStats = model.calculate(base, catalog);
    const change = (category, id) => model.calculate({ ...base, [category]: id }, catalog);
    assert.ok(change("frame", "frame-carbon").weight < baseStats.weight);
    assert.ok(change("motor", "motor-race").speed > baseStats.speed);
    assert.ok(change("motor", "motor-eco").time > baseStats.time);
    assert.ok(change("propeller", "prop-sport").speed > baseStats.speed);
    assert.ok(change("battery", "battery-long").time > baseStats.time);
    assert.ok(change("battery", "battery-long").range > baseStats.range);
    assert.ok(change("battery", "battery-light").range < baseStats.range);
    assert.ok(change("electronics", "chip-nav").range > baseStats.range);
    assert.throws(() => model.calculate({ ...base, motor: "missing" }, catalog));
});

test("скорость/время/рейтинг дальности не суммируются четырежды у комплекта моторов", () => {
    const changed = model.calculate({ ...base, motor: "motor-race" }, catalog);
    // 0.4 кг дополнительно за четыре гоночных мотора: 60 + 20 - 0.4 * 1.5.
    assert.equal(changed.speed, 79.4);
    assert.equal(changed.weight, 12.4);
    assert.equal(changed.price, 80 + 4 * 38 + 4 * 10 + 65 + 35);
});

const browser = { window: {} };
vm.createContext(browser);
for (const filename of ["drone-scene.js", "flight-levels.js", "flight-physics.js", "flight-operations.js", "flight-scene.js"]) {
    vm.runInContext(fs.readFileSync(path.join(project, "wwwroot/js", filename), "utf8"),
        browser, { filename });
}
const FlightScene = browser.window.SkycraftFlightScene;
const standardLevel = browser.window.SkycraftLevels[0];
function createFlight(specs = model.calculate(base, catalog)) {
    const scene = Object.create(FlightScene.prototype);
    scene.level = { ...standardLevel, obstacles: [], boundary: 500 };
    scene.onChange = () => {};
    scene.keys = new Set();
    scene.setFlightSpecs(specs);
    return scene;
}

test("максимальная скорость дрона действительно используется в полёте", () => {
    const fast = createFlight(model.calculate({ ...base, motor: "motor-race" }, catalog));
    const normal = createFlight();
    for (const scene of [fast, normal]) {
        scene.start();
        scene.armMotors();
        scene.takeoff();
        scene.flightPhase = "flying";
        scene.position.y = 4;
        scene.keys.add("KeyW");
        // Местоположение внутри тренировочного уровня, без препятствий.
        for (let i = 0; i < 18; i++) scene.update(0.06);
    }
    // При физическом разгоне за 1 сек различие умеренное: скорость не задаётся мгновенно.
    assert.ok(fast.speed > normal.speed + 1, `${fast.speed} vs ${normal.speed}`);
    assert.ok(fast.speed <= fast.flightSpecs.speed + 0.001);
    assert.ok(normal.speed <= normal.flightSpecs.speed + 0.001);
});

test("одновременное движение по нескольким осям не превышает максимальную скорость", () => {
    const scene = createFlight();
    scene.start();
    scene.keys.add("KeyW"); scene.keys.add("KeyD"); scene.keys.add("Space");
    for (let i = 0; i < 22; i++) {
        scene.update(0.05);
        assert.ok(scene.speed <= scene.flightSpecs.speed + 1e-7);
    }
});

test("батарея разряжается в полёте, не разряжается на паузе, завершает испытание", () => {
    const scene = createFlight();
    scene.start();
    scene.armMotors();
    scene.takeoff();
    scene.update(0.1);
    assert.ok(scene.remainingBattery < 100);
    scene.pause();
    const timeBeforePause = scene.time;
    scene.update(0.1);
    assert.equal(scene.time, timeBeforePause);
    scene.pause();
    scene.batteryUsed = scene.flightSpecs.time * 60 * 0.96;
    scene.update(0.05);
    assert.equal(scene.flightPhase, "landing");
    assert.equal(scene.failsafeLanding, true);
    for (let i = 0; i < 600 && scene.mode === "running"; i++) scene.update(0.05);
    assert.equal(scene.mode, "depleted");
    assert.equal(scene.flightPhase, "disarmed");
    assert.equal(scene.speed, 0);
    scene.reset();
    assert.equal(scene.remainingBattery, 100);
    assert.equal(scene.time, 0);
});

test("дальность проверяется как безопасный радиус от старта", () => {
    const scene = createFlight({ weight: 12, speed: 100, time: 5, range: 100 });
    const originalX = scene.level.start.x + 99.99;
    scene.start();
    scene.armMotors();
    scene.takeoff();
    scene.flightPhase = "flying";
    scene.position.y = 4;
    scene.position.x = originalX;
    scene.keys.add("KeyD");
    scene.update(0.2);
    assert.equal(scene.position.x, originalX);
    assert.equal(scene.velocity.x, 0);
});

test("общий модуль загружается до крафта, полёта и главной страницы", () => {
    const layout = fs.readFileSync(path.join(project, "Pages/Shared/_Layout.cshtml"), "utf8");
    assert.match(layout, /skycraft-parts-catalog/);
    assert.ok(layout.indexOf('~/js/drone-stats.js') < layout.indexOf('~/js/workshop.js'));
    assert.ok(layout.indexOf('~/js/drone-stats.js') < layout.indexOf('~/js/flight-game.js'));
    assert.ok(layout.indexOf('~/js/drone-stats.js') < layout.indexOf('~/js/home-scene.js'));
});
