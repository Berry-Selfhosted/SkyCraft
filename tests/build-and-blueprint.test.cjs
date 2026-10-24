"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createStore, KEYS } = require("../wwwroot/js/workshop-economy.js");

function storage(initial = {}) {
    const records = new Map(Object.entries(initial));
    return {
        getItem: (key) => records.has(key) ? records.get(key) : null,
        setItem: (key, value) => records.set(key, String(value)),
        removeItem: (key) => records.delete(key),
        records: () => Object.fromEntries(records)
    };
}

const parts = {
    frame: "frame-light", motor: "motor-base", propeller: "prop-base",
    battery: "battery-base", electronics: "chip-base"
};
const catalog = [
    { category: "frame", id: parts.frame, name: "Корпус", price: 80, stock: 4 },
    { category: "motor", id: parts.motor, name: "Мотор", price: 20, stock: 8 },
    { category: "propeller", id: parts.propeller, name: "Винт", price: 15, stock: 8 },
    { category: "battery", id: parts.battery, name: "Аккумулятор", price: 40, stock: 4 },
    { category: "electronics", id: parts.electronics, name: "Электроника", price: 40, stock: 4 }
];
const stats = { weight: 12, speed: 60, time: 5, range: 800, price: 300 };
const trackedKeys = [KEYS.credits, KEYS.inventory, KEYS.blueprints, KEYS.drones];

function economicState(store) {
    return {
        credits: store.getCredits(), inventory: catalog.map((part) => store.stock(part)),
        blueprints: store.getBlueprints().length, drones: store.getDrones().length
    };
}

test("создание чертежа бесплатно даже при нулевом балансе и складе", () => {
    const local = storage({
        [KEYS.credits]: "0",
        [KEYS.inventory]: JSON.stringify(Object.fromEntries(catalog.map((part) => [part.id, 0])))
    });
    const store = createStore(local);
    const before = economicState(store);
    const result = store.saveBlueprint(parts, stats, " Мой чертёж ");
    assert.equal(result.ok, true);
    assert.equal(result.blueprint.name, "Мой чертёж");
    assert.deepEqual({ ...economicState(store), blueprints: 0 }, before);
    assert.equal(store.getBlueprints()[0].parts.motor, "motor-base");
    assert.equal(createStore(local).getBlueprints().length, 1);
});

test("сборка создаёт готовый экземпляр, но не новый чертёж", () => {
    const store = createStore(storage());
    store.saveBlueprint(parts, stats);
    const result = store.assembleDrone(parts, catalog, stats);
    assert.equal(result.ok, true);
    assert.equal(result.cost, 300);
    assert.equal(store.getCredits(), 120);
    assert.deepEqual(catalog.map((part) => store.stock(part)), [3, 4, 4, 3, 3]);
    assert.equal(store.getBlueprints().length, 1);
    assert.equal(store.getDrones().length, 1);
    assert.equal(store.getActiveDrone().id, result.drone.id);
});

test("удаление чертежа не удаляет собранный дрон и не трогает ресурсы", () => {
    const store = createStore(storage());
    const blueprint = store.saveBlueprint(parts, stats).blueprint;
    const drone = store.assembleDrone(parts, catalog, stats).drone;
    const before = economicState(store);
    assert.equal(store.deleteBlueprint(blueprint.id).ok, true);
    assert.equal(store.getBlueprints().length, 0);
    assert.equal(store.getDrones()[0].id, drone.id);
    assert.equal(store.getCredits(), before.credits);
    assert.deepEqual(catalog.map((part) => store.stock(part)), before.inventory);
});

test("сборка запрещена без денег или комплектации; чертёж при этом доступен", () => {
    const local = storage({ [KEYS.credits]: "100" });
    const store = createStore(local);
    const before = local.records();
    assert.equal(store.assembleDrone(parts, catalog, stats).ok, false);
    assert.deepEqual(local.records(), before);
    assert.equal(store.saveBlueprint(parts, stats).ok, true);
    const store2 = createStore(storage({
        [KEYS.inventory]: JSON.stringify({ "motor-base": 3 })
    }));
    assert.equal(store2.assembleDrone(parts, catalog, stats).ok, false);
});

test("выбранный полётный дрон может быть только из готовых экземпляров", () => {
    const store = createStore(storage());
    const blueprint = store.saveBlueprint(parts, stats).blueprint;
    assert.equal(store.getActiveDrone(), null);
    assert.equal(store.selectDrone(blueprint.id).ok, false);
    const first = store.assembleDrone(parts, catalog, stats).drone;
    const second = store.assembleDrone(parts, catalog, stats); // не хватает денег
    assert.equal(second.ok, false);
    assert.equal(store.selectDrone(first.id).ok, true);
    assert.equal(store.getActiveDrone().id, first.id);
});

