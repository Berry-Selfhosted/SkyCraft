"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const rewards = require(path.join(root, "wwwroot/js/flight-rewards.js"));
const economy = require(path.join(root, "wwwroot/js/workshop-economy.js"));

function mockStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
        values,
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => { values.set(key, String(value)); },
        removeItem: (key) => values.delete(key)
    };
}

function source(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

test("от академии до каньона выплаты привязаны к сложности", () => {
    assert.equal(rewards.calculate({ id: "academy" }).total, 150);
    assert.equal(rewards.calculate({ id: "hangar" }).total, 100);
    assert.equal(rewards.calculate({ id: "training" }).total, 220);
    assert.equal(rewards.calculate({ id: "canyon" }).total, 380);
    assert.equal(rewards.calculate({ id: "unlisted" }), null);
});

test("все 12 сюжетных наград растут по мере усложнения", () => {
    assert.equal(rewards.STORY_REWARDS.length, 12);
    const values = Array.from({ length: 12 }, (_, index) =>
        rewards.calculate({ id: `story-${String(index + 1).padStart(2, "0")}` }).total);
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
    assert.ok(values[11] > values[0]);
    assert.equal(rewards.calculate({ id: "story-00" }), null);
    assert.equal(rewards.calculate({ id: "story-13" }), null);
});

test("выбор АИДЫ увеличивает награду при тяжёлых условиях", () => {
    const level = { id: "story-06" };
    const regular = rewards.calculate(level);
    const noisy = rewards.calculate(level, "noise");
    const dangerous = rewards.calculate(level, "lag");
    assert.equal(regular.bonus, 0);
    assert.ok(noisy.bonus > 0);
    assert.ok(dangerous.bonus > noisy.bonus);
    assert.equal(dangerous.total, dangerous.base + dangerous.bonus);
});

test("успешная награда начисляется один раз и сохраняется вместе с балансом", () => {
    const storage = mockStorage();
    const store = economy.createStore(storage);
    const first = store.claimLevelReward("hangar", 100);
    assert.equal(first.ok, true);
    assert.equal(first.claimed, true);
    assert.equal(store.getCredits(), 520);
    assert.equal(store.getLevelRewards().hangar.amount, 100);
    const afterReload = economy.createStore(storage);
    const second = afterReload.claimLevelReward("hangar", 100);
    assert.equal(second.claimed, false);
    assert.equal(second.amount, 0);
    assert.equal(afterReload.getCredits(), 520);
});

test("награда одной главы не мешает другим главам и тренировкам", () => {
    const store = economy.createStore(mockStorage());
    assert.equal(store.claimLevelReward("academy", 150).claimed, true);
    assert.equal(store.claimLevelReward("story-01", 150).claimed, true);
    assert.equal(store.claimLevelReward("story-02", 190).claimed, true);
    assert.equal(store.getCredits(), 420 + 150 + 150 + 190);
});

test("в разных локальных профилях выплаты не смешиваются", () => {
    const profiles = new Map();
    function profileStorage(id) {
        if (!profiles.has(id)) profiles.set(id, mockStorage());
        return profiles.get(id);
    }
    const alice = economy.createStore(profileStorage("alice"));
    const bob = economy.createStore(profileStorage("bob"));
    alice.claimLevelReward("canyon", 380);
    assert.equal(alice.getCredits(), 800);
    assert.equal(bob.getCredits(), 420);
    assert.equal(bob.claimLevelReward("canyon", 380).claimed, true);
});

test("при ошибке сохранения журнал наград и баланс откатываются", () => {
    const storage = mockStorage();
    const set = storage.setItem;
    storage.setItem = (key, value) => {
        if (key === economy.KEYS.levelRewards) throw new Error("QuotaExceededError");
        set(key, value);
    };
    const store = economy.createStore(storage);
    const result = store.claimLevelReward("training", 220);
    assert.equal(result.ok, false);
    assert.equal(store.getCredits(), 420);
    assert.deepEqual(store.getLevelRewards(), {});
});

test("случайная награда или некорректная сумма отклоняются", () => {
    const store = economy.createStore(mockStorage());
    assert.equal(store.claimLevelReward("admin", 999).ok, false);
    assert.equal(store.claimLevelReward("hangar", -20).ok, false);
    assert.equal(store.claimLevelReward("hangar", Infinity).ok, false);
    assert.equal(store.getCredits(), 420);
});

test("награда показывается в результатах, выборе миссий и кампании", () => {
    assert.match(source("Pages/Flight.cshtml"), /id="flight-level-reward"/);
    assert.match(source("Pages/Play.cshtml"), /id="mission-launch-reward"/);
    assert.match(source("Pages/Campaign.cshtml"), /id="campaign-selected-reward"/);
    assert.match(source("wwwroot/js/flight-game.js"), /claimLevelReward\(state\.level\.id/);
    assert.match(source("wwwroot/js/flight-game.js"), /state\.mode === "done"/);
    assert.match(source("wwwroot/js/campaign-ui.js"), /campaign-chapter-reward/);
});
