"use strict";
/*
 * Награды за первый успешный вылет.
 * Расчёт одинаков для экрана уровней, кампании и результата полёта.
 * За повторную победу деньги не выдаются: этим управляет экономика.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftFlightRewards = api;
})(typeof window !== "undefined" ? window : null, function () {
    const TRACK_REWARDS = Object.freeze({
        academy: 150,
        hangar: 100,
        training: 220,
        canyon: 380
    });
    // Двенадцать сюжетных глав становятся сложнее к финалу.
    const STORY_REWARDS = Object.freeze([
        150, 190, 230, 270, 320, 370, 430, 490, 560, 630, 730, 900
    ]);
    const DANGEROUS_MODIFIERS = new Set([
        "wind", "battery", "lag", "sensitive", "vibration", "blackout",
        "dirty", "nohover", "glide", "range", "compass", "gps"
    ]);

    function calculate(level, modifier = null) {
        if (!level || typeof level.id !== "string") return null;
        const match = /^story-(0[1-9]|1[0-2])$/.exec(level.id);
        if (match) {
            const chapter = Number(match[1]);
            const base = STORY_REWARDS[chapter - 1];
            // Последствия выбора АИДЫ увеличивают премию за риск на 10–20%.
            const rate = typeof modifier === "string" && modifier.length
                ? DANGEROUS_MODIFIERS.has(modifier) ? 0.20 : 0.10
                : 0;
            const bonus = Math.round(base * rate / 10) * 10;
            return Object.freeze({ levelId: level.id, base, bonus, total: base + bonus });
        }
        if (!Object.hasOwn(TRACK_REWARDS, level.id)) return null;
        const base = TRACK_REWARDS[level.id];
        return Object.freeze({ levelId: level.id, base, bonus: 0, total: base });
    }

    return Object.freeze({ TRACK_REWARDS, STORY_REWARDS, calculate });
});