test("старые платные проекты версии 0.7 становятся собранными без повторного списания", () => {
    const legacy = [{ id: "paid-v07", name: "Мой первый дрон", date: "2026-10-23T10:00:00Z", parts, ...stats }];
    const local = storage({
        [KEYS.credits]: "120", [KEYS.blueprints]: JSON.stringify(legacy),
        [KEYS.inventory]: JSON.stringify({ "frame-light": 2 })
    });
    const store = createStore(local);
    assert.equal(store.getBlueprints().length, 1);
    assert.equal(store.getDrones().length, 1);
    assert.equal(store.getDrones()[0].sourceBlueprintId, "paid-v07");
    assert.equal(store.getCredits(), 120);
    assert.equal(store.stock(catalog[0]), 2);
    const again = createStore(local);
    assert.equal(again.getDrones().length, 1);
    again.deleteBlueprint("paid-v07");
    assert.equal(again.getDrones().length, 1);
});

test("ошибка записи собранного дрона откатывает списание денег и деталей", () => {
    const local = storage();
    const failing = {
        ...local,
        setItem(key, value) {
            if (key === KEYS.drones && JSON.parse(value).length > 0) throw Error("QuotaExceededError");
            local.setItem(key, value);
        }
    };
    const store = createStore(failing);
    const before = trackedKeys.map((key) => local.getItem(key));
    assert.equal(store.assembleDrone(parts, catalog, stats).ok, false);
    assert.deepEqual(trackedKeys.map((key) => local.getItem(key)), before);
});

test("интерфейс предлагает обе кнопки и отключает полёт без собранного дрона", () => {
    const root = path.resolve(__dirname, "..");
    const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(source("Pages/Constructor.cshtml"), /id="create-blueprint-button"/);
    assert.match(source("Pages/Constructor.cshtml"), /id="assemble-button"/);
    assert.match(source("Pages/Play.cshtml"), /id="mission-drone-select"/);
    assert.match(source("wwwroot/js/flight-game.js"), /const ready = !!\(selectedDrone \|\| currentLevel\?\.tutorial \|\| currentLevel\?\.story\)/);
    assert.doesNotMatch(source("wwwroot/js/flight-scene.js"), /localStorage\.getItem\("skycraft\.selection\.v1"\)/);
    assert.match(source("Pages/Shared/_Layout.cshtml"), /asp-page="\/Hangar"/);
});

// Регрессия v0.8.1: в разметке должна быть ровно одна кнопка каждого действия.
test("в конструкторе только одна кнопка чертежа и одна кнопка сборки", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../Pages/Constructor.cshtml"), "utf8");
    assert.equal((html.match(/id="create-blueprint-button"/g) || []).length, 1);
    assert.equal((html.match(/id="assemble-button"/g) || []).length, 1);
    assert.equal((html.match(/class="build-action-hint"/g) || []).length, 1);
    assert.equal((html.match(/class="build-actions"/g) || []).length, 1);
});


test("кнопка «Играть» ведёт из конструктора к выбору готового дрона", () => {
    const root = path.resolve(__dirname, "..");
    const constructor = fs.readFileSync(path.join(root, "Pages/Constructor.cshtml"), "utf8");
    const flight = fs.readFileSync(path.join(root, "Pages/Flight.cshtml"), "utf8");
    assert.equal((constructor.match(/class="constructor-play-link"/g) || []).length, 1);
    assert.match(constructor, /class="constructor-play-link" asp-page="\/Play"/);
    assert.doesNotMatch(flight, /id="flight-drone-select"/);
    assert.doesNotMatch(flight, /id="flight-start"|class="flight-controls-bottom"/);
    assert.match(fs.readFileSync(path.join(root, "wwwroot/js/flight-game.js"), "utf8"), /event.code === "Enter"/);
    assert.match(fs.readFileSync(path.join(root, "Pages/Play.cshtml"), "utf8"), /id="mission-drone-select"/);
    // Навигационная ссылка не должна вызывать клиентский метод покупки или сборки.
    assert.doesNotMatch(constructor.match(/<a class="constructor-play-link"[\s\S]*?<\/a>/)[0], /assembleDrone|saveBlueprint|data-buy/);
});
