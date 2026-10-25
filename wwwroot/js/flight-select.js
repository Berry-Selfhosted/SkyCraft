"use strict";

/* Экран выбора миссии. Никакой 3D-сцены и симуляции на этой странице нет. */
(function () {
    const cards = [...document.querySelectorAll("[data-choose-level]")];
    if (!cards.length || !window.SkycraftLevels || !window.SkycraftEconomy) return;

    const $ = id => document.getElementById(id);
    const store = window.SkycraftEconomy.createStore(window.SkycraftProfiles.storage);
    const levels = new Map(window.SkycraftLevels.map(level => [level.id, level]));
    const trainingKey = "skycraft.tutorial.completed.v1";
    const recordKey = "skycraft.flight.records.v1";
    const select = $("mission-drone-select");
    const launch = $("mission-launch-button");
    let selected = "academy";
    let trained = false;
    let records = {};
    try {
        trained = window.SkycraftProfiles.storage.getItem(trainingKey) === "true";
        const saved = JSON.parse(window.SkycraftProfiles.storage.getItem(recordKey) || "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) records = saved;
    } catch { /* Хранилище может быть недоступно. */ }

    const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    function notice(message) {
        $("mission-toast").textContent = message;
        $("mission-toast").classList.add("is-shown");
        window.setTimeout(() => $("mission-toast").classList.remove("is-shown"), 2800);
    }

    function availableDrones() {
        return store.getDrones().filter(drone => drone && drone.parts);
    }
    function selectedDrone() {
        return availableDrones().find(drone => drone.id === select.value) || null;
    }
    function renderDrones() {
        const drones = availableDrones();
        const activeId = store.getActiveDrone()?.id;
        select.replaceChildren();
        if (!drones.length) {
            const option = document.createElement("option");
            option.textContent = "Нет собранных дронов";
            option.value = "";
            select.append(option);
            select.disabled = true;
        } else {
            select.disabled = false;
            for (const drone of drones) {
                const option = document.createElement("option");
                option.textContent = drone.name || "Беспилотник";
                option.value = drone.id;
                select.append(option);
            }
            select.value = drones.some(drone => drone.id === activeId) ? activeId : drones[0].id;
            // Запоминаем выбранный собранный аппарат для физики следующей страницы.
            if (select.value !== activeId) store.selectDrone(select.value);
        }
        updateDroneDetails();
    }
    function updateDroneDetails() {
        if (selected === "academy") {
            select.disabled = true;
            $("mission-drone-detail").textContent = "Бесплатный учебный аппарат · 12 кг · 60 км/ч";
            return;
        }
        select.disabled = !availableDrones().length;
        const drone = selectedDrone();
        if (!drone) {
            $("mission-drone-detail").textContent = "Сначала собери дрон в конструкторе";
            return;
        }
        try {
            const specs = window.SkycraftDroneStats.calculate(drone.parts);
            $("mission-drone-detail").textContent = `${specs.weight} кг · ${specs.speed} км/ч · ${specs.time} мин · ${specs.range} м`;
        } catch {
            $("mission-drone-detail").textContent = "Комплектация дрона повреждена";
        }
    }
    function chooseLevel(levelId) {
        const level = levels.get(levelId);
        if (!level) return;
        selected = level.id;
        cards.forEach(card => {
            const on = card.dataset.chooseLevel === selected;
            card.classList.toggle("is-selected", on);
            card.setAttribute("aria-pressed", String(on));
        });
        $("mission-selected-title").textContent = level.name;
        $("mission-selected-description").textContent = level.description;
        if (level.tutorial) {
            launch.innerHTML = `${trained ? "↻ Повторить обучение" : "▶ Начать обучение"} <span>→</span>`;
            $("mission-launch-hint").textContent = "Учебный дрон предоставляется бесплатно";
            launch.disabled = false;
        } else if (!trained) {
            launch.innerHTML = `🔒 Пройти академию <span>→</span>`;
            $("mission-launch-hint").textContent = "Трасса откроется после обучения";
            launch.disabled = false; // Перенаправляет в академию.
        } else if (!availableDrones().length) {
            launch.innerHTML = `◈ Нужен готовый дрон <span>→</span>`;
            $("mission-launch-hint").textContent = "Собери аппарат в мастерской";
            launch.disabled = false; // Переход в мастерскую.
        } else {
            launch.innerHTML = `▶ Начать испытание <span>→</span>`;
            $("mission-launch-hint").textContent = "Время и рекорд сохраняются после посадки";
            launch.disabled = false;
        }
        const reward = window.SkycraftFlightRewards?.calculate(level);
        const earned = store.getLevelRewards()[level.id];
        const rewardLine = $("mission-launch-reward");
        if (rewardLine && reward) {
            rewardLine.textContent = earned
                ? `✓ Награда ${earned.amount} CR уже получена`
                : `✦ За первое прохождение: +${reward.total} CR`;
        }
        updateDroneDetails();
    }
    function renderProgress() {
        $("academy-state-badge").textContent = trained ? "ПРОЙДЕНО" : "НЕ ПРОЙДЕНО";
        $("academy-status").textContent = trained ? "Допуск получен" : "Обязательно";
        $("academy-best").textContent = Number.isFinite(records.academy) ? `Рекорд: ${time(records.academy)}` : "Рекорд: —";
        document.querySelectorAll("[data-record]").forEach(element => {
            element.textContent = Number.isFinite(records[element.dataset.record])
                ? `◷ ${time(records[element.dataset.record])}` : "Нет рекорда";
        });
        document.querySelectorAll(".mission-map-card").forEach(card => {
            card.classList.toggle("is-locked", !trained);
            card.querySelector(".mission-map-lock").textContent = trained ? "ДОСТУПНО" : "🔒 АКАДЕМИЯ";
        });
    }

    function launchCurrent() {
        if (selected !== "academy" && !trained) {
            chooseLevel("academy");
            notice("Сначала пройди академию пилота");
            return;
        }
        window.SkycraftMissionDronePicker.launch(selected, store, {
            tutorial: selected === "academy",
            name: levels.get(selected)?.name,
            preferredId: select.value
        });
    }
    cards.forEach(card => card.addEventListener("click", () => {
        chooseLevel(card.dataset.chooseLevel);
        window.SkycraftSounds?.play("select");
        launchCurrent();
    }));
    select.addEventListener("change", () => {
        if (select.value) {
            const result = store.selectDrone(select.value);
            if (!result.ok) notice(result.error || "Не удалось выбрать дрон");
        }
        updateDroneDetails();
    });
    launch.addEventListener("click", launchCurrent);

    renderDrones();
    renderProgress();
    const request = new URLSearchParams(window.location.search);
    const reason = request.get("reason");
    if (reason === "academy") notice("Для этой трассы требуется завершить академию пилота");
    if (reason === "no-drone") notice("Сначала собери собственный дрон в конструкторе");
    chooseLevel(levels.has(request.get("level")) ? request.get("level") : "academy");
})();
