"use strict";

/*
 * Общая игровая модель характеристик SKYCRAFT.
 * Источник деталей — серверный каталог Models/DroneCatalog.cs, сериализованный
 * в _Layout.cshtml. Мастерская и полёты используют ОДНИ И ТЕ ЖЕ правила.
 *
 * Это аркадная модель баланса, не инженерная аэродинамика.
 * Модификаторы скорости и времени у моторов/винтов заданы ЗА КОМПЛЕКТ из 4,
 * а вес и стоимость считаются ЗА КАЖДУЮ физическую деталь.
 * RangeModifier из старого каталога — игровой бонус экономичности; его
 * переводим в множитель, а не добавляем метры поверх времени/скорости.
 */
(function (root) {
    const CATEGORIES = Object.freeze(["frame", "motor", "propeller", "battery", "electronics"]);
    const REQUIRED = Object.freeze({ frame: 1, motor: 4, propeller: 4, battery: 1, electronics: 1 });
    const DEFAULTS = Object.freeze({
        frame: "frame-light", motor: "motor-base", propeller: "prop-base",
        battery: "battery-base", electronics: "chip-base"
    });
    const BASE_MASS_KG = 12;
    const BASE_SPEED_KMH = 60;
    const BASE_TIME_MIN = 5;
    // Крейсерский режим: 40% макс. скорости; доступно 80% батареи;
    // половина запаса на путь обратно -> 0.4 * 0.8 / 2 = 0.16.
    const SAFE_RADIUS_FACTOR = 0.16;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    const roundOne = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

    function normalize(part) {
        return {
            id: part.id ?? part.Id,
            category: part.category ?? part.Category,
            weight: Number(part.weight ?? part.WeightKg),
            speed: Number(part.speed ?? part.SpeedModifier),
            time: Number(part.time ?? part.FlightTimeModifier),
            range: Number(part.range ?? part.RangeModifier),
            price: Number(part.price ?? part.Price)
        };
    }

    function loadCatalog(documentRef = root.document) {
        const element = documentRef?.getElementById("skycraft-parts-catalog");
        if (!element) return [];
        try {
            const items = JSON.parse(element.textContent);
            return Array.isArray(items) ? items.map(normalize) : [];
        } catch (error) {
            console.error("SKYCRAFT: ошибка игрового каталога", error);
            return [];
        }
    }

    function calculate(selection, catalog = loadCatalog()) {
        if (!selection || !Array.isArray(catalog)) throw new Error("Не задана конфигурация дрона");
        const byId = new Map(catalog.map(item => {
            const part = normalize(item);
            return [part.id, part];
        }));
        let mass = 0;
        let speedChange = 0;
        let timeChange = 0;
        let rangeRating = 0;
        let price = 0;
        for (const category of CATEGORIES) {
            const part = byId.get(selection[category]);
            if (!part || part.category !== category ||
                ![part.weight, part.speed, part.time, part.range, part.price].every(Number.isFinite) ||
                part.weight <= 0 || part.price < 0) {
                throw new Error(`Неизвестная или некорректная деталь: ${category}`);
            }
            const quantity = REQUIRED[category];
            mass += part.weight * quantity;
            price += part.price * quantity;
            speedChange += part.speed; // модификатор за готовый комплект
            timeChange += part.time;
            rangeRating += part.range;
        }
        const weight = roundOne(mass);
        const extraMass = mass - BASE_MASS_KG;
        // Масса влияет на динамику и длительность, даже если модификатор детали = 0.
        const speed = roundOne(clamp(BASE_SPEED_KMH + speedChange - extraMass * 1.5, 15, 130));
        const time = roundOne(clamp(BASE_TIME_MIN + timeChange - extraMass * 0.18, 1, 25));
        // RangeModifier хранится в баллах наследуемого каталога (4000 баллов = +100%).
        const efficiency = clamp(1 + rangeRating / 4000, 0.7, 1.4);
        const range = Math.max(100, Math.round((speed / 3.6) * (time * 60) * SAFE_RADIUS_FACTOR * efficiency));
        return { weight, speed, time, range, price };
    }

    root.SkycraftDroneStats = { CATEGORIES, REQUIRED, DEFAULTS, calculate, loadCatalog };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = root.SkycraftDroneStats;
    }
})(typeof window !== "undefined" ? window : globalThis);
