"use strict";
/*
 * Единая система ориентации полётной физики, FPV и GLB.
 * Физика: при heading = 0 нос летит вдоль -Z; положительный yaw
 * поворачивает курс в сторону +X (клавиша E).
 * GLB: лицевые камеры дрона находятся на стороне +Z локальной модели.
 * Следовательно, направление сетки нужно разворачивать через PI - heading,
 * а камера третьего лица обязана оставаться СЗАДИ дрона.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftFlightOrientation = api;
})(typeof window !== "undefined" ? window : null, function () {
    const TWO_PI = Math.PI * 2;
    const wrap = angle => ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;

    // Вектор движения корпуса при W в системе физики.
    function forward(heading) {
        return { x: Math.sin(heading), z: -Math.cos(heading) };
    }

    // Поворот визуальной GLB, у которой нос обращён к +Z.
    function modelYaw(heading) {
        return wrap(Math.PI - heading);
    }

    // Положение преследующей камеры относительно центра дрона.
    function chaseOffset(heading, orbitYaw, distance) {
        const angle = (orbitYaw || 0) - heading;
        return { x: Math.sin(angle) * distance, z: Math.cos(angle) * distance };
    }

    // Camera-relative third-person commands. This is the inverse yaw-only
    // transform from view-space movement to drone-local pitch/roll controls.
    // FPV deliberately bypasses this helper and keeps aircraft-relative keys.
    function cameraRelativeInput(input, orbitYaw) {
        const angle = orbitYaw || 0;
        const forwardAxis = Number(input.forward) || 0;
        const rightAxis = Number(input.right) || 0;
        return {
            ...input,
            forward: forwardAxis * Math.cos(angle) + rightAxis * Math.sin(angle),
            right: -forwardAxis * Math.sin(angle) + rightAxis * Math.cos(angle)
        };
    }

    return Object.freeze({ forward, modelYaw, chaseOffset, cameraRelativeInput });
});
