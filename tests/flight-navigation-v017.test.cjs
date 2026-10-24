"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");

test("страница выбора миссий отделена от симулятора", () => {
    const select = read("Pages/Play.cshtml");
    const game = read("Pages/Flight.cshtml");
    assert.match(select, /FlightSelectPage/);
    assert.doesNotMatch(select, /id="flight-canvas"/);
    assert.match(select, /id="mission-drone-select"/);
    for (const id of ["academy", "hangar", "training", "canyon"]) {
        assert.match(select, new RegExp(`data-choose-level="${id}"`));
    }
    assert.match(game, /ImmersiveFlight/);
    assert.match(game, /id="flight-canvas"/);
    assert.match(game, /id="flight-lesson-card"/);
    assert.doesNotMatch(game, /id="flight-level-list"|id="flight-drone-select"/);
});

test("полёт открывает именно выбранную карту и не позволяет обойти академию", () => {
    const selection = read("wwwroot/js/flight-select.js");
    const flight = read("wwwroot/js/flight-game.js");
    assert.match(selection, /encodeURIComponent\(selected\)/);
    assert.match(selection, /selected !== "academy" && !trained/);
    assert.match(selection, /store\.selectDrone\(select\.value\)/);
    assert.match(flight, /URLSearchParams\(window\.location\.search\)/);
    assert.match(flight, /window\.location\.replace\(requestedLevel\.story \? "\/Campaign\?reason=academy" : "\/Play\?reason=academy"\)/);
    assert.match(flight, /window\.location\.replace\("\/Play\?reason=no-drone"\)/);
    assert.match(flight, /getActiveDrone\(\)/);
});

test("на отдельной игровой странице есть пауза, подсказки, телеметрия и выход", () => {
    const html = read("Pages/Flight.cshtml");
    const code = read("wwwroot/js/flight-game.js");
    for (const id of ["flight-exit", "flight-pause-menu", "flight-pause-resume", "flight-pause-restart",
        "flight-help-toggle", "flight-mission-hud", "flight-battery", "flight-rpm"]) {
        assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id);
    }
    assert.match(code, /pauseMenu\.hidden = state\.mode !== "paused"/);
    assert.doesNotMatch(html, /class="flight-controls-bottom"|id="flight-motors"|id="flight-pause"/);
    assert.match(read("wwwroot/css/flight.css"), /\.flight-immersive \.flight-stage \{/);
    assert.match(read("Pages/Shared/_Layout.cshtml"), /immersiveFlight/);
});

test("прогресс академии и рекорды совместимы со старой версией", () => {
    const selection = read("wwwroot/js/flight-select.js");
    const flight = read("wwwroot/js/flight-game.js");
    for (const key of ["skycraft.tutorial.completed.v1", "skycraft.flight.records.v1"]) {
        assert.ok(selection.includes(key));
        assert.ok(flight.includes(key));
    }
    assert.match(flight, /SkycraftProfiles\.storage\.setItem\(trainingKey, "true"\)/);
    assert.match(selection, /Number\.isFinite\(records\.academy\)/);
});
