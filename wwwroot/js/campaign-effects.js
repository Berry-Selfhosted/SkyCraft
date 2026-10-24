"use strict";
/*
 * Игровые последствия решений АИДЫ.
 * Модификатор применяется к СЛЕДУЮЩЕМУ вылету после дебрифинга.
 * Единицы: метры, секунды, м/с. Без скрытых случайных отказов, которые
 * невозможно предвидеть: все эффекты детерминированы временем и показываются в HUD.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftCampaignEffects = api;
})(typeof window === "undefined" ? null : window, function () {
    const effects = {
        wind: { name: "ПОРЫВЫ ВЕТРА", details: "Боковой ветер и снос курса" },
        gps: { name: "НЕТ GPS", details: "Отклонение направления и помехи навигации" },
        spray: { name: "МОКРАЯ ОПТИКА", details: "Пятна на камере. Нажми C для очистки" },
        noise: { name: "АКУСТИЧЕСКИЙ ШУМ", details: "Нажми F, чтобы настроить фильтр частот" },
        battery: { name: "РАСХОД ЭНЕРГИИ", details: "Аккумулятор разряжается быстрее" },
        compass: { name: "СБОЙ КОМПАСА", details: "Плавающее отклонение курса" },
        decoys: { name: "ЛОЖНЫЕ ТЕПЛОВЫЕ ЦЕЛИ", details: "Подтверждай реальные цели клавишей F у ворот" },
        lidar: { name: "ШУМ ЛИДАРА", details: "Нажми F для калибровки сканера" },
        markers: { name: "ПОИСК МАЯКОВ", details: "Нажми F, чтобы подтвердить световые отметки" },
        birds: { name: "НОЧНЫЕ ПТИЦЫ", details: "Непредсказуемые краткие воздушные толчки" },
        autopilot: { name: "АВТОСТАБИЛИЗАЦИЯ", details: "АИДА гасит крен, но требует подтверждения отметок (F)" },
        lag: { name: "ЗАДЕРЖКА РАДИОКАНАЛА", details: "Управление реагирует примерно через 0.35 секунды" },
        sensitive: { name: "ВЫСОКАЯ ЧУВСТВИТЕЛЬНОСТЬ", details: "Более резкая реакция на команды" },
        vibration: { name: "ВИБРАЦИЯ КАМЕРЫ", details: "Небольшое дрожание видеопотока" },
        range: { name: "СЛАБЫЙ РАДИОКАНАЛ", details: "Ограниченный рабочий радиус" },
        blackout: { name: "ОБРЫВЫ ВИДЕО", details: "Короткие выпадения картинки каждые несколько секунд" },
        dirty: { name: "ГРЯЗНЫЙ ОБЪЕКТИВ", details: "Замутнение камеры; C включает очистку" },
        shake: { name: "БЕЗ СТАБИЛИЗАТОРА", details: "Камера заметно дрожит" },
        nohover: { name: "ХОЛОДНЫЙ АККУМУЛЯТОР", details: "Во время зависания заряд уходит быстрее" },
        glide: { name: "ОГРАНИЧЕННАЯ ТЯГА", details: "Вертикальный подъём ослаблен — планируй заранее" },
        panic: { name: "ТРЕВОГА В УКРЫТИИ", details: "Подтверди спокойный канал сигналом F" }
    };
    function description(id) { return effects[id]?.details || "Обычный режим разведки"; }
    function display(id) { return effects[id]?.name || "НОРМАЛЬНЫЕ УСЛОВИЯ"; }
    function create(id) { return { id: effects[id] ? id : null, clock: 0, tuned: false, confirmedIndex: -1, cleanedAt: -20, lagBuffer: [] }; }
    const number = n => Number.isFinite(n) ? n : 0;
    function before(state, input, delta) {
        if (!state || !state.id) return input;
        const dt=Math.max(0,Math.min(.25,delta));
        state.clock += dt;
        let result = { ...input };
        if (state.id === "lag") {
            state.lagBuffer.push({ at: state.clock, input: { ...result } });
            if (state.lagBuffer.length > 80) state.lagBuffer.shift();
            const eligible=state.lagBuffer.filter(item => item.at <= state.clock - .35);
            result = eligible.length ? eligible[eligible.length-1].input : {forward:0,right:0,lift:0,yaw:0};
            state.lagBuffer=state.lagBuffer.filter(item => item.at>state.clock-.5);
        }
        if (state.id === "sensitive") { result.forward *= 1.55; result.right *= 1.55; result.yaw *= 1.4; }
        if (state.id === "glide") { result.lift = Math.min(.4,number(result.lift)); }
        if (state.id === "autopilot") { result.forward *= .72; result.right *= .72; }
        if (state.id === "compass" || state.id === "gps") { result.yaw += Math.sin(state.clock*1.5)*.17; }
        return result;
    }
    function after(state, physics, dt, biome, controls = {}) {
        if (!state || !physics || dt <= 0) return;
        // Базовые особенности региона также реальны: восходящие потоки и ветер.
        const elapsed = state.clock;
        let wind = biome === "cliff" || biome === "gorge" ? 1.1 :
            biome === "storm" || biome === "summit" || biome === "torrent" ? 1.8 : 0;
        if (state.id === "wind") wind += 2.1;
        if (state.id === "birds") wind += Math.abs(Math.sin(elapsed*3))*1.4;
        if (wind) {
            physics.velocity.x += (Math.sin(elapsed*.64)+.28) * wind * dt;
            physics.velocity.z += Math.cos(elapsed*.9) * wind*.22*dt;
        }
        if (["cliff", "gorge", "summit"].includes(biome)) {
            physics.velocity.y += Math.max(0,Math.sin(elapsed*.74))*.7*dt;
        }
        if (state.id === "glide") physics.velocity.y -= .55*dt;
        if (state.id === "sensitive") {
            // Клавиатура дискретная (+1/-1), поэтому одно умножение входа не
            // сработает: контроллер физики ограничивает оси. Добавляем импульс
            // по курсу, чтобы риск перенастроенной чувствительности был реальным.
            const yaw=physics.attitude?.yaw||0;
            const forward=Number(controls.forward)||0, right=Number(controls.right)||0;
            physics.velocity.x+=(right*Math.cos(yaw)+forward*Math.sin(yaw))*2.9*dt;
            physics.velocity.z+=(forward*-Math.cos(yaw)-right*Math.sin(yaw))*2.9*dt;
        }
    }
    function drain(state, speed) {
        const id = state?.id;
        if (id === "battery") return 1.85;
        if (id === "nohover" && speed < 1.4) return 2.6;
        return 1;
    }
    function range(state, nominal) {
        return state?.id === "range" ? Math.min(95, nominal) : nominal;
    }
    function needsAction(id) { return ["noise", "lidar", "markers", "autopilot", "panic", "decoys"].includes(id); }
    function action(state, target = null) {
        if (!state || !state.id) return null;
        if (needsAction(state.id)) {
            if (target && !target.near) return "АИДА: приблизься к отмеченному объекту, затем нажми F";
            if (target && Number.isInteger(target.index)) state.confirmedIndex = target.index;
            state.tuned = true;
            return "АИДА: объект подтверждён, данные сохранены";
        }
        if (state.id === "spray" || state.id === "dirty") {
            state.cleanedAt = state.clock; return "Оптика очищена — обзор восстановлен";
        }
        return null;
    }
    function visual(state) {
        const id=state?.id;
        if (!id) return "normal";
        if (id === "blackout" && state.clock % 13 > 10.8 && state.clock % 13 < 12.8) return "blackout";
        if ((id === "spray" || id === "dirty") && state.clock-state.cleanedAt > 10) return id;
        if (id === "shake" || id === "vibration") return "shake";
        if (id === "decoys") return "thermal";
        if (id === "lidar" && !state.tuned) return "lidar";
        return "normal";
    }
    return { effects, display, description, create, before, after, drain, range, needsAction, action, visual };
});
