"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("для Flight существуют отдельные CSS файлы ПК и мобильного режима", () => {
    const layout = read("Pages/Shared/_Layout.cshtml");
    for (const stylesheet of ["flight.css", "flight-desktop.css", "flight-mobile.css"]) {
        assert.match(layout, new RegExp(`~/css/${stylesheet.replace(".", "\\.")}`));
    }
    assert.ok(layout.indexOf("flight-desktop.css") < layout.indexOf("flight-mobile.css"));
    assert.match(layout, /js\/flight-device-layout\.js/);
});

test("детектор мобильной игры работает до загрузки CSS и при повороте", () => {
    const js = read("wwwroot/js/flight-device-layout.js");
    assert.match(js, /window\.innerWidth <= 1400 && window\.innerHeight <= 760/);
    assert.match(js, /navigator\.maxTouchPoints/);
    assert.match(js, /window\.addEventListener\("orientationchange", sync/);
    assert.match(js, /root\.classList\.toggle\("skycraft-mobile-flight", mobile\)/);
});

test("мобильный HUD скрывает карточки, показывает строку и джойстики", () => {
    const css = read("wwwroot/css/flight-mobile.css");
    assert.match(css, /skycraft-mobile-flight body\.is-immersive-flight \.flight-mission-hud/);
    assert.match(css, /skycraft-mobile-flight body\.is-immersive-flight \.flight-lesson-card/);
    assert.match(css, /flight-mobile-objective/);
    assert.match(css, /flight-touch-controls/);
    assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
});

test("ПК не показывает джойстики и однострочную мобильную подсказку", () => {
    const css = read("wwwroot/css/flight-desktop.css");
    assert.match(css, /skycraft-desktop-flight/);
    assert.match(css, /flight-touch-controls/);
    assert.match(css, /flight-mobile-objective/);
});
