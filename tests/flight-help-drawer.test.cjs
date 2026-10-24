"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

class TestElement {
    constructor() {
        this.attributes = new Map();
        this.handlers = new Map();
        this.classes = new Set();
        this.inert = false;
        this.hidden = true;
        this.title = "";
        this.tagName = "BUTTON";
        this.classList = {
            toggle: (name, enabled) => {
                if (enabled) this.classes.add(name);
                else this.classes.delete(name);
            },
            contains: (name) => this.classes.has(name)
        };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    click() { this.handlers.get("click")?.({ target: this }); }
    focus() { this.focused = true; }
}

function launch() {
    const panel = new TestElement();
    const toggle = new TestElement();
    const close = new TestElement();
    const canvas = new TestElement();
    const settings = new TestElement();
    const nodes = {
        "flight-help-drawer": panel,
        "flight-help-toggle": toggle,
        "flight-help-close": close,
        "flight-canvas": canvas,
        "settings-overlay": settings
    };
    const handlers = new Map();
    const sounds = [];
    const context = {
        document: { getElementById: (id) => nodes[id] ?? null },
        window: {
            addEventListener: (name, handler) => handlers.set(name, handler),
            SkycraftSounds: { play: (name) => sounds.push(name) }
        }
    };
    vm.runInNewContext(read("wwwroot/js/flight-help.js"), context);
    const key = (code, target = canvas, opts = {}) => {
        let prevented = false;
        handlers.get("keydown")?.({ code, repeat: false, target, preventDefault() { prevented = true; }, ...opts });
        return prevented;
    };
    return { panel, toggle, close, canvas, settings, key, sounds };
}

test("постоянный брифинг удалён, подсказки вставлены один раз внутрь сцены", () => {
    const page = read("Pages/Flight.cshtml");
    assert.doesNotMatch(page, /class="flight-details"/);
    for (const id of ["flight-help-drawer", "flight-help-toggle", "flight-help-close", "flight-level-title", "flight-best"]) {
        assert.equal(page.split(`id="${id}"`).length - 1, 1, `${id} должен встречаться один раз`);
    }
    assert.ok(page.indexOf('id="flight-help-drawer"') > page.indexOf('id="flight-stage"'));
    assert.match(read("Pages/Shared/_Layout.cshtml"), /flight-help\.js/);
    assert.match(read("wwwroot/css/flight.css"), /\.flight-help-drawer\.is-open/);
});

test("подсказки закрыты по умолчанию и открываются/закрываются клавишей I", () => {
    const { panel, toggle, key, sounds } = launch();
    assert.equal(panel.inert, true);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(key("KeyI"), true);
    assert.equal(panel.classList.contains("is-open"), true);
    assert.equal(panel.getAttribute("aria-hidden"), "false");
    assert.equal(panel.inert, false);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(key("KeyI"), true);
    assert.equal(panel.classList.contains("is-open"), false);
    assert.equal(panel.getAttribute("aria-hidden"), "true");
    assert.deepEqual(sounds, ["open", "close"]);
});

test("работают кнопки и возвращается фокус на Canvas после закрытия", () => {
    const { panel, toggle, close, canvas } = launch();
    toggle.click();
    assert.equal(panel.inert, false);
    close.click();
    assert.equal(panel.inert, true);
    assert.equal(canvas.focused, true);
});

test("I не мешает вводу текста, системным комбинациям и окну настроек", () => {
    const { panel, key, settings } = launch();
    assert.equal(key("KeyI", { tagName: "INPUT" }), false);
    assert.equal(key("KeyI", { tagName: "TEXTAREA" }), false);
    assert.equal(key("KeyI", { isContentEditable: true }), false);
    assert.equal(key("KeyI", {}, { ctrlKey: true }), false);
    assert.equal(key("KeyI", {}, { repeat: true }), false);
    settings.hidden = false;
    assert.equal(key("KeyI"), false);
    assert.equal(panel.inert, true);
});

test("управление дроном не получает команды, когда фокус на кнопке", () => {
    assert.match(read("wwwroot/js/flight-scene.js"), /"BUTTON", "A"/);
});
