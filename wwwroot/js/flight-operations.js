"use strict";

/*
 * SKYCRAFT — посадка и наземные состояния.
 * Полётные единицы: метры, секунды, м/с; высота — координата центра дрона.
 * Высота 1.87 м соответствует касанию шасси плоскости земли (y=0)
 * при текущей геометрии GLB.
 * Это автопилот посадки в игровой модели, не сертифицированный контроллер.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftFlightOperations = api;
})(typeof window !== "undefined" ? window : null, function () {
    const GROUND_Y = 1.87;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    // Плавно снижаемся только после торможения горизонтальной скорости.
    // Торможение осуществляется обратным тангажом / креном (инерция сохраняется).
    function landingInput(position, velocity, yaw, ground = GROUND_Y) {
        const sinYaw = Math.sin(yaw);
        const cosYaw = Math.cos(yaw);
        const forwardSpeed = velocity.x * sinYaw - velocity.z * cosYaw;
        const rightSpeed = velocity.x * cosYaw + velocity.z * sinYaw;
        const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
        const altitude = Math.max(0, position.y - ground);

        // Не начинаем быстрое снижение, пока аппарат ещё скользит по горизонтали.
        const descentSpeed = horizontalSpeed > 1.1
            ? 0.10
            : clamp(altitude * 0.68, 0.09, 1.15);
        const wantedVertical = -descentSpeed;
        return {
            forward: clamp(-forwardSpeed * 0.26, -0.85, 0.85),
            right: clamp(-rightSpeed * 0.26, -0.85, 0.85),
            yaw: 0,
            lift: clamp((wantedVertical - velocity.y) * 0.95, -0.55, 0.55)
        };
    }

    function takeoffInput(velocity, yaw) {
        const neutral = landingInput({ y: GROUND_Y + 3 }, velocity, yaw);
        return { ...neutral, lift: clamp(0.75 - velocity.y * 0.12, 0.2, 1) };
    }

    function groundContact(state, ground = GROUND_Y) {
        if (state.position.y > ground) return null;
        const horizontal = Math.hypot(state.velocity.x, state.velocity.z);
        const vertical = state.velocity.y;
        const hard = vertical < -2.4 || horizontal > 2.6;
        state.position.y = ground;
        state.velocity.x = 0;
        state.velocity.y = 0;
        state.velocity.z = 0;
        state.attitude.pitch = 0;
        state.attitude.roll = 0;
        state.yawRate = 0;
        return { hard };
    }

    return { GROUND_Y, landingInput, takeoffInput, groundContact };
});
