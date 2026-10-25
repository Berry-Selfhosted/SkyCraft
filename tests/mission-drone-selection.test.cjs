"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("все страницы выбора миссий используют общий экран выбора дрона", () => {
    const picker = read("wwwroot/js/mission-drone-picker.js");
    const campaign = read("wwwroot/js/campaign-ui.js");
    const training = read("wwwroot/js/flight-select.js");
    const layout = read("Pages/Shared/_Layout.cshtml");
    assert.match(campaign, /SkycraftMissionDronePicker\.launch/);
    assert.match(training, /SkycraftMissionDronePicker\.launch/);
    assert.match(layout, /mission-drone-picker\.js/);
    assert.match(layout, /mission-drone-picker\.css/);
    assert.match(picker, /getDrones\(\)/);
    assert.match(picker, /drone=\$\{encodeURIComponent\(selected\)\}/);
    assert.match(picker, /academy-loaner/);
});

test("полёт загружает выбранную комплектацию даже в сюжетных главах", () => {
    const source = read("wwwroot/js/flight-game.js");
    assert.match(source, /getDrones\(\)\.find\(d => d && d\.id === requestedDroneId\)/);
    assert.match(source, /scene\.setConfiguration\(drone\.parts\)/);
    assert.match(source, /scene\.setFlightSpecs\(stats\)/);
    assert.doesNotMatch(source, /if \(currentLevel\?\.tutorial \|\| currentLevel\?\.story\) return;/);
    assert.match(source, /if \(level\.tutorial && requestedDroneId === "academy-loaner"\)/);
});
