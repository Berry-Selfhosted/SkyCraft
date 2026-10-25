"use strict";
                                                                         
(function (root) {
    function available(store) {
        return (store?.getDrones() || []).filter(d => d && d.id && d.parts &&
            ["frame", "motor", "propeller", "battery", "electronics"].every(k => typeof d.parts[k] === "string" && d.parts[k]));
    }
    function launch(levelId, store, options = {}) {
        const tutorial = options.tutorial === true;
        const drones = available(store);
        const backdrop = document.createElement("div");
        backdrop.className = "drone-picker-backdrop";
        backdrop.setAttribute("role", "presentation");
        const dialog = document.createElement("section");
        dialog.className = "drone-picker-dialog";
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "drone-picker-title");
        const heading = document.createElement("div");
        heading.className = "drone-picker-heading";
        const kicker = document.createElement("span");
        kicker.textContent = "SKYCRAFT / ПОДГОТОВКА К ВЫЛЕТУ";
        const title = document.createElement("h2");
        title.id = "drone-picker-title";
        title.textContent = "ВЫБЕРИ ДРОН";
        const description = document.createElement("p");
        description.textContent = options.name ? `Миссия: ${options.name}` : `Миссия: ${levelId}`;
        heading.append(kicker, title, description);
        const list = document.createElement("div");
        list.className = "drone-picker-list";
        list.setAttribute("role", "radiogroup");
        list.setAttribute("aria-label", "Доступные дроны");
        let selected = drones.some(d => d.id === options.preferredId) ? options.preferredId :
            drones.some(d => d.id === store?.getActiveDrone()?.id) ? store.getActiveDrone().id :
                drones[0]?.id || (tutorial ? "academy-loaner" : null);
        const choices = tutorial ? [...drones, { id: "academy-loaner", name: "Учебный дрон", loaner: true }] : drones;
        function update() {
            for (const card of list.children) {
                const active = card.dataset.droneId === selected;
                card.classList.toggle("is-selected", active);
                card.setAttribute("aria-checked", String(active));
            }
        }
        for (const drone of choices) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "drone-picker-card";
            card.dataset.droneId = drone.id;
            card.setAttribute("role", "radio");
            const glyph = document.createElement("span"); glyph.className = "drone-picker-glyph"; glyph.textContent = "✥";
            const info = document.createElement("span"); info.className = "drone-picker-info";
            const name = document.createElement("strong"); name.textContent = drone.name || "Собранный дрон";
            const detail = document.createElement("small");
            if (drone.loaner) detail.textContent = "Для академии · стандартная модель";
            else {
                try {
                    const s = root.SkycraftDroneStats.calculate(drone.parts);
                    detail.textContent = `${s.weight} кг · ${s.speed} км/ч · ${s.time} мин · ${s.range} м`;
                } catch { detail.textContent = "Собранный дрон из ангара"; }
            }
            info.append(name, detail);
            const mark = document.createElement("span"); mark.className = "drone-picker-check"; mark.textContent = "✓";
            card.append(glyph, info, mark);
            card.addEventListener("click", () => { selected = drone.id; update(); });
            list.append(card);
        }
        update();
        if (!choices.length) {
            const empty = document.createElement("p");
            empty.className = "drone-picker-empty";
            empty.textContent = "В разделе «Мои дроны» пока нет собранных аппаратов. Собери дрон перед вылетом.";
            list.append(empty);
        }
        const actions = document.createElement("div"); actions.className = "drone-picker-actions";
        const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "drone-picker-cancel"; cancel.textContent = "← Отмена";
        const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "drone-picker-go";
        confirm.textContent = choices.length ? "▶ НАЧАТЬ ВЫЛЕТ" : "↗ СОБРАТЬ ДРОН";
        const close = () => { document.removeEventListener("keydown", onKey); backdrop.remove(); };
        const onKey = (event) => { if (event.key === "Escape") close(); };
        cancel.addEventListener("click", close);
        backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
        confirm.addEventListener("click", () => {
            if (!choices.length) { root.location.assign("/Constructor"); return; }
            if (!selected) return;
            if (selected !== "academy-loaner") {
                const result = store.selectDrone(selected);
                if (!result.ok) { description.textContent = result.error || "Не удалось выбрать дрон"; return; }
            }
            root.location.assign(`/Flight?level=${encodeURIComponent(levelId)}&drone=${encodeURIComponent(selected)}&autostart=1`);
        });
        actions.append(cancel, confirm);
        dialog.append(heading, list, actions);
        backdrop.append(dialog);
        document.body.append(backdrop);
        document.addEventListener("keydown", onKey);
        (list.querySelector(".is-selected") || confirm).focus();
    }
    root.SkycraftMissionDronePicker = { launch, available };
})(window);
