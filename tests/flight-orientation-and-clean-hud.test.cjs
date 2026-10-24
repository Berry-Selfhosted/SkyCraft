"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => readFileSync(path.join(root, file), "utf8");
const math = require("../wwwroot/js/flight-orientation.js");
const physics = require("../wwwroot/js/flight-physics.js");

// GLB модели SKYCRAFT смотрят камерой вперёд вдоль +Z, а в физике нулевой
// курс означает -Z. Проверяем именно реальное направление сетки, не метку yaw.
const transformedModelForward = angle => ({ x: Math.sin(angle), z: Math.cos(angle) });
const dot = (a, b) => a.x * b.x + a.z * b.z;
const close = (a, b) => Math.abs(a - b) < 1e-8;

test("после Q/E нос модели совпадает с физическим курсом на всех кардинальных направлениях", () => {
    for (const heading of [0, Math.PI/4, Math.PI/2, -Math.PI/2, Math.PI, 3*Math.PI/2]) {
        const body = math.forward(heading);
        const visual = transformedModelForward(math.modelYaw(heading));
        assert.ok(close(body.x, visual.x), `front X heading=${heading}`);
        assert.ok(close(body.z, visual.z), `front Z heading=${heading}`);
    }
});

test("преследующая камера находится СЗАДИ после разворота, не зеркалит WASD", () => {
    for (const heading of [0, Math.PI/4, Math.PI/2, Math.PI, -Math.PI/2]) {
        const forward = math.forward(heading);
        const behind = math.chaseOffset(heading, 0, 12);
        assert.ok(dot(forward, behind) < -11.99, `camera not behind at yaw ${heading}`);
    }
});

test("W в физике направлен туда, куда смотрит нос, даже после Q/E", () => {
    for (const heading of [0, Math.PI/2, -Math.PI/2]) {
        const state = physics.createState();
        state.attitude.yaw = heading;
        physics.step(state, {forward:1}, .8, {weight:12, speed:60});
        assert.ok(dot(state.velocity, math.forward(heading)) > .2);
    }
});

test("D всегда ускоряет по правому борту после Q/E, A — по левому", () => {
    for (const heading of [0, Math.PI/4, Math.PI/2, Math.PI, -Math.PI/2]) {
        const right = { x: Math.cos(heading), z: Math.sin(heading) };
        for (const side of [1, -1]) {
            const state = physics.createState();
            state.attitude.yaw = heading;
            for (let i=0; i<60; i++) physics.step(state, {right:side}, 1/60, {weight:12,speed:60});
            assert.ok(dot(state.velocity, right)*side > .5, `reversed strafe heading=${heading}, side=${side}`);
        }
    }
});

test("нижняя панель полностью удалена вместе с кнопками, доступны Enter/M/Esc", () => {
    const page = read("Pages/Flight.cshtml");
    const js = read("wwwroot/js/flight-game.js");
    const css = read("wwwroot/css/flight.css");
    const scene = read("wwwroot/js/flight-scene.js");
    assert.doesNotMatch(page, /flight-controls-bottom|id="flight-start"|id="flight-motors"|id="flight-pause"/);
    assert.doesNotMatch(css, /flight-controls-bottom/);
    assert.doesNotMatch(js, /\$\("flight-(start|motors|takeoff|land|pause|reset|state-text)"\)/);
    assert.match(js, /event\.code === "Enter"/);
    assert.match(scene, /KeyM/);
    assert.match(scene, /Escape/);
    assert.match(page, /id="flight-hud-bottom"|class="flight-hud-bottom"/);
});

test("ориентация подключена до сцены и используется рендером", () => {
    const layout = read("Pages/Shared/_Layout.cshtml");
    const scene = read("wwwroot/js/flight-scene.js");
    assert.ok(layout.indexOf("~/js/flight-orientation.js") < layout.indexOf("~/js/flight-scene.js"));
    assert.match(read("wwwroot/js/three-scene.js"), /SkycraftFlightOrientation\?\.modelYaw/);
    assert.match(scene, /SkycraftFlightOrientation\.chaseOffset/);
});
