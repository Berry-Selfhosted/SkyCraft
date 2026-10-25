"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const soundNames = [
    "click", "hover", "select", "toggle-on", "toggle-off", "open", "close",
    "success", "error", "buy", "sell", "assemble", "start", "checkpoint", "complete"
];

test("все 15 эффектов — корректные короткие WAV, доступные как статические файлы", () => {
    for (const name of soundNames) {
        const wav = fs.readFileSync(path.join(ROOT, "wwwroot", "assets", "audio", `${name}.wav`));
        assert.equal(wav.toString("ascii", 0, 4), "RIFF", name);
        assert.equal(wav.toString("ascii", 8, 12), "WAVE", name);
        assert.equal(wav.readUInt16LE(22), 1, name);        
        assert.equal(wav.readUInt32LE(24), 24000, name);
        assert.equal(wav.readUInt16LE(34), 16, name);
        assert.ok(wav.length > 2000 && wav.length < 32000, name);
    }
});

test("звуковой движок загружается раньше site.js и логики мастерской", () => {
    const layout = source("Pages/Shared/_Layout.cshtml");
    assert.ok(layout.indexOf("~/js/ui-sounds.js") >= 0);
    assert.ok(layout.indexOf("~/js/ui-sounds.js") < layout.indexOf("~/js/site.js"));
    assert.ok(layout.indexOf("~/js/ui-sounds.js") < layout.indexOf("~/js/workshop.js"));
});

test("настройки управляют громкостью и выключением на всех страницах", () => {
    const layout = source("Pages/Shared/_Layout.cshtml");
    const site = source("wwwroot/js/site.js");
    const sound = source("wwwroot/js/ui-sounds.js");
    for (const id of ["setting-sound", "setting-sound-volume", "setting-volume-value", "test-sound"]) {
        assert.match(layout, new RegExp(`id="${id}"`));
    }
    assert.match(site, /soundEngine\?\.setEnabled\(enabled\)/);
    assert.match(site, /soundEngine\?\.setVolume\(/);
    assert.match(sound, /skycraft\.soundVolume\.v1/);
    assert.match(sound, /skycraft\.soundEnabled/);
});

test("сигналы экономики и полёта отличаются от кликов", () => {
    const manager = source("wwwroot/js/ui-sounds.js");
    const workshop = source("wwwroot/js/workshop.js");
    const flight = source("wwwroot/js/flight-game.js");
    for (const kind of ["buy", "sell", "assemble", "success", "error"]) {
        assert.match(manager, new RegExp(`"${kind}"`));
    }
    assert.match(workshop, /"success", "buy"/);
    assert.match(workshop, /"success", "sell"/);
    assert.match(workshop, /play\("assemble"\)/);
    assert.match(flight, /play\("checkpoint"\)/);
    assert.match(flight, /play\("complete"\)/);
    assert.match(manager, /\[data-buy\]/);
    assert.match(manager, /\[data-sell\]/);
});
