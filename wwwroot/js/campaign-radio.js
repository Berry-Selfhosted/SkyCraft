"use strict";
  
                                           
                                                                     
                                                             
   
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftCampaignRadio = api;
})(typeof window !== "undefined" ? window : null, function () {
    const modifierText = {
        wind: "Порывы над долиной усилены. Держи запас по крену.",
        gps: "GPS нестабилен. Доверяй картинке и рельефу больше, чем автокурсу.",
        spray: "На объективе быстро накапливается вода. Не пропускай очистку оптики.",
        noise: "В радиоканале много шума. Подтверждай найденные цели вручную.",
        battery: "Энергия уходит быстрее нормы. Не зависай дольше необходимого.",
        compass: "Компас врёт рядом со скалами. Сверяй курс по горизонту и маякам спасателей.",
        decoys: "Тепловизор может ловить ложные сигналы. Смотри на форму и движение.",
        lidar: "Лидар шумит в тумане. Чистая геометрия важнее красивой картинки.",
        markers: "Световые маркеры помогают маршруту, но отвлекают обзор на периферии.",
        birds: "Ночные птицы реагируют на ИК-подсветку. Оставляй место для манёвра.",
        autopilot: "Автопилот удержит платформу, но мелкие детали он не распознаёт за тебя.",
        lag: "Есть задержка управления. Команды лучше давать с упреждением.",
        sensitive: "Реакция дрона обострена. Работай мягко, без резких импульсов.",
        vibration: "После контакта со скалой возможна вибрация камеры. Береги винты.",
        range: "Дальность связи снижена. Не теряй контроль над обратным маршрутом.",
        blackout: "Видео может кратко пропадать. Запоминай сцену наперёд.",
        dirty: "Оптика загрязнена. Приоритет — телеметрия и геометрия прохода.",
        shake: "Подвес ослаблен. При резких рывках картинка будет дрожать.",
        nohover: "На морозе зависание опасно. Поддерживай движение и импульс.",
        glide: "Тяга ограничена. На узких проходах заранее просчитывай инерцию.",
        panic: "Люди могут скрываться глубже. Координаты подтверждай особенно внимательно.",
        "end-cable": "Финальный режим: грузовая эвакуация. Приоритет — устойчивость платформы.",
        "end-beacon": "Финальный режим: точная доставка маяка. Приоритет — траектория и координаты."
    };

    const biomePrompt = {
        forest: "Лесовой сектор плотный. Сигнал отражается от влажной листвы.",
        river: "Вода даёт блики и шум. Отражения не принимай за цель.",
        cliff: "Разлом усиливает вертикальные потоки. Веди Коршуна плавно.",
        lake: "У берега туман и испарения. Силуэты будут нестабильными.",
        deadforest: "Ночной бурелом сужает коридор полёта. Не теряй высоту над завалами.",
        gorge: "Ущелье режет связь и спутниковый сигнал. Полагайся на ручной контроль.",
        torrent: "Ущелье работает как аэродинамическая труба. Темп высокий, ошибок мало не простит.",
        storm: "Шторм над водой сбивает картинку и радиоканал. Учитывай инерцию заранее.",
        mud: "Грязевой склон быстро слепит камеры. Запас по батарее особенно важен.",
        snow: "Белая мгла ломает ориентиры. Смотри на силуэт рельефа и отмеченные фигуры людей.",
        cave: "Вход в грот узкий, звук винтов отражается эхом. Береги людей от паники.",
        summit: "На вершине сходятся ветер, холод и помехи. Это самый тяжёлый сектор операции."
    };

    function label(speaker, tone) {
        return { speaker: speaker || "АИДА", tone: tone || "info" };
    }

    function createSession(chapter, modifier) {
        return {
            chapter,
            modifier: modifier || null,
            sent: new Set(),
            log: [],
            queue: []
        };
    }

    function push(session, key, text, speaker = "АИДА", tone = "info") {
        if (!text || session.sent.has(key)) return null;
        session.sent.add(key);
        const entry = { id: key, text, speaker, tone, time: Date.now() };
        session.log.push(entry);
        session.queue.push(entry);
        return entry;
    }

    function intro(session) {
        const chapter = session.chapter;
        push(session, "intro-0",
            `Оператор, сектор «${chapter.title}». ${biomePrompt[chapter.biome] || "Работаем по стандартному поисковому протоколу."}`);
        push(session, "intro-ack",
            "Коршун на связи. Канал чистый, начинаю проход сектора.", "КОРШУН");
        push(session, "intro-1",
            `Цель вылета: ${chapter.objective}`);
        if (session.modifier) {
            push(session, "intro-modifier",
                `Напоминаю о конфигурации после дебрифинга. ${modifierText[session.modifier] || "Условия вылета изменены предыдущим решением."}`,
                "АИДА", "warning");
        }
    }

    function update(session, snapshot) {
        if (!session || !snapshot || !session.chapter) return null;
        const chapter = session.chapter;
        if (!session.sent.has("intro-0") && ["ready", "running"].includes(snapshot.mode)) {
            intro(session);
        }

        if (!session.sent.has("armed") && snapshot.flightPhase === "armed") {
            push(session, "armed", "Моторы запущены. Проверка канала и гиростабилизации завершена.");
        }
        if (!session.sent.has("takeoff") && snapshot.flightPhase === "takeoff") {
            push(session, "takeoff", "Взлёт подтверждён. Держу погодную модель открытой в фоне.");
        }
        if (!session.sent.has("checkpoint-1") && snapshot.completed >= 1) {
            push(session, "checkpoint-1", "Первую контрольную точку вижу. Продолжаю маршрут.", "КОРШУН", "success");
            push(session, "checkpoint-1-aida", chapter.summary);
        }
        if (!session.sent.has("checkpoint-2") && snapshot.completed >= 2) {
            push(session, "checkpoint-2", "Есть новые следы. Продолжай поиск, я уточняю маршрут спасателей.");
        }
        if (!session.sent.has("final-approach") && snapshot.completed >= Math.max(1, snapshot.level.checkpoints.length - 1)) {
            push(session, "final-approach", "Финальный сектор впереди. После подтверждения цели выводи аппарат на посадку.", "АИДА", "success");
        }
        if (!session.sent.has("collision") && (snapshot.collisionCount || 0) >= 1) {
            push(session, "collision", "Фиксирую контакт с препятствием. Снизь темп и сохрани платформу целой.", "АИДА", "warning");
        }
        if (!session.sent.has("battery-mid") && snapshot.battery <= 45) {
            push(session, "battery-mid", `Остаток заряда ${Math.round(snapshot.battery)} процентов. Планируй возврат заранее.`, "АИДА", "warning");
            push(session, "battery-mid-ack", "Принял. Корректирую маршрут и слежу за посадочной зоной.", "КОРШУН");
        }
        if (!session.sent.has("battery-low") && snapshot.battery <= 18) {
            push(session, "battery-low", "Критически малый резерв. Приоритет — посадка и передача координат.", "АИДА", "danger");
        }
        if (!session.sent.has("scan-hint") && snapshot.campaignAction) {
            push(session, "scan-hint", snapshot.campaignAction, "АИДА", "action");
            push(session, "scan-hint-ack", "Подтверждаю. Выполняю по инструкции.", "КОРШУН");
        }
        if (!session.sent.has("low-battery-landing") && snapshot.lowBattery) {
            push(session, "low-battery-landing", "Включаю аварийный сценарий. Сохраняем аппарат настолько, насколько это возможно.", "АИДА", "danger");
        }
        if (!session.sent.has("done") && snapshot.mode === "done") {
            const ending = chapter.index === 12
                ? "Последний вылет завершён. Решение будет записано в журнал операции."
                : `Сектор «${chapter.title}» закрыт. Переходим к послеполётному дебрифингу.`;
            push(session, "done", ending, "АИДА", "success");
        }
        return session.queue.shift() || null;
    }

    return Object.freeze({ createSession, update, modifierText });
});
