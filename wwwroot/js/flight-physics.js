"use strict";

/*
 * Стабилизированная модель квадрокоптера SKYCRAFT.
 * Единицы: метры, секунды, радианы, м/с. Не CFD и не acro-контроллер.
 *
 * W/S: желаемый тангаж (ускорение вдоль носа), A/D: крен,
 * Q/E: угловая скорость рыскания, Space/Shift: изменение тяги.
 * Вектор тяги наклоняется вместе с корпусом; сопротивление воздуха
 * замедляет аппарат, но не останавливает его мгновенно.
 * Встроенные подшаги ограничивают зависимость от FPS.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftFlightPhysics = api;
})(typeof window !== "undefined" ? window : null, function () {
    const GRAVITY = 9.81;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function createState(start = { x: 0, y: 2.2, z: 11 }) {
        return {
            position: { x: start.x, y: start.y, z: start.z },
            velocity: { x: 0, y: 0, z: 0 },
            attitude: { yaw: 0, pitch: 0, roll: 0 },
            yawRate: 0
        };
    }

    function sanitizeSpecs(specs = {}) {
        const positive = (value, otherwise) => Number.isFinite(Number(value)) && Number(value) > 0
            ? Number(value) : otherwise;
        return {
            weight: clamp(positive(specs.weight, 12), 1, 40),
            speed: clamp(positive(specs.speed, 60), 15, 130),
            time: clamp(positive(specs.time, 5), 1, 25),
            range: clamp(positive(specs.range, 800), 100, 10000)
        };
    }

    function controlsFromKeys(keys) {
        const axis = (plus, minus) => Number(keys.has(plus)) - Number(keys.has(minus));
        return {
            forward: axis("KeyW", "KeyS"),
            right: axis("KeyD", "KeyA"),
            yaw: axis("KeyE", "KeyQ"),
            lift: Number(keys.has("Space")) - Number(keys.has("ShiftLeft") || keys.has("ShiftRight"))
        };
    }

    function step(state, input, deltaSeconds, config) {
        const specs = sanitizeSpecs(config);
        const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.25);
        if (dt <= 0) return state;
        const n = Math.ceil(dt / (1 / 120));
        const h = dt / n;
        const maxSpeed = specs.speed / 3.6;
        // Более тяжёлая сборка реагирует медленнее; быстрые моторы повышают тягу.
        const massFactor = clamp(12 / specs.weight, 0.55, 1.6);
        const motorFactor = clamp(Math.sqrt(specs.speed / 60), 0.75, 1.5);
        const agility = massFactor * motorFactor;
        const tiltLimit = 0.43; // ~25°: режим самовыравнивания, не акробатика.
        const rotResponse = 2.8 * Math.sqrt(agility);
        const maxYawRate = 1.65 * Math.sqrt(agility);
        const drag = GRAVITY * Math.tan(tiltLimit) * agility / (maxSpeed * maxSpeed);

        for (let i = 0; i < n; i++) {
            const attitude = state.attitude;
            // Плавное изменение угла вместо мгновенного перемещения.
            const alpha = 1 - Math.exp(-rotResponse * h);
            attitude.pitch += (clamp(input.forward || 0, -1, 1) * tiltLimit - attitude.pitch) * alpha;
            attitude.roll += (clamp(input.right || 0, -1, 1) * tiltLimit - attitude.roll) * alpha;
            state.yawRate += (clamp(input.yaw || 0, -1, 1) * maxYawRate - state.yawRate)
                * (1 - Math.exp(-3.5 * h));
            attitude.yaw += state.yawRate * h;
            // Вектор тяги в локальных координатах, повёрнутый вокруг yaw.
            // W даёт ускорение вдоль -Z, D — вдоль +X.
            const forwardAcceleration = GRAVITY * Math.tan(attitude.pitch) * agility;
            const rightAcceleration = GRAVITY * Math.tan(attitude.roll) * agility;
            const cosYaw = Math.cos(attitude.yaw);
            const sinYaw = Math.sin(attitude.yaw);
            const ax = rightAcceleration * cosYaw + forwardAcceleration * sinYaw;
            // При положительном yaw направление правого борта — (+cosYaw, +sinYaw).
            // Старый минус инвертировал A/D относительно карты после разворота.
            const az = rightAcceleration * sinYaw - forwardAcceleration * cosYaw;
            const vx = state.velocity.x;
            const vz = state.velocity.z;
            const horizontalSpeed = Math.hypot(vx, vz);
            // Квадратичное аэродинамическое сопротивление + небольшое затухание.
            const airResistance = drag * horizontalSpeed;
            state.velocity.x += (ax - vx * (airResistance + 0.045)) * h;
            state.velocity.z += (az - vz * (airResistance + 0.045)) * h;

            // Стабилизация высоты автоматически компенсирует наклон тяги.
            // Space/Shift добавляют/убирают газ, движение по вертикали инерционно.
            const lift = clamp(input.lift || 0, -1, 1);
            const verticalAcceleration = lift * 5.2 * agility - state.velocity.y * 1.35;
            state.velocity.y += verticalAcceleration * h;
            const verticalLimit = Math.min(6.0, maxSpeed * 0.60);
            state.velocity.y = clamp(state.velocity.y, -verticalLimit, verticalLimit);

            const speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
            if (speed > maxSpeed) {
                const scale = maxSpeed / speed;
                state.velocity.x *= scale;
                state.velocity.y *= scale;
                state.velocity.z *= scale;
            }
            state.position.x += state.velocity.x * h;
            state.position.y += state.velocity.y * h;
            state.position.z += state.velocity.z * h;
        }
        return state;
    }

    return { createState, sanitizeSpecs, controlsFromKeys, step };
});
