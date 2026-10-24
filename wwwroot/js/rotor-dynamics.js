"use strict";

/*
 * SKYCRAFT — игровая модель четырёх электродвигателей квадрокоптера.
 *
 * В отличие от анимации «прибавлять угол на каждом кадре», здесь RPM
 * следует за необходимой тягой: T ~ RPM². Тяга задаётся весом аппарата,
 * наклоном корпуса, запросом на подъём и командами автопилота.
 * Дифференциальная тяга по четырём углам задаёт моменты крена/тангажа/yaw.
 * Значения ориентировочные: реальную тягу определяют замеры пары
 * мотор + винт + ESC + аккумулятор, которых в каталоге пока нет.
 * Все расчёты используют секунды, радианы, кг, ньютоны, об/мин.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftRotorDynamics = api;
})(typeof window !== "undefined" ? window : null, function () {
    const TWO_PI = Math.PI * 2;
    const GRAVITY = 9.81;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

    // Тот же порядок, что и в DroneScene.buildDrone (x, затем z).
    // Противоположные пары вращаются в разные стороны.
    const ROTORS = Object.freeze([
        Object.freeze({ x: -1, z: -1, direction: 1 }),
        Object.freeze({ x: -1, z: 1, direction: -1 }),
        Object.freeze({ x: 1, z: -1, direction: -1 }),
        Object.freeze({ x: 1, z: 1, direction: 1 })
    ]);

    const MOTORS = Object.freeze({
        "motor-base": { maxRpm: 5400, maxThrust: 56, riseTime: 0.20, fallTime: 0.30 },
        "motor-race": { maxRpm: 7300, maxThrust: 67, riseTime: 0.13, fallTime: 0.21 },
        "motor-eco": { maxRpm: 4850, maxThrust: 53, riseTime: 0.26, fallTime: 0.34 }
    });
    const PROPELLERS = Object.freeze({
        "prop-base": { thrustFactor: 1, rpmLimit: 1, radius: 0.80 },
        "prop-sport": { thrustFactor: 0.91, rpmLimit: 1.0, radius: 0.87 },
        "prop-quiet": { thrustFactor: 1.10, rpmLimit: 0.90, radius: 0.73 }
    });
    const BATTERIES = Object.freeze({
        "battery-base": 1,
        "battery-long": 1.03,
        "battery-light": 0.98
    });

    function getProfile(configuration = {}) {
        const motor = MOTORS[configuration.motor] || MOTORS["motor-base"];
        const propeller = PROPELLERS[configuration.propeller] || PROPELLERS["prop-base"];
        const voltageFactor = BATTERIES[configuration.battery] || 1;
        return {
            maxRpm: Math.round(motor.maxRpm * propeller.rpmLimit * voltageFactor),
            maxThrust: motor.maxThrust * propeller.thrustFactor,
            riseTime: motor.riseTime,
            fallTime: motor.fallTime,
            radius: propeller.radius
        };
    }

    function createState() {
        return {
            rotors: ROTORS.map(({ direction }) => ({ rpm: 0, angle: 0, direction })),
            collective: 0
        };
    }

    function calculateTargets({ input = {}, attitude = {}, velocity = {}, specs = {}, configuration = {}, battery = 100 } = {}) {
        const profile = getProfile(configuration);
        const mass = clamp(Number(specs.weight) || 12, 1, 40);
        const pitch = clamp(Number(attitude.pitch) || 0, -0.65, 0.65);
        const roll = clamp(Number(attitude.roll) || 0, -0.65, 0.65);
        const forward = clamp(Number(input.forward) || 0, -1, 1);
        const right = clamp(Number(input.right) || 0, -1, 1);
        const yaw = clamp(Number(input.yaw) || 0, -1, 1);
        const lift = clamp(Number(input.lift) || 0, -1, 1);
        const verticalSpeed = clamp(Number(velocity.y) || 0, -6, 6);
        const agility = clamp(12 / mass * Math.sqrt((Number(specs.speed) || 60) / 60), 0.5, 1.65);

        // Контроллер высоты из flight-physics.js: aY = газ*5.2*agility - vy*1.35.
        // Чтобы удержать высоту при наклоне, вертикальная компонента тяги
        // должна преодолеть mg: суммарная T = m*(g+aY)/(cosPitch*cosRoll).
        const verticalAcceleration = lift * 5.2 * agility - verticalSpeed * 1.35;
        const correctedThrust = mass * Math.max(1.2, GRAVITY + verticalAcceleration) /
            Math.max(0.5, Math.cos(pitch) * Math.cos(roll));
        const perMotorThrust = correctedThrust / 4;
        // При почти разряженном аккумуляторе падает доступная мощность.
        const remaining = clamp(Number(battery) || 0, 0, 100);
        const sag = 1 - 0.10 * (1 - clamp(remaining / 20, 0, 1));
        const maxRpm = profile.maxRpm * sag;
        const hoverRatio = perMotorThrust / profile.maxThrust;

        // Ошибка ориентации создаёт небольшой разный момент на парах роторов.
        // При достижении заданного наклона обороты снова почти выравниваются.
        const pitchCorrection = clamp((forward * 0.43 - pitch) * 0.30, -0.15, 0.15);
        const rollCorrection = clamp((right * 0.43 - roll) * 0.30, -0.15, 0.15);
        const yawCorrection = yaw * 0.085;
        const targets = ROTORS.map((rotor) => {
            const ratio = clamp(hoverRatio * (
                1 + rotor.z * pitchCorrection - rotor.x * rollCorrection -
                rotor.direction * yawCorrection
            ), 0, 1);
            // Статическая тяга винта приблизительно пропорциональна RPM².
            return clamp(Math.sqrt(ratio) * maxRpm, 0, maxRpm);
        });
        return { targets, collective: clamp(hoverRatio, 0, 1), profile };
    }

    function step(state, options = {}, deltaSeconds = 0) {
        if (!state || !Array.isArray(state.rotors) || state.rotors.length !== 4) {
            throw new Error("Неверное состояние четырёх моторов");
        }
        const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.2);
        if (dt === 0 || options.mode === "paused") return state;
        const running = options.mode === "running";
        const powered = running && options.motorState !== "off";
        const idle = running && options.motorState === "idle";
        const calculated = powered && !idle ? calculateTargets(options) : null;
        const profile = getProfile(options.configuration);
        state.collective = calculated ? calculated.collective : 0;
        for (let index = 0; index < 4; index++) {
            const rotor = state.rotors[index];
            const target = idle ? profile.maxRpm * 0.16 : calculated ? calculated.targets[index] : 0;
            // Инерция мотора/винта, управляемых ESC: рост и спад не мгновенны.
            const timeConstant = target >= rotor.rpm ? profile.riseTime : profile.fallTime;
            const before = rotor.rpm;
            const alpha = 1 - Math.exp(-dt / timeConstant);
            rotor.rpm = clamp(before + (target - before) * alpha, 0, profile.maxRpm);
            // Интегрируем экспоненту RPM аналитически. Иначе фаза винта
            // заметно зависела бы от FPS даже при одинаковых оборотах.
            const revolutions = (target * dt + (before - target) * timeConstant * alpha) / 60;
            rotor.angle = ((rotor.angle + rotor.direction * revolutions * TWO_PI) % TWO_PI + TWO_PI) % TWO_PI;
            if (rotor.rpm < 0.5 && !powered) rotor.rpm = 0;
        }
        return state;
    }

    function averageRpm(state) {
        if (!state?.rotors) return 0;
        return Math.round(state.rotors.reduce((sum, item) => sum + item.rpm, 0) / 4);
    }

    return { ROTORS, MOTORS, PROPELLERS, getProfile, createState, calculateTargets, step, averageRpm };
});
