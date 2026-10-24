"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("все четыре вкладки доступны в мастерской", () => {
    const html = source("Pages/Shared/_Layout.cshtml");
    for (const page of ["Constructor", "Blueprints", "Warehouse", "Shop"]) {
        assert.match(html, new RegExp(`asp-page="/${page}"`));
    }
    assert.ok(html.indexOf('src="~/js/workshop-economy.js"') < html.indexOf('src="~/js/workshop.js"'));
});

test("каталог C# является единым источником цен магазина и склада", () => {
    const catalog = source("Models/DroneCatalog.cs");
    const shop = source("Pages/Shop.cshtml");
    const warehouse = source("Pages/Warehouse.cshtml");
    assert.match(shop, /DroneCatalog\.Parts/);
    assert.match(warehouse, /DroneCatalog\.Parts/);
    assert.match(shop, /data-part-price="@part.Price"/);
    assert.match(warehouse, /data-part-price="@part.Price"/);
    const ids = [...catalog.matchAll(/new\("([\w-]+)",/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, 15);
});

test("обе страницы имеют видимые кнопки торговли и ввод количества", () => {
    assert.match(source("Pages/Shop.cshtml"), /data-buy/);
    assert.match(source("Pages/Warehouse.cshtml"), /data-sell/);
    for (const page of ["Shop", "Warehouse"]) {
        assert.match(source(`Pages/${page}.cshtml`), /input type="number"/);
    }
});
