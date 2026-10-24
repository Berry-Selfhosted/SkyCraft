"use strict";

/*
 * Логика мастерской SKYCRAFT. Каталог заполняет серверный Razor-шаблон,
 * а демо хранит баланс, остатки, чертежи и собранные дроны в localStorage.
 * Для сетевой игры эти операции необходимо перенести на сервер.
 */
(function () {
    const workshopPage = document.querySelector("[data-workshop-page]");
    if (!workshopPage) {
        return;
    }

    const economy = window.SkycraftEconomy;
    if (!economy) {
        console.error("SKYCRAFT: не загружен workshop-economy.js");
        return;
    }
    const store = economy.createStore(window.SkycraftProfiles.storage, () => {
        window.dispatchEvent(new Event("skycraft:credits-changed"));
    });

    const categories = ["frame", "motor", "propeller", "battery", "electronics"];
    const requiredQuantity = { frame: 1, motor: 4, propeller: 4, battery: 1, electronics: 1 };
    const defaults = {
        frame: "frame-light", motor: "motor-base", propeller: "prop-base",
        battery: "battery-base", electronics: "chip-base"
    };

    const page = workshopPage.dataset.workshopPage;
    const getCredits = store.getCredits;
    const getInventory = store.getInventory;
    const getBlueprints = store.getBlueprints;
    const getDrones = store.getDrones;
    const remainingStock = store.stock;

    function notify(message, type = "success", sound = null) {
        window.SkycraftSounds?.play(sound || (type === "error" ? "error" : "success"));
        const notice = document.getElementById("economy-message") || document.getElementById("blueprint-message");
        if (!notice) return;
        notice.textContent = message;
        notice.dataset.state = type;
    }

    // Старые сборки содержат устаревшие сохранённые характеристики.
    // Пересчитываем их из набора деталей без изменения цены уже собранного дрона.
    function resolveSavedSpecs(record) {
        try { return window.SkycraftDroneStats.calculate(record.parts); }
        catch { return record; }
    }

    function updateEconomyCredits() {
        document.querySelectorAll("[data-economy-credits]").forEach((label) => {
            label.textContent = String(getCredits());
        });
    }

    function cardPart(card, idAttribute) {
        return {
            id: card.dataset[idAttribute],
            name: card.dataset.partName,
            price: Number(card.dataset.partPrice),
            stock: Number(card.dataset.initialStock)
        };
    }

    function readQuantity(input) {
        const quantity = Number(input.value);
        return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= economy.MAX_QUANTITY
            ? quantity : null;
    }

    if (page === "warehouse") {
        const cards = [...document.querySelectorAll("[data-warehouse-id]")];
        function renderWarehouse() {
            const inventory = getInventory();
            updateEconomyCredits();
            for (const card of cards) {
                const part = cardPart(card, "warehouseId");
                const available = remainingStock(part, inventory);
                const input = card.querySelector("[data-quantity]");
                card.querySelector("[data-warehouse-count]").textContent = String(available);
                input.max = String(Math.min(available, economy.MAX_QUANTITY));
                if (Number(input.value) > available) input.value = String(Math.max(1, available));
                card.querySelector("[data-sell]").disabled = available === 0;
            }
        }

        cards.forEach((card) => {
            card.querySelector("[data-sell]").addEventListener("click", () => {
                const part = cardPart(card, "warehouseId");
                const quantity = readQuantity(card.querySelector("[data-quantity]"));
                const result = store.trade(part, quantity, "sell");
                if (!result.ok) { notify(result.error, "error"); return; }
                notify(`Продано: ${part.name} × ${quantity}. Получено ${result.total} CR.`, "success", "sell");
                renderWarehouse();
            });
        });

        document.getElementById("reset-workshop-demo")?.addEventListener("click", () => {
            if (!window.confirm("Сбросить кредиты, склад, чертежи и ВСЕ собранные дроны SKYCRAFT?")) return;
            const saved = store.commit({
                [economy.KEYS.credits]: economy.STARTING_CREDITS,
                [economy.KEYS.inventory]: {},
                [economy.KEYS.blueprints]: [],
                [economy.KEYS.drones]: [],
                [economy.KEYS.activeDrone]: null,
                [economy.KEYS.migrated]: true,
                [economy.KEYS.selection]: defaults
            });
            if (!saved) { notify("Не удалось сбросить данные браузера.", "error"); return; }
            notify("Демо-прогресс сброшен.");
            renderWarehouse();
        });

        window.addEventListener("storage", renderWarehouse);
        renderWarehouse();
        return;
    }

    if (page === "shop") {
        const cards = [...document.querySelectorAll("[data-shop-id]")];
        const filters = [...document.querySelectorAll("[data-shop-filter]")];
        let activeFilter = "all";

        function renderShop() {
            const inventory = getInventory();
            updateEconomyCredits();
            for (const card of cards) {
                const part = cardPart(card, "shopId");
                card.hidden = activeFilter !== "all" && card.dataset.category !== activeFilter;
                card.querySelector("[data-stock-count]").textContent = String(remainingStock(part, inventory));
                updateBuyPrice(card);
            }
        }

        function updateBuyPrice(card) {
            const part = cardPart(card, "shopId");
            const quantity = readQuantity(card.querySelector("[data-quantity]"));
            card.querySelector("[data-buy]").textContent = quantity
                ? `Купить · ${part.price * quantity} CR` : "Укажи количество";
        }

        cards.forEach((card) => {
            card.querySelector("[data-quantity]").addEventListener("input", () => updateBuyPrice(card));
            card.querySelector("[data-buy]").addEventListener("click", () => {
                const part = cardPart(card, "shopId");
                const quantity = readQuantity(card.querySelector("[data-quantity]"));
                const result = store.trade(part, quantity, "buy");
                if (!result.ok) { notify(result.error, "error"); return; }
                notify(`Куплено: ${part.name} × ${quantity}. Списано ${result.total} CR.`, "success", "buy");
                renderShop();
            });
        });
        filters.forEach((filter) => {
            filter.addEventListener("click", () => {
                activeFilter = filter.dataset.shopFilter;
                filters.forEach((button) => {
                    const active = button === filter;
                    button.classList.toggle("is-active", active);
                    button.setAttribute("aria-pressed", String(active));
                });
                renderShop();
            });
        });
        window.addEventListener("storage", renderShop);
        renderShop();
        return;
    }

    if (page === "hangar") {
        const grid = document.getElementById("hangar-grid");
        const count = document.getElementById("hangar-count");

        function renderHangar() {
            const drones = getDrones().filter((drone) => drone && drone.parts);
            const active = store.getActiveDrone();
            count.textContent = String(drones.length);
            grid.replaceChildren();
            if (!drones.length) {
                const empty = document.createElement("div");
                empty.className = "empty-blueprints";
                empty.textContent = "Готовых дронов пока нет. В «Крафте» выбери детали и нажми «Собрать». Чертежи не расходуют ресурсы.";
                grid.append(empty);
                return;
            }
            for (const drone of [...drones].reverse()) {
                const card = document.createElement("article");
                card.className = "blueprint-card";
                const caption = document.createElement("span");
                caption.className = "stage-eyebrow";
                caption.textContent = active?.id === drone.id ? "● ВЫБРАН ДЛЯ ПОЛЁТА" : "ГОТОВ К ПОЛЁТУ";
                const title = document.createElement("h2");
                title.textContent = drone.name;
                const stats = document.createElement("p");
                const specs = resolveSavedSpecs(drone);
                stats.textContent = `${specs.weight ?? "?"} кг · ${specs.speed ?? "?"} км/ч · ${specs.range ?? "?"} м`;
                const date = document.createElement("small");
                const value = new Date(drone.assembledAt || drone.date);
                date.textContent = !Number.isNaN(value.getTime()) ? `Собран: ${value.toLocaleString("ru-RU")}` : "";
                const actions = document.createElement("div");
                actions.className = "blueprint-actions";
                const choose = document.createElement("button");
                choose.type = "button";
                choose.className = "blueprint-edit";
                choose.disabled = active?.id === drone.id;
                choose.textContent = active?.id === drone.id ? "Выбран" : "Выбрать";
                choose.addEventListener("click", () => {
                    const result = store.selectDrone(drone.id);
                    if (!result.ok) return notify(result.error, "error");
                    notify(`«${drone.name}» выбран для полёта.`);
                    renderHangar();
                });
                const fly = document.createElement("a");
                fly.className = "overview-card-link";
                fly.href = "/Play";
                fly.textContent = "Летать ↗";
                fly.addEventListener("click", () => store.selectDrone(drone.id));
                actions.append(choose, fly);
                card.append(caption, title, stats, date, actions);
                grid.append(card);
            }
        }
        window.addEventListener("storage", renderHangar);
        renderHangar();
        return;
    }

    if (page === "blueprints") {
        const container = document.getElementById("blueprint-grid");
        const count = document.getElementById("blueprint-count");

        function actionButton(label, cssClass, handler) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = cssClass;
            button.textContent = label;
            button.addEventListener("click", handler);
            return button;
        }

        function makeBlueprintCard(blueprint) {
            const card = document.createElement("article");
            card.className = "blueprint-card";

            const label = document.createElement("span");
            label.className = "stage-eyebrow";
            label.textContent = "ЧЕРТЁЖ · КОНФИГУРАЦИЯ";
            const title = document.createElement("h2");
            title.textContent = blueprint.name || "Беспилотник";
            const stats = document.createElement("p");
            const specs = resolveSavedSpecs(blueprint);
            stats.textContent = `${specs.weight ?? "?"} кг · ${specs.speed ?? "?"} км/ч · ${specs.range ?? "?"} м`;
            const price = document.createElement("p");
            price.textContent = `Создание чертежа бесплатно · Сборка: ${blueprint.price ?? 0} CR`;
            const date = document.createElement("small");
            const parsedDate = blueprint.date ? new Date(blueprint.date) : null;
            date.textContent = parsedDate && !Number.isNaN(parsedDate.getTime())
                ? parsedDate.toLocaleString("ru-RU") : "";

            const actions = document.createElement("div");
            actions.className = "blueprint-actions";
            const rename = actionButton("✎ Переименовать", "blueprint-edit", () => {
                if (card.querySelector(".blueprint-rename-form")) return;
                actions.hidden = true;
                const form = document.createElement("form");
                form.className = "blueprint-rename-form";
                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = economy.MAX_BLUEPRINT_NAME;
                input.required = true;
                input.setAttribute("aria-label", "Новое название чертежа");
                input.value = title.textContent;
                const save = document.createElement("button");
                save.type = "submit";
                save.textContent = "Сохранить";
                const cancel = actionButton("Отмена", "blueprint-cancel", () => {
                    form.remove();
                    actions.hidden = false;
                });
                form.append(input, save, cancel);
                form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    const result = store.renameBlueprint(blueprint.id, input.value);
                    if (!result.ok) { notify(result.error, "error"); input.focus(); return; }
                    notify(`Чертёж переименован: «${result.name}».`);
                    renderBlueprints();
                });
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") cancel.click();
                });
                actions.after(form);
                input.focus();
                input.select();
            });
            const remove = actionButton("Удалить", "blueprint-delete", () => {
                const name = blueprint.name || "Беспилотник";
                if (!window.confirm(`Удалить чертёж «${name}»? Это бесплатная конфигурация; готовые дроны не будут затронуты.`)) return;
                const result = store.deleteBlueprint(blueprint.id);
                if (!result.ok) { notify(result.error, "error"); return; }
                notify(`Чертёж «${name}» удалён.`);
                renderBlueprints();
            });
            const load = document.createElement("a");
            load.className = "overview-card-link";
            load.href = `/Constructor?blueprint=${encodeURIComponent(blueprint.id)}`;
            load.textContent = "Открыть в крафте ↗";
            actions.append(load, rename, remove);
            card.append(label, title, stats, price, date, actions);
            return card;
        }

        function renderBlueprints() {
            const blueprints = getBlueprints().filter((item) => item && typeof item === "object");
            container.replaceChildren();
            count.textContent = String(blueprints.length);
            if (!blueprints.length) {
                const empty = document.createElement("div");
                empty.className = "empty-blueprints";
                empty.textContent = "Пока нет чертежей. Перейди в «Крафт» и нажми «Создать чертёж» — это бесплатно.";
                container.append(empty);
                return;
            }
            for (const blueprint of [...blueprints].reverse()) container.append(makeBlueprintCard(blueprint));
        }
        window.addEventListener("storage", renderBlueprints);
        renderBlueprints();
        return;
    }

    if (workshopPage.dataset.workshopPage !== "craft") {
        return;
    }

    // data-* генерируются из C# каталога DroneCatalog.
    const parts = [...document.querySelectorAll(".part-card")].map((button) => ({
        button,
        id: button.dataset.partId,
        category: button.dataset.category,
        name: button.dataset.name,
        description: button.dataset.description,
        weight: Number(button.dataset.weight),
        speed: Number(button.dataset.speed),
        time: Number(button.dataset.flightTime),
        range: Number(button.dataset.range),
        price: Number(button.dataset.price),
        stock: Number(button.dataset.stock)
    }));
    const partsById = new Map(parts.map((part) => [part.id, part]));

    const previouslySelected = store.getSelection(defaults);
    const selected = {};
    for (const category of categories) {
        const id = previouslySelected && previouslySelected[category];
        selected[category] = partsById.has(id) && partsById.get(id).category === category
            ? id
            : defaults[category];
    }

    // Загрузка бесплатного чертежа обратно в редактор.
    const blueprintId = new URLSearchParams(window.location.search).get("blueprint");
    const loadedBlueprint = blueprintId
        ? getBlueprints().find((blueprint) => blueprint && blueprint.id === blueprintId)
        : null;
    if (loadedBlueprint?.parts) {
        for (const category of categories) {
            const id = loadedBlueprint.parts[category];
            if (partsById.has(id) && partsById.get(id).category === category) {
                selected[category] = id;
            }
        }
        store.commit({ [economy.KEYS.selection]: selected });
    }

    const partList = document.getElementById("available-parts");
    const categoryButtons = [...document.querySelectorAll(".category-button")];
    const slots = [...document.querySelectorAll("[data-slot]")];
    const assembleButton = document.getElementById("assemble-button");
    const blueprintButton = document.getElementById("create-blueprint-button");
    const message = document.getElementById("assembly-message");
    const scene = typeof window.SkycraftDroneScene === "function"
        ? new window.SkycraftDroneScene(document.getElementById("drone-canvas"))
        : null;

    let activeCategory = "frame";

    // Не дублируем формулы: полёт пересчитывает ровно те же характеристики.
    function currentStats() {
        return window.SkycraftDroneStats.calculate(selected, parts);
    }

    function isStockEnough(inventory) {
        return categories.every((category) => {
            const part = partsById.get(selected[category]);
            return remainingStock(part, inventory) >= requiredQuantity[category];
        });
    }

    function clearMessage() {
        message.textContent = "";
        message.classList.remove("is-success", "is-error");
    }

    function showMessage(text, status, audible = true) {
        if (audible) window.SkycraftSounds?.play(status === "is-error" ? "error" : "success");
        message.textContent = text;
        message.classList.remove("is-success", "is-error");
        if (status) {
            message.classList.add(status);
        }
    }

    function render() {
        const stats = currentStats();
        const inventory = getInventory();
        const credits = getCredits();
        const availableCategories = categories.filter(category => {
            const part = partsById.get(selected[category]);
            return remainingStock(part, inventory) >= requiredQuantity[category];
        }).length;
        const stocked = availableCategories === categories.length;
        const affordable = credits >= stats.price;
        const chosenPart = partsById.get(selected[activeCategory]);
        const standard = categories.every((category) => selected[category] === defaults[category]);

        for (const button of categoryButtons) {
            const isActive = button.dataset.category === activeCategory;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        }

        let visibleParts = 0;
        for (const part of parts) {
            const isVisible = part.category === activeCategory;
            const isSelected = selected[part.category] === part.id;
            const stock = remainingStock(part, inventory);
            part.button.hidden = !isVisible;
            part.button.classList.toggle("is-selected", isSelected);
            part.button.classList.toggle("is-out-of-stock", stock < requiredQuantity[part.category]);
            part.button.setAttribute("aria-pressed", String(isSelected));
            part.button.querySelector("[data-stock-display]").textContent = `x${stock}`;
            visibleParts += Number(isVisible);
        }

        document.getElementById("part-category-count").textContent = `${visibleParts} варианта`;
        document.getElementById("stat-weight").textContent = `${String(stats.weight).replace(".", ",")} кг`;
        document.getElementById("stat-speed").textContent = `${stats.speed} км/ч`;
        document.getElementById("stat-flight-time").textContent = `${stats.time} мин`;
        document.getElementById("stat-range").textContent = `${stats.range} м`;
        document.getElementById("requirement-parts").textContent = `${availableCategories} / 5`;
        document.getElementById("requirement-credits").textContent = `${credits} / ${stats.price}`;
        document.getElementById("requirement-parts").className = stocked ? "requirement-good" : "requirement-bad";
        document.getElementById("requirement-credits").className = affordable ? "requirement-good" : "requirement-bad";
        document.getElementById("drone-build-title").textContent = standard
            ? "Базовый беспилотник"
            : "Модифицированный беспилотник";
        document.getElementById("selected-part-name").textContent = chosenPart.name;
        document.getElementById("selected-part-description").textContent = chosenPart.description;

        slots.forEach((slot) => {
            slot.classList.toggle("is-active", slot.dataset.slot === activeCategory);
            const part = partsById.get(selected[slot.dataset.slot]);
            slot.title = part.name;
        });

        assembleButton.disabled = !stocked || !affordable;
        assembleButton.title = !stocked ? "Не хватает деталей на складе"
            : !affordable ? "Недостаточно кредитов" : "Собрать дрон";
        scene?.setConfiguration(selected);
    }

    function changeCategory(category) {
        activeCategory = category;
        clearMessage();
        render();
    }

    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => changeCategory(button.dataset.category));
    });

    slots.forEach((button) => {
        button.addEventListener("click", () => {
            changeCategory(button.dataset.slot);
            if (window.matchMedia("(max-width: 720px)").matches) {
                partList.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    });

    parts.forEach((part) => {
        part.button.addEventListener("click", () => {
            selected[part.category] = part.id;
            store.commit({ [economy.KEYS.selection]: selected });
            clearMessage();
            render();
        });
    });

    blueprintButton.addEventListener("click", () => {
        const result = store.saveBlueprint(selected, currentStats());
        if (!result.ok) return showMessage(result.error, "is-error");
        showMessage(`«${result.blueprint.name}» сохранён бесплатно! Найдёшь его во вкладке «Чертежи».`, "is-success");
    });

    assembleButton.addEventListener("click", () => {
        const result = store.assembleDrone(selected, parts, currentStats());
        if (!result.ok) {
            showMessage(result.error, "is-error");
            render();
            return;
        }
        render();
        window.SkycraftSounds?.play("assemble");
        showMessage(`${result.drone.name} собран! Списано ${result.cost} CR и детали. Он доступен во вкладке «Мои дроны» и в полёте.`, "is-success", false);
    });

    document.getElementById("view-reset")?.addEventListener("click", () => scene?.resetView());
    document.getElementById("view-zoom-in")?.addEventListener("click", () => scene?.zoom(-0.8));
    document.getElementById("view-zoom-out")?.addEventListener("click", () => scene?.zoom(0.8));

    render();
    if (loadedBlueprint) {
        showMessage(`Загружен чертёж «${loadedBlueprint.name}». Изменения пока не сохраняются в нём.`, "is-success", false);
    }
})();
