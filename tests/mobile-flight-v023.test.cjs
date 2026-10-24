"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("мобильная строка задания заменяет большие окна, сохраняя прогресс обучения", () => {
    const page = read("Pages/Flight.cshtml");
    const js = read("wwwroot/js/flight-game.js");
    for (const id of ["flight-mobile-objective", "flight-mobile-objective-step",
        "flight-mobile-objective-title", "flight-mobile-objective-command",
        "flight-mobile-objective-details", "flight-mobile-objective-fill"]) {
        assert.match(page, new RegExp(`id="${id}"`));
    }
    assert.match(js, /function updateMobileObjective\(state\)/);
    assert.match(js, /state\.tutorial/);
    assert.match(js, /mobileObjectiveDetails\.hidden = true/);
    assert.match(js, /updateMobileObjective\(state\)/);
});

test("телефон в горизонтальной ориентации видит джойстики и компактный HUD", () => {
    const css = read("wwwroot/css/flight.css");
    assert.match(css, /\(hover: none\) and \(pointer: coarse\)/);
    assert.match(css, /\.flight-immersive \.flight-mission-hud,\s*\.flight-immersive \.flight-lesson-card\s*\{\s*display:\s*none/);
    assert.match(css, /\.flight-mobile-objective \{\s*--objective-teal/);
    assert.match(css, /grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
});

test("выделение и контекстное меню запрещаются лишь во время активного полёта", () => {
    const js = read("wwwroot/js/flight-game.js");
    const css = read("wwwroot/css/flight.css");
    assert.match(js, /document\.body\.classList\.toggle\("flight-gameplay-active", state\.mode === "running"\)/);
    assert.match(js, /\["selectstart", "dragstart", "contextmenu"\]/);
    assert.match(js, /event\.target\?\.closest\?\.\("#flight-stage"\)/);
    assert.match(css, /\.flight-gameplay-active \.flight-immersive \*/);
    assert.doesNotMatch(css, /body\s*\{\s*user-select:\s*none/);
});
