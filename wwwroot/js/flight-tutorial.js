"use strict";

  
                                                                                 
                                                                                  
                                                                            
   
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftTutorial = api;
})(typeof window !== "undefined" ? window : null, function () {
    const TAU = 2 * Math.PI;
    const LESSONS = Object.freeze([
        { id: "start", title: "Начало тренировки", instruction: "Нажми Enter, чтобы начать тренировку.", hint: "Сначала запусти симулятор. Затем появится подсказка по моторам.", keys: "ENTER · Начать" },
        { id: "motors", title: "Запуск двигателей", instruction: "Запусти моторы на площадке.", hint: "Нажми M. На земле пропеллеры работают на холостом ходу.", keys: "M · Моторы" },
        { id: "takeoff", title: "Первый взлёт", instruction: "Взлети и дождись стабилизации дрона.", hint: "Нажми Space. Автопилот поднимет дрон на безопасную высоту.", keys: "SPACE · Взлёт" },
        { id: "hover", title: "Удержание позиции", instruction: "Удерживай дрон почти неподвижно 2 секунды.", hint: "Отпусти движение, дождись торможения. Следи за скоростью: допустимо до 8 км/ч.", keys: "Отпусти WASD" },
        { id: "ascend", title: "Управление высотой", instruction: "Набери высоту не менее 5 метров.", hint: "Удерживай Space для набора высоты. Shift снижает тягу. Не улетай слишком высоко.", keys: "SPACE / SHIFT" },
        { id: "descend", title: "Контролируемое снижение", instruction: "Снизься ниже 3,5 метров, не касаясь земли.", hint: "Удерживай Shift и следи за вертикальной скоростью. Перед землёй снова выровняй тягу.", keys: "SHIFT · Снижение" },
        { id: "forward", title: "Полёт вперёд", instruction: "Пролети вперёд на 5 метров.", hint: "Держи W: корпус наклонится вперёд, и аппарат начнёт разгоняться. Отпусти заранее: есть инерция.", keys: "W · Вперёд" },
        { id: "backward", title: "Торможение и задний ход", instruction: "Пролети назад на 3 метра.", hint: "Используй S, чтобы остановить движение вперёд и отступить. Дрон не тормозит мгновенно.", keys: "S · Назад" },
        { id: "strafe", title: "Боковое перемещение", instruction: "Сместись вправо на 3 метра.", hint: "Удерживай D, чтобы наклонить дрон вправо. A работает в противоположную сторону.", keys: "A / D · Крен" },
        { id: "strafe-left", title: "Боковое движение влево", instruction: "Сместись влево на 3 метра.", hint: "Удерживай A. Боковой крен не остановит дрон мгновенно: учитывай инерцию.", keys: "A · Влево" },
        { id: "yaw", title: "Разворот дрона", instruction: "Разверни нос минимум на 60°.", hint: "Удерживай Q или E. Поворот меняет направление носа, а не автоматически гасит инерцию.", keys: "Q / E · Поворот" },
        { id: "camera", title: "Камера пилота", instruction: "Переключись на камеру FPV от первого лица.", hint: "Нажми V или кнопку камеры. После переключения можешь вернуть вид от третьего лица.", keys: "V · Камера" },
        { id: "gates", title: "Контрольный маршрут", instruction: "Пролети через два подсвеченных кольца.", hint: "Кольца стоят дальше по полю. Осматривайся мышью; их позицию подсказывает маркер в центре сцены.", keys: "WASD · 2 кольца" },
        { id: "landing", title: "Безопасная посадка", instruction: "Нажми L и дождись касания земли.", hint: "Автопосадка сначала погасит горизонтальную скорость, затем снизит аппарат. Моторы отключатся после касания.", keys: "L · Посадка" }
    ]);

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function angleDelta(a, b) {
        let result = (a - b + Math.PI) % TAU;
        if (result < 0) result += TAU;
        return result - Math.PI;
    }

    function create() {
        return { index: 0, stableFor: 0, reference: null, landingOrdered: false,
            finished: false, progress: 0, passed: [] };
    }

    function active(state) { return LESSONS[Math.min(state.index, LESSONS.length - 1)]; }
    function snapshot(sample) {
        return { x: sample.position.x, y: sample.position.y, z: sample.position.z,
            yaw: sample.heading || 0 };
    }
    function update(state, sample, deltaSeconds = 0) {
        if (state.finished || sample.mode !== "running") return false;
        const stage = active(state);
        const position = sample.position;
        const ref = state.reference || snapshot(sample);
        const yaw = ref.yaw;
        const dx = position.x - ref.x, dz = position.z - ref.z;
        const forward = dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const sideways = dx * Math.cos(yaw) + dz * Math.sin(yaw);
        let success = false;
        let progress = 0;
        switch (stage.id) {
            case "start": success = true; progress = 1; break;
            case "motors": success = sample.flightPhase === "armed"; progress = Number(success); break;
            case "takeoff": success = sample.flightPhase === "flying" && sample.altitude >= 1.2; progress = clamp(sample.altitude / 1.6, 0, 1); break;
            case "hover":
                if (sample.flightPhase === "flying" && sample.altitude > 1.3 && sample.horizontalSpeed <= 8 / 3.6)
                    state.stableFor += Math.max(0, Math.min(0.25, deltaSeconds));
                else state.stableFor = 0;
                progress = clamp(state.stableFor / 2, 0, 1);
                success = state.stableFor >= 2;
                break;
            case "ascend": success = sample.altitude >= 5; progress = clamp(sample.altitude / 5, 0, 1); break;
            case "descend": success = sample.flightPhase === "flying" && sample.altitude <= 3.5 && sample.altitude > 1.2;
                progress = clamp((5 - sample.altitude) / 1.5, 0, 1); break;
            case "forward": success = forward >= 5; progress = clamp(forward / 5, 0, 1); break;
            case "backward": success = forward <= -3; progress = clamp(-forward / 3, 0, 1); break;
            case "strafe": success = sideways >= 3; progress = clamp(sideways / 3, 0, 1); break;
            case "strafe-left": success = sideways <= -3; progress = clamp(-sideways / 3, 0, 1); break;
            case "yaw": progress = clamp(Math.abs(angleDelta(sample.heading, ref.yaw)) / (Math.PI / 3), 0, 1); success = progress >= 1; break;
            case "camera": success = sample.cameraMode === "first"; progress = Number(success); break;
            case "gates": progress = clamp(sample.completed / 2, 0, 1); success = sample.completed >= 2; break;
            case "landing": success = state.landingOrdered && sample.flightPhase === "disarmed" && sample.touchdown;
                progress = Number(success); break;
        }
        state.progress = progress;
        if (!success) return false;
        state.passed.push(stage.id);
        state.index++;
        state.stableFor = 0;
        state.reference = snapshot(sample);
        state.progress = 0;
        if (state.index >= LESSONS.length) state.finished = true;
        return true;
    }
    function details(state) {
        const step = active(state);
        return { ...step, index: state.index, total: LESSONS.length,
            completed: state.passed.length, progress: state.finished ? 1 : state.progress,
            finished: state.finished };
    }
    return { LESSONS, create, active, update, details };
});
