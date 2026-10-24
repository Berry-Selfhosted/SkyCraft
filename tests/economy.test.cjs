"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createStore, KEYS, sellingPrice, STARTING_CREDITS } = require("../wwwroot/js/workshop-economy.js");

function memoryStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
        snapshot: () => Object.fromEntries(values)
    };
}

const frame = { id: "frame-light", name: "Лёгкий корпус", price: 80, stock: 4 };
const motor = { id: "motor-base", name: "Стандартный мотор", price: 20, stock: 8 };

function createTestStore(seed) {
    const storage = memoryStorage(seed);
    let changes = 0;
    return { storage, state: createStore(storage, () => { changes += 1; }), changed: () => changes };
}

test("существующие демо-сохранения и нулевой остаток читаются корректно", () => {
    const { state } = createTestStore({
        [KEYS.credits]: "120",
        [KEYS.inventory]: JSON.stringify({ "frame-light": 0 }),
        [KEYS.blueprints]: JSON.stringify([{ id: "drone-1", name: "Мой дрон" }])
    });
    assert.equal(state.getCredits(), 120);
    assert.equal(state.stock(frame), 0);
    assert.equal(state.stock(motor), 8);
    assert.equal(state.getBlueprints()[0].name, "Мой дрон");
});

test("покупка списывает кредиты и добавляет детали; изменения переживают перезагрузку", () => {
    const { state, storage, changed } = createTestStore();
    assert.equal(state.getCredits(), STARTING_CREDITS);
    const result = state.trade(motor, 4, "buy");
    assert.deepEqual(result, { ok: true, total: 80, credits: 340, stock: 12 });
    assert.equal(createStore(storage).getCredits(), 340);
    assert.equal(createStore(storage).stock(motor), 12);
    assert.equal(changed(), 1);
});

test("нельзя купить детали при нехватке кредитов", () => {
    const { state, storage, changed } = createTestStore({ [KEYS.credits]: "5" });
    const before = storage.snapshot();
    const result = state.trade(frame, 1, "buy");
    assert.equal(result.ok, false);
    assert.deepEqual(storage.snapshot(), before);
    assert.equal(changed(), 0);
});

test("продажа возвращает ровно 60% цены с округлением вниз", () => {
    const { state } = createTestStore({ [KEYS.credits]: "100" });
    assert.equal(sellingPrice(105), 63);
    const result = state.trade({ ...frame, price: 105 }, 2, "sell");
    assert.deepEqual(result, { ok: true, total: 126, credits: 226, stock: 2 });
    assert.equal(state.stock(frame), 2);
    assert.equal(state.getCredits(), 226);
});

test("нельзя продавать отсутствующую деталь или больше остатка", () => {
    const { state } = createTestStore();
    assert.equal(state.trade(frame, 5, "sell").ok, false);
    assert.equal(state.trade(frame, 4, "sell").ok, true);
    assert.equal(state.stock(frame), 0);
    assert.equal(state.trade(frame, 1, "sell").ok, false);
});

test("защита от дробного, нулевого, отрицательного и слишком большого количества", () => {
    const { state } = createTestStore();
    for (const badQuantity of [0, -1, 1.5, NaN, Infinity, 1000, "2", null]) {
        assert.equal(state.trade(motor, badQuantity, "buy").ok, false);
        assert.equal(state.trade(motor, badQuantity, "sell").ok, false);
    }
});

test("переименование и удаление чертежей с сохранением остальных", () => {
    const original = [
        { id: "old-1", name: "Старое имя", parts: { frame: "frame-light" } },
        { id: "old-2", name: "Другой проект" }
    ];
    const { state, storage } = createTestStore({ [KEYS.blueprints]: JSON.stringify(original) });
    assert.deepEqual(state.renameBlueprint("old-1", "  Новый дрон  "), { ok: true, name: "Новый дрон" });
    assert.equal(createStore(storage).getBlueprints()[0].name, "Новый дрон");
    assert.deepEqual(createStore(storage).getBlueprints()[0].parts, original[0].parts);
    assert.equal(state.renameBlueprint("old-2", "   ").ok, false);
    assert.equal(state.renameBlueprint("old-2", "x".repeat(49)).ok, false);
    assert.equal(state.deleteBlueprint("old-1").ok, true);
    assert.deepEqual(state.getBlueprints().map((p) => p.id), ["old-2"]);
    assert.equal(state.deleteBlueprint("old-1").ok, false);
});

test("удаление чертежа не возвращает потраченные кредиты и детали", () => {
    const { state } = createTestStore({
        [KEYS.credits]: "120",
        [KEYS.inventory]: JSON.stringify({ "frame-light": 1 }),
        [KEYS.blueprints]: JSON.stringify([{ id: "d-1", name: "Дрон" }])
    });
    assert.equal(state.deleteBlueprint("d-1").ok, true);
    assert.equal(state.getCredits(), 120);
    assert.equal(state.stock(frame), 1);
});

test("если запись localStorage не удалась, покупка откатывает деньги и склад", () => {
    const real = memoryStorage({ [KEYS.credits]: "400" });
    const failing = {
        ...real,
        setItem(key, value) {
            if (key === KEYS.inventory) throw new Error("QuotaExceededError");
            real.setItem(key, value);
        }
    };
    let changes = 0;
    const state = createStore(failing, () => changes++);
    const before = real.snapshot();
    assert.equal(state.trade(frame, 1, "buy").ok, false);
    assert.deepEqual(real.snapshot(), before);
    assert.equal(changes, 0);
});

test("если сохранение повреждено, доступны исходные значения", () => {
    const { state } = createTestStore({
        [KEYS.credits]: "not-json",
        [KEYS.inventory]: "[]",
        [KEYS.blueprints]: "invalid-json"
    });
    assert.equal(state.getCredits(), 420);
    assert.equal(state.stock(frame), 4);
    assert.deepEqual(state.getBlueprints(), []);
});

test("нет бесконечного баланса из-за некорректных данных", () => {
    const { state } = createTestStore({ [KEYS.credits]: "1e309" });
    assert.equal(state.getCredits(), 420);
});
