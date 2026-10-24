"use strict";

/*
 * Flight UI: HUD, управление прохождением и локальные рекорды.
 * Выбор карты и собранного дрона находится на странице /Play.
 * Никакой серверной логики, начисления денег или мультиплеера здесь нет.
 */
(function () {
    const canvas = document.getElementById("flight-canvas");
    if (!canvas || !window.SkycraftLevels || !window.SkycraftFlightScene) return;

    const $ = (id) => document.getElementById(id);
    const startPrompt = $("flight-enter-prompt");
    const retry = $("flight-retry");
    const win = $("flight-win");
    const notification = $("flight-notification");
    const motorIndicator = $("flight-motor-indicator");
    const mobileObjective = $("flight-mobile-objective");
    const mobileObjectiveStep = $("flight-mobile-objective-step");
    const mobileObjectiveTitle = $("flight-mobile-objective-title");
    const mobileObjectiveCommand = $("flight-mobile-objective-command");
    const mobileObjectiveDetails = $("flight-mobile-objective-details");
    const mobileObjectiveFill = $("flight-mobile-objective-fill");
    const cameraToggle = $("flight-camera-toggle");
    const cameraLabel = $("flight-camera-label");
    const helpToggle = $("flight-help-toggle");
    const radioPanel = $("flight-radio-panel");
    const radioLog = $("flight-radio-log");
    const radioStatus = $("flight-radio-status");
    const radioTitle = $("flight-radio-title");
    const radioAvatar = $("flight-radio-avatar");
    const radioSpeaker = $("flight-radio-speaker");
    const radioRole = $("flight-radio-role");
    const radioCurrent = $("flight-radio-current");
    const atmosphere = $("flight-atmosphere");
    const cinematicTitle = $("flight-cinematic-title");
    const cinematicLocation = $("flight-cinematic-location");
    const cinematicName = $("flight-cinematic-name");
    const cinematicObjective = $("flight-cinematic-objective");
    const store = window.SkycraftEconomy?.createStore(window.SkycraftProfiles.storage);
    let selectedDrone = null;
    const recordKey = "skycraft.flight.records.v1";
    const trainingKey = "skycraft.tutorial.completed.v1";
    let trained = false;
    try { trained = window.SkycraftProfiles.storage.getItem(trainingKey) === "true"; } catch { /* private browsing */ }
    // На эту страницу попадаем только после выбора карты.
    // Прямая ссылка не должна обходить допуск академии или проверку собранного дрона.
    const requestedLevelId = new URLSearchParams(window.location.search).get("level") || "academy";
    const requestedLevel = window.SkycraftLevels.find(level => level.id === requestedLevelId);
    const campaignStore = window.SkycraftCampaign?.createStore(window.SkycraftProfiles.storage);
    const campaignChapter = requestedLevel?.storyIndex || null;
    if (!requestedLevel) {
        window.location.replace("/Play");
        return;
    }
    if (!requestedLevel.tutorial && !trained) {
        window.location.replace(requestedLevel.story ? "/Campaign?reason=academy" : "/Play?reason=academy");
        return;
    }
    if (requestedLevel.story && !campaignStore?.unlocked(requestedLevel.storyIndex)) {
        window.location.replace("/Campaign");
        return;
    }
    const loanerSpecs = { weight: 12, speed: 60, time: 12, range: 1200 };
    const loanerParts = window.SkycraftDroneStats.DEFAULTS;
    let lessonIndex = -1;
    let currentLevel = null;
    let lastMode = null;
    let lastPhase = null;
    let notificationTimeout = null;
    let lastCollisionSound = -Infinity;
    let lastCheckpointSound = 0;
    let lastMissionState = null;
    let lastCampaignVisual = null;
    let campaignResultHandled = false;
    let radioSession = null;
    let cinematicTimeout = null;
    let lastMobileObjectiveSignature = null;
    let lastMobileObjectiveStep = null;

    function applyResponsiveFlightUi() {
        // Единый детектор загружен в <head>, до отрисовки страницы.
        const mobileUi = window.SkycraftDeviceLayout?.sync() ?? false;
        document.body.classList.toggle("is-mobile-flight-ui", mobileUi);
        document.body.classList.toggle("is-desktop-flight-ui", !mobileUi);
        if (mobileObjectiveDetails) mobileObjectiveDetails.hidden = true;
        if (mobileObjective) {
            mobileObjective.setAttribute("aria-expanded", "false");
            mobileObjective.classList.remove("is-expanded");
        }
    }

    function readRecords() {
        try {
            const records = JSON.parse(window.SkycraftProfiles.storage.getItem(recordKey));
            return records && typeof records === "object" ? records : {};
        } catch {
            return {};
        }
    }

    function formatTime(seconds) {
        const total = Math.floor(seconds);
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    function showNotification(message) {
        notification.textContent = message;
        notification.classList.add("is-visible");
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => notification.classList.remove("is-visible"), 1400);
    }

    function clearRadio() {
        radioSession = null;
        if (radioLog) radioLog.replaceChildren();
        if (radioStatus) radioStatus.textContent = "ТИХИЙ КАНАЛ";
        if (radioTitle) radioTitle.textContent = "РАЦИЯ В ЭФИРЕ";
        if (radioSpeaker) radioSpeaker.textContent = "АИДА";
        if (radioRole) radioRole.textContent = "ИИ-ассистент спасательной операции";
        if (radioAvatar) radioAvatar.src = "/assets/characters/aida-neutral.png";
        if (radioCurrent) radioCurrent.hidden = true;
        if (radioPanel) radioPanel.hidden = true;
    }

    function getSpeakerProfile(entry) {
        const name = String(entry?.speaker || "АИДА").toLowerCase();
        if (name.includes("коршун")) {
            const emotion = entry?.tone === "warning" || entry?.tone === "danger" ? "concern" : "focused";
            return {
                label: "КОРШУН",
                role: "Оператор БПЛА спасательной группы",
                avatar: `/assets/characters/korshun-${emotion}.png`
            };
        }
        const emotion = entry?.tone === "success" ? "smile"
            : entry?.tone === "warning" || entry?.tone === "danger" || entry?.tone === "action" ? "alert"
            : "neutral";
        return {
            label: "АИДА",
            role: "ИИ-ассистент спасательной операции",
            avatar: `/assets/characters/aida-${emotion}.png`
        };
    }

    function showCinematicTitle(level) {
        if (!cinematicTitle || !level) return;
        const isStory = !!level.story;
        cinematicLocation.textContent = isStory ? level.subtitle : (level.subtitle || "ИСПЫТАНИЕ");
        cinematicName.textContent = level.name;
        cinematicObjective.textContent = isStory
            ? (window.SkycraftCampaign?.chapters?.[level.storyIndex - 1]?.objective || level.description || "")
            : (level.description || "Пройди маршрут и выполни посадку.");
        cinematicTitle.classList.remove("is-visible");
        void cinematicTitle.offsetWidth;
        cinematicTitle.classList.add("is-visible");
        clearTimeout(cinematicTimeout);
        cinematicTimeout = setTimeout(() => cinematicTitle.classList.remove("is-visible"), 5200);
    }

    function pushRadio(entry) {
        if (!entry || !radioPanel || !radioLog) return;
        radioPanel.hidden = false;
        const profile = getSpeakerProfile(entry);
        if (radioCurrent) radioCurrent.hidden = false;
        if (radioAvatar) radioAvatar.src = profile.avatar;
        if (radioSpeaker) radioSpeaker.textContent = profile.label;
        if (radioRole) radioRole.textContent = profile.role;
        const item = document.createElement("article");
        item.className = `flight-radio-entry tone-${entry.tone || "info"}`;
        const avatar = document.createElement("img");
        avatar.className = "flight-radio-entry-avatar";
        avatar.src = profile.avatar;
        avatar.alt = profile.label;
        const copy = document.createElement("div");
        copy.className = "flight-radio-entry-copy";
        const label = document.createElement("strong");
        label.textContent = profile.label;
        const body = document.createElement("p");
        body.textContent = entry.text;
        copy.append(label, body);
        item.append(avatar, copy);
        radioLog.append(item);
        while (radioLog.children.length > 5) radioLog.firstElementChild?.remove();
        radioLog.scrollTop = radioLog.scrollHeight;
        if (radioStatus) {
            radioStatus.textContent = entry.tone === "danger" ? "ТРЕВОГА"
                : entry.tone === "warning" ? "АКТИВНЫЙ КАНАЛ"
                : entry.tone === "success" ? "ЦЕЛЬ ПОДТВЕРЖДЕНА"
                : entry.tone === "action" ? "ТРЕБУЕТСЯ ДЕЙСТВИЕ"
                : "КАНАЛ ОТКРЫТ";
        }
        if (entry.tone === "warning" || entry.tone === "danger" || entry.tone === "action") {
            showNotification(`АИДА: ${entry.text}`);
        }
    }

    function beginRadio(level) {
        if (!level?.story || !window.SkycraftCampaignRadio || !window.SkycraftCampaign) {
            clearRadio();
            return;
        }
        const chapter = window.SkycraftCampaign.chapters[level.storyIndex - 1];
        radioSession = window.SkycraftCampaignRadio.createSession(
            chapter,
            campaignStore?.modifierFor(level.storyIndex)
        );
        if (radioTitle) radioTitle.textContent = `РАЦИЯ / ${level.sectorName || chapter.region || chapter.title}`;
        if (radioLog) radioLog.replaceChildren();
        if (radioPanel) radioPanel.hidden = false;
        const first = window.SkycraftCampaignRadio.update(radioSession, {
            mode: "ready", level, flightPhase: "disarmed", battery: 100, completed: 0,
            collisionCount: 0, campaignAction: null
        });
        if (first) pushRadio(first);
        let next;
        while ((next = radioSession.queue?.shift())) pushRadio(next);
    }

    function syncRadio(state) {
        if (!radioSession || !window.SkycraftCampaignRadio) return;
        const entry = window.SkycraftCampaignRadio.update(radioSession, state);
        if (entry) pushRadio(entry);
        let next;
        while ((next = radioSession.queue?.shift())) pushRadio(next);
    }

    function syncAtmosphere(state) {
        if (!atmosphere) return;
        // Real atmosphere/light comes from Three.js; do not overlay a fake sky.
        atmosphere.hidden = true;
        atmosphere.dataset.biome = state.level?.story ? (window.SkycraftCampaign?.chapters?.[state.level.storyIndex - 1]?.biome || "story") : "none";
    }

    const scene = new window.SkycraftFlightScene(canvas, updateUi);

    function requireDrone() {
        if (currentLevel?.tutorial || currentLevel?.story || selectedDrone) return true;
        showNotification("СНАЧАЛА СОБЕРИ ДРОН В КРАФТЕ");
        window.SkycraftSounds?.play("error");
        return false;
    }

    function loadDroneForMission() {
        if (currentLevel?.tutorial || currentLevel?.story) return; // учебный / спасательный аппарат бесплатно

        // Тот же готовый аппарат, который игрок выбрал на экране миссий.
        const drone = store?.getActiveDrone();
        if (!drone?.parts) return;
        try {
            const stats = window.SkycraftDroneStats.calculate(drone.parts);
            selectedDrone = drone;
            scene.setFlightSpecs(stats);
            scene.setConfiguration(drone.parts);
        } catch {
            showNotification("ОШИБКА КОМПЛЕКТАЦИИ ДРОНА");
        }
    }

    function updateFlightAvailability() {
        const ready = !!(selectedDrone || currentLevel?.tutorial || currentLevel?.story);
        // Все основные действия выполняются с клавиатуры, отдельной панели больше нет.
        retry.disabled = !ready;
        if (!ready) $("flight-hud-status").textContent = "НЕТ ГОТОВОГО ДРОНА";
    }

    function savePersonalBest(levelId, seconds) {
        const records = readRecords();
        if (typeof records[levelId] !== "number" || seconds < records[levelId]) {
            records[levelId] = seconds;
            try {
                window.SkycraftProfiles.storage.setItem(recordKey, JSON.stringify(records));
            } catch {
                // В режиме без хранилища рекорды действуют только до обновления страницы.
            }
        }
        return records[levelId];
    }

    function refreshBest() {
        const best = readRecords()[currentLevel.id];
        $("flight-best").textContent = typeof best === "number" ? formatTime(best) : "—";
    }

    mobileObjective?.addEventListener("click", () => {
        // Начиная с v0.24 мобильная подсказка — это однострочный HUD.
        // Полные объяснения открываются через отдельную кнопку помощи (I),
        // поэтому сам заголовок больше не разворачивается по нажатию.
        mobileObjective.setAttribute("aria-expanded", "false");
        mobileObjective.classList.remove("is-expanded");
        if (mobileObjectiveDetails) mobileObjectiveDetails.hidden = true;
    });

    applyResponsiveFlightUi();
    window.addEventListener("resize", applyResponsiveFlightUi, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(applyResponsiveFlightUi, 0));

    // Блокируем случайное выделение и долгий тап только во время активной игры.
    // В меню и на других страницах браузер продолжает работать обычным образом.
    for (const eventName of ["selectstart", "dragstart", "contextmenu"]) {
        document.addEventListener(eventName, (event) => {
            if (document.body.classList.contains("flight-gameplay-active") &&
                event.target?.closest?.("#flight-stage")) {
                event.preventDefault();
            }
        });
    }

    // Данные задания находятся поверх 3D-сцены, а не в панели подсказок.
    // Перерисовываем их только при смене этапа, а не каждые 50 мс вместе с HUD.
    function updateMission(state) {
        const total = state.level.checkpoints.length;
        const completed = Math.max(0, Math.min(total, state.completed));
        const signature = [state.level.id, completed, state.mode, state.flightPhase,
            state.tutorial?.index ?? "", state.tutorial?.finished ?? ""].join(":");
        if (signature === lastMissionState) return;
        lastMissionState = signature;

        const counter = $("flight-mission-count");
        const progress = $("flight-mission-progressbar");
        const fill = $("flight-mission-progress-fill");
        const instruction = $("flight-mission-next");
        const missionLabel = $("flight-mission-label");

        if (state.tutorial) {
            const lesson = state.tutorial;
            const finishedCount = lesson.finished ? lesson.total : lesson.completed;
            counter.textContent = `${finishedCount} / ${lesson.total}`;
            fill.style.width = `${Math.round(finishedCount / lesson.total * 100)}%`;
            progress.setAttribute("aria-label", "Пройденные этапы обучения");
            progress.setAttribute("aria-valuemax", String(lesson.total));
            progress.setAttribute("aria-valuenow", String(finishedCount));
            instruction.textContent = lesson.finished ? "Обучение пройдено!" : `Цель: ${lesson.title}`;
            return;
        }
        const storyTargets = !!state.level.story;
        progress.setAttribute("aria-label", storyTargets ? "Найденные люди" : "Пройденные контрольные точки");
        if (missionLabel) missionLabel.textContent = storyTargets ? "НАЙДЕННЫЕ ЛЮДИ" : "КОНТРОЛЬНЫЕ ТОЧКИ";
        counter.textContent = `${completed} / ${total}`;
        fill.style.width = `${total ? (completed / total) * 100 : 0}%`;
        progress.setAttribute("aria-valuemax", String(total));
        progress.setAttribute("aria-valuenow", String(completed));

        if (state.mode === "ready") {
            instruction.textContent = state.level.story
                ? "ENTER — начать · M — моторы · SPACE — взлёт"
                : "ENTER — начать · M — моторы · SPACE — взлёт";
        } else if (state.mode === "paused") {
            instruction.textContent = "ESC — продолжить · R — заново";
        } else if (state.mode === "done") {
            instruction.textContent = state.level.story ? "Поиск завершён!" : "Маршрут пройден!";
        } else if (state.mode === "depleted") {
            instruction.textContent = "Заряд исчерпан";
        } else if (completed === total) {
            instruction.textContent = state.level.story ? "Цель: вернись и выполни посадку (L)" : "Цель: выполни посадку (L)";
        } else if (state.flightPhase === "disarmed") {
            instruction.textContent = "M — запустить моторы";
        } else if (state.flightPhase === "armed") {
            instruction.textContent = "SPACE — взлететь";
        } else {
            instruction.textContent = state.level.story
                ? `Цель: найди человека ${completed + 1} из ${total} и нажми F`
                : `Цель: ворота ${completed + 1} из ${total}`;
        }
    }

    function updateLessonCard(state) {
        const card = $("flight-lesson-card");
        if (!card) return;
        const lesson = state.tutorial;
        card.hidden = !lesson || lesson.finished || state.mode === "done";
        if (!lesson || lesson.finished) return;
        if (lesson.index !== lessonIndex) {
            if (lessonIndex !== -1 && lesson.index > lessonIndex) {
                showNotification("ЭТАП ПРОЙДЕН! СЛЕДУЮЩЕЕ ЗАДАНИЕ");
                window.SkycraftSounds?.play("checkpoint");
            }
            lessonIndex = lesson.index;
            $("flight-lesson-step").textContent = `ШАГ ${String(lesson.index + 1).padStart(2,"0")} / ${lesson.total}`;
            $("flight-lesson-title").textContent = lesson.title;
            $("flight-lesson-instruction").textContent = lesson.instruction;
            $("flight-lesson-hint").textContent = lesson.hint;
            $("flight-lesson-keys").textContent = lesson.keys;
        }
        $("flight-lesson-fill").style.width = `${Math.round(lesson.progress * 100)}%`;
    }

    // На мобильном экране показываем одну маленькую карточку вместо
    // полноразмерного HUD задания и отдельного окна инструктора.
    // Используем те же данные, что и в обычном режиме: прогресс не дублируется.
    function updateMobileObjective(state) {
        if (!mobileObjective || !mobileObjectiveStep || !mobileObjectiveTitle ||
            !mobileObjectiveCommand || !mobileObjectiveDetails || !mobileObjectiveFill) return;
        const lesson = state.tutorial && !state.tutorial.finished ? state.tutorial : null;
        const total = lesson ? lesson.total : state.level.checkpoints.length;
        const completed = lesson ? lesson.completed : state.completed;
        const title = lesson ? lesson.title : state.level.name;
        const caption = lesson
            ? `АКАДЕМИЯ · ${String(lesson.index + 1).padStart(2, "0")}/${lesson.total}`
            : `${state.level.story ? "ОПЕРАЦИЯ" : "УРОВЕНЬ"} · ${completed}/${total}`;
        const command = lesson
            ? `${lesson.keys} — ${lesson.instruction}`
            : (completed >= total
                ? (state.level.story ? "L — посадка после спасения" : "L — посадка")
                : (state.level.story
                    ? `Цель: человек ${completed + 1}/${total} · F — подтвердить`
                    : `Цель: ворота ${completed + 1}/${total}`));
        const details = lesson ? lesson.hint : (state.level.description || "");
        const signature = `${caption}:${title}:${command}:${details}`;
        if (signature !== lastMobileObjectiveSignature) {
            mobileObjectiveStep.textContent = caption;
            mobileObjectiveTitle.textContent = title;
            mobileObjectiveCommand.textContent = command;
            mobileObjectiveDetails.textContent = details;
            lastMobileObjectiveSignature = signature;
        }
        mobileObjectiveFill.style.width = `${Math.round(Math.max(0, Math.min(1, total ? completed / total : 0)) * 100)}%`;
        // После перехода к следующему упражнению автоматически сворачиваем подсказку.
        const step = `${state.level.id}:${lesson?.index ?? completed}`;
        if (step !== lastMobileObjectiveStep) {
            lastMobileObjectiveStep = step;
            mobileObjective.classList.remove("is-expanded");
            mobileObjective.setAttribute("aria-expanded", "false");
            mobileObjectiveDetails.hidden = true;
        }
    }

    function updateUi(state) {
        if (!state.level) return;
        // CSS компактного полётного интерфейса ориентируется на текущий режим.
        const stage = $("flight-stage");
        stage.dataset.flightMode = state.mode;
        stage.dataset.flightPhase = state.flightPhase || "disarmed";
        document.body.classList.toggle("flight-gameplay-active", state.mode === "running");
        if (startPrompt) startPrompt.hidden = state.mode !== "ready";
        const pauseMenu = $("flight-pause-menu");
        if (pauseMenu) pauseMenu.hidden = state.mode !== "paused";
        updateMission(state);
        updateLessonCard(state);
        updateMobileObjective(state);
        syncAtmosphere(state);
        syncRadio(state);
        if (state.campaign) {
            const effect = state.campaign;
            const visual = $("flight-campaign-visual");
            if (visual && lastCampaignVisual !== effect.visual) {
                lastCampaignVisual = effect.visual;
                visual.dataset.effect = effect.visual;
            }
            if (state.campaignAction) showNotification(state.campaignAction);
            $("flight-campaign-effect").textContent = effect.name;
            $("flight-campaign-description").textContent = effect.description;
            const action = $("flight-campaign-action");
            if (action) {
                const needs = ["noise","lidar","markers","autopilot","panic","decoys"].includes(effect.modifier);
                const clean = ["spray","dirty"].includes(effect.modifier);
                action.hidden = !(needs || clean);
                action.textContent = clean ? "C / Очистить оптику" : "F / Подтвердить сканирование";
            }
        }
        $("flight-altitude").textContent = `${state.altitude.toFixed(1).replace(".", ",")} м`;
        $("flight-speed").textContent = `${state.speed.toFixed(1).replace(".", ",")} км/ч`;
        $("flight-rpm").textContent = `${Math.round(state.rpm || 0).toLocaleString("ru-RU")} об/мин`;
        $("flight-battery").textContent = `${Math.round(state.battery)}%`;
        $("flight-radius").textContent = `${Math.round(state.radius)} / ${state.maxRange} м`;
        $("flight-progress").textContent = `${state.completed} / ${state.level.checkpoints.length}`;
        $("flight-time").textContent = formatTime(state.time);
        const phase = state.flightPhase || "disarmed";
        const armed = phase !== "disarmed";
        motorIndicator.textContent = armed ? "МОТОРЫ ВКЛ." : "МОТОРЫ ВЫКЛ.";
        motorIndicator.classList.toggle("is-armed", armed);
        if (cameraToggle && cameraLabel) {
            const fpv = state.cameraMode === "first";
            cameraLabel.textContent = fpv ? "FPV · 1-е лицо" : "3-е лицо";
            cameraToggle.setAttribute("aria-pressed", String(fpv));
            cameraToggle.title = fpv ? "Переключить на третье лицо (V)" : "Переключить на FPV (V)";
        }

        if (state.completed === 0) lastCheckpointSound = 0;
        if (state.collision || state.rangeLimit) {
            const target = state.collisionName ? `: ${state.collisionName}` : "";
            showNotification(state.rangeLimit ? "ПРЕДЕЛ ДАЛЬНОСТИ ДРОНА" :
                (state.collisionImpact > 4 ? `СИЛЬНЫЙ УДАР${target}` : `ПРЕПЯТСТВИЕ${target}`));
            if (state.time - lastCollisionSound > 1.25) {
                window.SkycraftSounds?.play("error");
                lastCollisionSound = state.time;
            }
        }
        if (state.checkpoint && state.mode !== "done") {
            showNotification(`ВОРОТА ${state.completed} ПРОЙДЕНЫ`);
            if (state.completed !== lastCheckpointSound) {
                window.SkycraftSounds?.play("checkpoint");
                lastCheckpointSound = state.completed;
            }
        }

        if (state.lowBattery) {
            showNotification("МАЛЫЙ ЗАРЯД — АВАРИЙНАЯ ПОСАДКА");
            window.SkycraftSounds?.play("error");
        }
        if (state.touchdown) {
            showNotification(state.touchdown === "hard" ? "ЖЁСТКАЯ ПОСАДКА! МОТОРЫ ВЫКЛЮЧЕНЫ"
                : "ПОСАДКА ЗАВЕРШЕНА — МОТОРЫ ВЫКЛЮЧЕНЫ");
            window.SkycraftSounds?.play(state.touchdown === "hard" ? "error" : "success");
        }
        if (lastMode !== state.mode || lastPhase !== state.flightPhase) {
            lastMode = state.mode;
            lastPhase = state.flightPhase;
            win.hidden = !["done", "depleted"].includes(state.mode);
            $("flight-result-symbol").textContent = state.mode === "depleted" ? "⚡" : "✓";
            $("flight-result-caption").textContent = state.mode === "depleted"
                ? "ЗАРЯД ИСЧЕРПАН" : "ИСПЫТАНИЕ ЗАВЕРШЕНО";
            $("flight-result-title").textContent = state.mode === "depleted"
                ? "ЗАРЯД ИСЧЕРПАН" : (state.level.story ? "ПОИСК ЗАВЕРШЁН!" : "МАРШРУТ ПРОЙДЕН!");
            const phases = {
                disarmed: "МОТОРЫ ВЫКЛЮЧЕНЫ",
                armed: "МОТОРЫ ЗАПУЩЕНЫ",
                takeoff: "ВЗЛЁТ",
                flying: "В ПОЛЁТЕ",
                landing: "АВТОПОСАДКА"
            };
            const states = {
                ready: "ГОТОВ К ПОЛЁТУ",
                running: phases[state.flightPhase] || "В ПОЛЁТЕ",
                paused: "ПАУЗА",
                done: "МАРШРУТ ПРОЙДЕН",
                depleted: "БАТАРЕЯ РАЗРЯЖЕНА"
            };
            $("flight-hud-status").textContent = states[state.mode];

            if (state.mode === "depleted") {
                $("flight-result").textContent = `Дрон продержался ${formatTime(state.time)}. Установи более ёмкую батарею или пройди маршрут быстрее.`;
                window.SkycraftSounds?.play("error");
            }
            if (state.mode === "done") {
                let campaignSaved = true;
                if (state.level.story && !campaignResultHandled) {
                    campaignResultHandled = true;
                    campaignSaved = campaignStore?.complete(state.level.storyIndex, state.time) === true;
                    if (campaignSaved) renderCampaignDebrief(state.level.storyIndex, state);
                }
                if (state.level.tutorial) {
                    trained = true;
                    try { window.SkycraftProfiles.storage.setItem(trainingKey, "true"); } catch { /* no storage */ }
                    $("flight-result-title").textContent = "ОБУЧЕНИЕ ПРОЙДЕНО!";
                    $("flight-result-caption").textContent = "ДОПУСК К ИСПЫТАНИЯМ";
                }
                const best = savePersonalBest(state.level.id, state.time);
                showLevelReward(state, campaignSaved);
                $("flight-result").textContent = state.level.story
                    ? `Группа обнаружена. Точки осмотрены, посадка завершена. Время: ${formatTime(state.time)}. Теперь выбери план следующего вылета вместе с АИДОЙ.`
                    : state.level.tutorial
                    ? `Отличная работа! Ты освоил управление и безопасную посадку. Все три трассы открыты. Время: ${formatTime(state.time)}.`
                    : `Время: ${formatTime(state.time)} · Лучшее: ${formatTime(best)}`;
                refreshBest();
                showNotification("ИСПЫТАНИЕ ЗАВЕРШЕНО");
                window.SkycraftSounds?.play("complete");
            }
        }
        updateFlightAvailability();
    }

    function showLevelReward(state, canClaim = true) {
        const element = $("flight-level-reward");
        if (!element) return;
        const modifier = state.level.story ? campaignStore?.modifierFor(state.level.storyIndex) : null;
        const planned = window.SkycraftFlightRewards?.calculate(state.level, modifier);
        if (!planned) { element.hidden = true; return; }
        element.hidden = false;
        if (!canClaim) {
            element.textContent = "Награду не удалось сохранить вместе с прогрессом. Повтори уровень.";
            element.dataset.status = "error";
            return;
        }
        const result = store?.claimLevelReward(state.level.id, planned.total);
        if (!result?.ok) {
            element.textContent = "Не удалось сохранить награду: проверь хранилище браузера.";
            element.dataset.status = "error";
        } else if (result.claimed) {
            element.textContent = `+${result.amount} CR · награда за уровень${planned.bonus ? ` (включая ${planned.bonus} CR за риск)` : ""}`;
            element.dataset.status = "awarded";
        } else {
            element.textContent = "Награда за этот уровень уже получена · рекорд обновлён";
            element.dataset.status = "claimed";
        }
    }

    function chooseLevel(level) {
        if (!level.tutorial && !trained) {
            showNotification("СНАЧАЛА ПРОЙДИ АКАДЕМИЮ ПИЛОТА");
            return;
        }
        currentLevel = level;
        const rewardPanel = $("flight-level-reward");
        if (rewardPanel) rewardPanel.hidden = true;
        campaignResultHandled = false;
        lastCampaignVisual = null;
        const storyPanel = $("flight-campaign-signal");
        if (storyPanel) storyPanel.hidden = !level.story;
        if (level.story) beginRadio(level);
        else clearRadio();
        const gameExit = $("flight-exit");
        if (gameExit) {
            gameExit.href = level.story ? "/Campaign" : "/Play";
            gameExit.textContent = level.story ? "← Карта операции" : "← К уровням";
        }
        const pauseExit = document.querySelector("#flight-pause-menu a.flight-menu-link");
        if (pauseExit) { pauseExit.href = level.story ? "/Campaign" : "/Play";
            pauseExit.textContent = level.story ? "← К операции" : "← Выбрать другой уровень"; }
        const resultExit = document.querySelector("#flight-win a.flight-menu-link");
        if (resultExit) { resultExit.href = level.story ? "/Campaign" : "/Play";
            resultExit.textContent = level.story ? "← Карта операции" : "← К выбору уровней"; }
        lessonIndex = -1;
        lastMode = null;
        lastPhase = null;
        lastCollisionSound = -Infinity;
        lastCheckpointSound = 0;
        lastMissionState = null;
        scene.selectLevel(level);
        if ($("flight-campaign-debrief")) $("flight-campaign-debrief").hidden = true;
        if (level.tutorial || level.story) {
            scene.setFlightSpecs(loanerSpecs);
            scene.setConfiguration(loanerParts);
        }
        $("flight-mission-hud").style.setProperty("--mission-accent", level.accent);
        $("flight-hud-location").textContent = level.subtitle;
        $("flight-level-title").textContent = level.name;
        $("flight-level-description").textContent = level.story
            ? window.SkycraftCampaign.chapters[level.storyIndex-1].objective
            : level.description;
        $("flight-difficulty").textContent = level.difficulty;
        showCinematicTitle(level);
        notification.classList.remove("is-visible");
        $("flight-stage").classList.toggle("is-academy", !!level.tutorial);
        $("flight-stage").classList.toggle("is-campaign", !!level.story);
        refreshBest();
        updateFlightAvailability();
    }

    function renderCampaignDebrief(chapterIndex, result) {
        const card = $("flight-campaign-debrief");
        if (!card || !window.SkycraftCampaign) return;
        const chapter = window.SkycraftCampaign.chapters[chapterIndex - 1];
        card.hidden = false;
        const condition = window.SkycraftCampaignEffects?.display(
            campaignStore?.modifierFor(chapterIndex)) || "СТАНДАРТНЫЕ УСЛОВИЯ";
        const battery = Math.max(0, Math.round(result.battery));
        const collisions = result.collisionCount || 0;
        const report = `Остаток заряда: ${battery}%. Касаний препятствий: ${collisions}. ` +
            `Условия вылета: ${condition.toLowerCase()}. ` +
            `Стиль решений: ${campaignStore?.profile() || "не определён"}. `;
        $("flight-debrief-text").textContent = `АИДА: ${report}${chapter.aida}`;
        const options = $("flight-debrief-choices");
        options.replaceChildren();
        chapter.choices.forEach(choice => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "flight-debrief-option";
            const title = document.createElement("strong"); title.textContent = choice.label;
            const info = document.createElement("small"); info.textContent = `${choice.detail} ${choice.effect}`;
            button.append(title, info);
            button.addEventListener("click", () => {
                if (campaignStore?.choose(chapterIndex, choice.id)) {
                    window.SkycraftSounds?.play("success");
                    window.location.assign(`/Campaign?chapter=${Math.min(12, chapterIndex + 1)}`);
                }
            });
            options.append(button);
        });
    }

    $("flight-campaign-action")?.addEventListener("click", () => {
        if (!scene.campaignState || scene.mode !== "running") return;
        const point=scene.level?.checkpoints[scene.completed];
        const near=point && Math.hypot(scene.position.x-point.x,
            scene.position.y-point.y,scene.position.z-point.z)<point.radius*1.85;
        const message = window.SkycraftCampaignEffects?.action(scene.campaignState,
            {near:!!near,index:scene.completed});
        if (message) showNotification(message);
        canvas.focus({preventScroll:true});
    });

    cameraToggle?.addEventListener("click", () => {
        scene.toggleCameraMode();
        cameraToggle.blur();
    });

    retry.addEventListener("click", () => {
        if (!requireDrone()) return;
        lastMode = null;
        scene.reset();
        campaignResultHandled = false;
        $("flight-campaign-debrief").hidden = true;
        lastPhase = null;
        scene.start();
        window.SkycraftSounds?.play("start");
    });

    startPrompt?.addEventListener("click", () => {
        if (scene.mode === "ready" && requireDrone()) {
            scene.start();
            canvas.focus({ preventScroll: true });
            window.SkycraftSounds?.play("start");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLElement &&
            (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(event.target.tagName) || event.target.isContentEditable)) return;
        if (event.code === "Enter" && !event.repeat) {
            if (scene.mode === "ready") {
                if (!requireDrone()) return;
                scene.start();
                canvas.focus({ preventScroll: true });
                window.SkycraftSounds?.play("start");
                event.preventDefault();
            } else if (scene.mode === "paused") {
                scene.pause();
                canvas.focus({ preventScroll: true });
                window.SkycraftSounds?.play("start");
                event.preventDefault();
            } else if (["done", "depleted"].includes(scene.mode)) {
                if (!requireDrone()) return;
                lastMode = null;
                scene.reset();
                campaignResultHandled = false;
                $("flight-campaign-debrief").hidden = true;
                lastPhase = null;
                scene.start();
                canvas.focus({ preventScroll: true });
                window.SkycraftSounds?.play("start");
                event.preventDefault();
            }
        }
        if (event.code === "KeyR" && !event.repeat && ["ready", "running", "paused", "done", "depleted"].includes(scene.mode)) {
            lastMode = null;
            scene.reset();
            campaignResultHandled = false;
            $("flight-campaign-debrief").hidden = true;
            lastPhase = null;
            canvas.focus({ preventScroll: true });
            window.SkycraftSounds?.play("close");
            event.preventDefault();
        }
    });

    // Компактные кнопки встроены в существующий МОБИЛЬНЫЙ D-pad.
    // Большая плавающая панель на экране полёта полностью удалена.
    document.querySelectorAll("[data-flight-action]").forEach((button) => {
        button.addEventListener("click", () => {
            switch (button.dataset.flightAction) {
                case "start":
                    if (scene.mode === "ready" && requireDrone()) scene.start();
                    else if (scene.mode === "paused") scene.pause();
                    break;
                case "motors":
                    if (scene.mode === "running") {
                        if (scene.flightPhase === "disarmed") scene.armMotors();
                        else scene.disarmMotors();
                    }
                    break;
                case "land":
                    if (scene.mode === "running") scene.land();
                    break;
                case "camera":
                    cameraToggle?.click();
                    break;
                case "help":
                    helpToggle?.click();
                    break;
            }
            button.blur();
        });
    });

    const joystickBindings = {
        move: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" },
        lift: { up: "Space", down: "ShiftLeft", left: "KeyQ", right: "KeyE" }
    };

    function clearJoystickKeys(binding) {
        if (!binding) return;
        Object.values(binding).forEach((key) => scene.keys.delete(key));
    }

    function updateJoystickKeys(binding, x, y) {
        clearJoystickKeys(binding);
        if (scene.mode !== "running") return;
        const airborne = ["flying", "takeoff", "landing"].includes(scene.flightPhase);
        if (!airborne && scene.flightPhase !== "armed") return;
        const threshold = 0.28;
        if (binding.up === "Space" && y < -threshold && scene.flightPhase === "armed") {
            scene.takeoff();
        }
        if (Math.abs(x) > threshold) scene.keys.add(x < 0 ? binding.left : binding.right);
        if (Math.abs(y) > threshold) {
            const targetKey = y < 0 ? binding.up : binding.down;
            if (targetKey !== "ShiftLeft" || airborne) scene.keys.add(targetKey);
        }
    }

    document.querySelectorAll("[data-flight-stick]").forEach((stick) => {
        const type = stick.dataset.flightStick;
        const binding = joystickBindings[type];
        const base = stick.querySelector('.flight-touch-stick-base');
        const thumb = stick.querySelector('.flight-touch-stick-thumb');
        if (!binding || !base || !thumb) return;

        let pointerId = null;
        const maxOffset = 28;

        const reset = () => {
            pointerId = null;
            stick.classList.remove('is-active');
            thumb.style.transform = 'translate(-50%, -50%)';
            clearJoystickKeys(binding);
        };

        const applyFromEvent = (event) => {
            const rect = base.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = event.clientX - cx;
            let dy = event.clientY - cy;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance > maxOffset) {
                dx = dx / distance * maxOffset;
                dy = dy / distance * maxOffset;
            }
            thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            updateJoystickKeys(binding, dx / maxOffset, dy / maxOffset);
        };

        stick.addEventListener('pointerdown', (event) => {
            if (pointerId !== null) return;
            event.preventDefault();
            pointerId = event.pointerId;
            stick.classList.add('is-active');
            base.setPointerCapture(pointerId);
            applyFromEvent(event);
        });
        base.addEventListener('pointermove', (event) => {
            if (event.pointerId !== pointerId) return;
            event.preventDefault();
            applyFromEvent(event);
        });
        const release = (event) => {
            if (event && event.pointerId !== pointerId) return;
            reset();
        };
        base.addEventListener('pointerup', release);
        base.addEventListener('pointercancel', release);
        base.addEventListener('lostpointercapture', release);
    });

    chooseLevel(requestedLevel);
    loadDroneForMission();
    if (!requestedLevel.tutorial && !requestedLevel.story && !selectedDrone) {
        window.location.replace("/Play?reason=no-drone");
        return;
    }
    // Карточка уровня запускает миссию сразу; при прямом входе видна подсказка Enter.
    if (new URLSearchParams(location.search).get("autostart") === "1") {
        scene.start();
        canvas.focus({ preventScroll: true });
    }

    // При выходе из активной симуляции спрашиваем подтверждение.
    $("flight-exit")?.addEventListener("click", (event) => {
        if (["running", "paused"].includes(scene.mode) &&
            !window.confirm("Выйти к выбору уровней? Текущий полёт будет прерван.")) {
            event.preventDefault();
        }
    });
    $("flight-pause-resume")?.addEventListener("click", () => {
        if (scene.mode === "paused") scene.pause();
        canvas.focus({ preventScroll: true });
    });
    $("flight-pause-restart")?.addEventListener("click", () => {
        scene.reset();
        scene.start();
        canvas.focus({ preventScroll: true });
    });
})();
