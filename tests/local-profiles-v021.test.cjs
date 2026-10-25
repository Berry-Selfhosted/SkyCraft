"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { createProfileManager } = require("../wwwroot/js/profile-session.js");
const read = pathPart => fs.readFileSync(path.join(root, pathPart), "utf8");

class FakeStorage {
    constructor() { this.store = new Map(); }
    get length() { return this.store.size; }
    key(index) { return [...this.store.keys()][index] ?? null; }
    getItem(key) { return this.store.get(String(key)) ?? null; }
    setItem(key,value) { this.store.set(String(key),String(value)); }
    removeItem(key) { this.store.delete(String(key)); }
    clear() { this.store.clear(); }
}

test("регистрация, вход, разделение денег, миссий, склада и настроек", () => {
    const local = new FakeStorage(), session = new FakeStorage();
    const manager = createProfileManager(local,session);
    assert.equal(manager.active(), null);
    manager.register("Korshun_01");
    assert.equal(manager.active().name,"Korshun_01");
    const keys = ["skycraft.credits.v1","skycraft.inventory.v1","skycraft.tutorial.completed.v1",
        "skycraft.korshun.campaign.v1","skycraft.soundEnabled","skycraft.flight.records.v1"];
    keys.forEach((key,index) => manager.storage.setItem(key,`A-${index}`));
    manager.logout();
    assert.equal(manager.active(), null);
    assert.throws(() => manager.storage.getItem(keys[0]),/Сначала войдите/);
    manager.register("Pilot_02");
    keys.forEach(key => assert.equal(manager.storage.getItem(key),null));
    keys.forEach((key,index) => manager.storage.setItem(key,`B-${index}`));
    manager.logout();
    manager.login("korshun_01");
    keys.forEach((key,index) => assert.equal(manager.storage.getItem(key),`A-${index}`));
    manager.logout();
    manager.login("PILOT_02");
    keys.forEach((key,index) => assert.equal(manager.storage.getItem(key),`B-${index}`));
});

test("старые общие сохранения переходят только в первый профиль", () => {
    const local = new FakeStorage(), session = new FakeStorage();
    const legacy = {
        "skycraft.credits.v1":"420",
        "skycraft.tutorial.completed.v1":"true",
        "skycraft.soundVolume.v1":"0.35",
        "skycraft.korshun.campaign.v1":'{"finished":{"1":true}}'
    };
    for (const [key,value] of Object.entries(legacy)) local.setItem(key,value);
    const manager = createProfileManager(local,session);
    const result=manager.register("OldPilot");
    assert.equal(result.migrated,Object.keys(legacy).length);
    for (const [key,value] of Object.entries(legacy)) {
        assert.equal(manager.storage.getItem(key),value);
        assert.equal(local.getItem(key),null);
    }
    manager.logout();
    manager.register("NewPilot");
    for (const key of Object.keys(legacy)) assert.equal(manager.storage.getItem(key),null);
});

test("корректная обработка логинов, внутренних URL и ошибок профиля",()=>{
    const manager=createProfileManager(new FakeStorage(),new FakeStorage());
    assert.throws(()=>manager.register("a"),/2–24/);
    assert.throws(()=>manager.register("<script>"),/Логин/);
    manager.register("Пилот-07");
    assert.throws(()=>manager.register("пилот-07"),/уже существует/);
    assert.throws(()=>manager.login("NoAccount"),/не найден/);
    assert.equal(manager.redirectTarget("//evil.site/"),"/");
    assert.equal(manager.redirectTarget("/\\evil"),"/");
    assert.equal(manager.redirectTarget("https://evil.site"),"/");
    assert.equal(manager.redirectTarget("/Login"),"/");
    assert.equal(manager.redirectTarget("/Flight?level=story-02"),"/Flight?level=story-02");
});

test("защита страницы, личные данные и автоматический запуск миссий подключены",()=>{
    const layout=read("Pages/Shared/_Layout.cshtml");
    assert.match(layout,/profile-session\.js/);
    assert.match(layout,/SkycraftProfiles\?\.requireLogin\(\)/);
    assert.match(layout,/profile-logout/);
    assert.match(read("Pages/Login.cshtml"),/profile-register/);
    assert.match(read("wwwroot/js/flight-select.js"),/SkycraftMissionDronePicker\.launch/);
    assert.match(read("wwwroot/js/campaign-ui.js"),/SkycraftMissionDronePicker\.launch/);
    assert.match(read("wwwroot/js/mission-drone-picker.js"),/autostart=1/);
    assert.match(read("wwwroot/js/flight-game.js"),/flight-enter-prompt/);
    assert.match(read("Pages/Flight.cshtml"),/НАЖМИ/);
    for (const script of ["site.js","ui-sounds.js","flight-game.js","flight-select.js","home-scene.js","workshop.js","campaign-ui.js","flight-scene.js"]) {
        assert.match(read(`wwwroot/js/${script}`),/SkycraftProfiles\.storage/);
    }
});


test("пробелы внутри логина: регистрация, отображение и повторный вход", () => {
    const local = new FakeStorage(), session = new FakeStorage();
    const manager = createProfileManager(local, session);
    manager.register("Дима Пилот");
    assert.equal(manager.active().name, "Дима Пилот");
    manager.storage.setItem("skycraft.credits.v1", "500");
    manager.logout();
    assert.equal(manager.list()[0].name, "Дима Пилот");
    manager.login("дима пилот");
    assert.equal(manager.storage.getItem("skycraft.credits.v1"), "500");
    assert.throws(() => manager.register("ДИМА ПИЛОТ"), /уже существует/);
    manager.register("  Другой Пилот  ");
    assert.equal(manager.active().name, "Другой Пилот");
    assert.throws(() => manager.register("   "), /Логин/);
    assert.throws(() => manager.register("Логин!"), /Логин/);
    assert.throws(() => manager.register("Имя\nФамилия"), /Логин/);
    assert.throws(() => manager.register("A".repeat(25)), /Логин/);
});
