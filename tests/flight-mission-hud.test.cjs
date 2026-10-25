"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

                                                                    
                                                                       
function makeHud() {
    const js = read("wwwroot/js/flight-game.js");
    const start = js.indexOf("function updateMission(state) {");
    const end = js.indexOf("\n    function updateUi(state)", start);
    assert.ok(start !== -1 && end > start, "функция обновления задания существует");

    const nodes = new Map();
    function get(id) {
        if (!nodes.has(id)) {
            nodes.set(id, {
                textContent: "",
                attributes: {},
                style: { width: "" },
                setAttribute(key, value) { this.attributes[key] = value; }
            });
        }
        return nodes.get(id);
    }
    const context = vm.createContext({ console });
                                                      
    context.$ = get;
    vm.runInContext(`let lastMissionState = null; ${js.slice(start, end)}\nglobalThis.updateMission = updateMission;`, context);
    return { get, update: (state) => context.updateMission(state) };
}

const level = (id = "hangar", count = 4) => ({
    id,
    checkpoints: Array.from({ length: count }, () => ({}))
});

test("блок задания находится внутри 3D-сцены, а не в панели подсказок", () => {
    const html = read("Pages/Flight.cshtml");
    const stage = html.indexOf('id="flight-stage"');
    const hud = html.indexOf('id="flight-mission-hud"');
    const drawer = html.indexOf('id="flight-help-drawer"');
    assert.ok(stage < hud && hud < drawer);
    assert.doesNotMatch(html.slice(drawer), /ТЕКУЩЕЕ ЗАДАНИЕ|id="flight-level-description"/);
    for (const id of ["flight-level-title", "flight-level-description", "flight-best", "flight-difficulty", "flight-mission-progressbar"]) {
        assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} не должен дублироваться`);
    }
});

test("полётное задание всегда показывает корректное количество ворот", () => {
    const { update, get } = makeHud();
    update({ level: level(), completed: 0, mode: "ready" });
    assert.equal(get("flight-mission-count").textContent, "0 / 4");
    assert.equal(get("flight-mission-progress-fill").style.width, "0%");
    assert.match(get("flight-mission-next").textContent, /ENTER.*M.*SPACE/);
    assert.equal(get("flight-mission-progressbar").attributes["aria-valuenow"], "0");

    update({ level: level(), completed: 2, mode: "running" });
    assert.equal(get("flight-mission-count").textContent, "2 / 4");
    assert.equal(get("flight-mission-progress-fill").style.width, "50%");
    assert.equal(get("flight-mission-next").textContent, "Цель: ворота 3 из 4");
});

test("после последних ворот задача меняется на посадку, затем на завершение", () => {
    const { update, get } = makeHud();
    update({ level: level(), completed: 4, mode: "running" });
    assert.equal(get("flight-mission-next").textContent, "Цель: выполни посадку (L)");
    assert.equal(get("flight-mission-progress-fill").style.width, "100%");
    update({ level: level(), completed: 4, mode: "done" });
    assert.equal(get("flight-mission-next").textContent, "Маршрут пройден!");
    update({ level: level(), completed: 3, mode: "depleted" });
    assert.equal(get("flight-mission-next").textContent, "Заряд исчерпан");
});

test("после смены уровня шкала корректно сбрасывается и учитывает другие ворота", () => {
    const { update, get } = makeHud();
    update({ level: level(), completed: 4, mode: "done" });
    update({ level: level("training", 5), completed: 0, mode: "ready" });
    assert.equal(get("flight-mission-count").textContent, "0 / 5");
    assert.equal(get("flight-mission-progressbar").attributes["aria-valuemax"], "5");
    assert.match(get("flight-mission-next").textContent, /ENTER.*M.*SPACE/);
});

test("миссия не перехватывает мышь, имеет мобильную раскладку и не ломает I", () => {
    const css = read("wwwroot/css/flight.css");
    assert.match(css, /\.flight-mission-hud\s*\{[^}]*pointer-events:\s*none/s);
    assert.match(css, /@media \(max-width: 720px\)\s*\{\s*\.flight-mission-hud/s);
    assert.match(read("wwwroot/js/flight-help.js"), /KeyI/);
});
