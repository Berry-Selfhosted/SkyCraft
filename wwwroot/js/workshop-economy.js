"use strict";

/*
 * Экономика одиночной демо-версии. Чертёж — бесплатная конфигурация,
 * а собранный дрон — физический экземпляр, на создание которого идут ресурсы.
 * Для сетевой игры операции должны выполняться на сервере с транзакциями БД.
 */
(function (root) {
    const KEYS = Object.freeze({
        credits: "skycraft.credits.v1",
        inventory: "skycraft.inventory.v1",
        blueprints: "skycraft.blueprints.v1",
        selection: "skycraft.selection.v1",
        drones: "skycraft.drones.v1",
        activeDrone: "skycraft.active-drone.v1",
        migrated: "skycraft.migrated-builds.v0.8",
        levelRewards: "skycraft.level-rewards.v1"
    });

    const STARTING_CREDITS = 420;
    const SELL_PERCENT = 60;
    const MAX_QUANTITY = 999;
    const MAX_BLUEPRINT_NAME = 48;
    const CATEGORIES = ["frame", "motor", "propeller", "battery", "electronics"];
    const REQUIRED = Object.freeze({ frame: 1, motor: 4, propeller: 4, battery: 1, electronics: 1 });

    function parse(raw, fallback) {
        if (raw === null) return fallback;
        try { return JSON.parse(raw); } catch { return fallback; }
    }

    function isRecord(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function asNonNegativeInteger(value, fallback) {
        return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
    }

    function sellingPrice(price) {
        return Math.floor(price * SELL_PERCENT / 100);
    }

    function validParts(parts) {
        return isRecord(parts) && CATEGORIES.every((category) =>
            typeof parts[category] === "string" && parts[category].length > 0);
    }

    function validName(name) {
        return typeof name === "string" && name.trim().length >= 1 &&
            name.trim().length <= MAX_BLUEPRINT_NAME;
    }

    function createId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function createStore(storage, onChange = () => {}) {
        function read(key, fallback) {
            try { return parse(storage.getItem(key), fallback); }
            catch { return fallback; }
        }

        function getCredits() {
            return asNonNegativeInteger(read(KEYS.credits, STARTING_CREDITS), STARTING_CREDITS);
        }

        function getLevelRewards() {
            const saved = read(KEYS.levelRewards, {});
            return isRecord(saved) ? saved : {};
        }

        // Только заранее известные ID уровней; один раз для каждого профиля.
        function claimLevelReward(levelId, amount) {
            const validId = typeof levelId === "string" &&
                /^(academy|hangar|training|canyon|story-(0[1-9]|1[0-2]))$/.test(levelId);
            if (!validId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 10000) {
                return { ok: false, error: "Некорректная награда за уровень." };
            }
            const claims = getLevelRewards();
            if (Object.hasOwn(claims, levelId)) {
                return { ok: true, claimed: false, amount: 0, credits: getCredits() };
            }
            const balance = getCredits();
            const updated = balance + amount;
            if (!Number.isSafeInteger(updated)) {
                return { ok: false, error: "Превышен максимальный размер баланса." };
            }
            if (!commit({
                [KEYS.credits]: updated,
                [KEYS.levelRewards]: {
                    ...claims,
                    [levelId]: { amount, claimedAt: new Date().toISOString() }
                }
            })) {
                return { ok: false, error: "Награду не удалось сохранить в браузере." };
            }
            // Обновляем верхний счётчик сразу, без перезагрузки страницы.
            if (typeof root.dispatchEvent === "function" && typeof root.Event === "function") {
                root.dispatchEvent(new root.Event("skycraft:credits-changed"));
            }
            return { ok: true, claimed: true, amount, credits: updated };
        }

        function getInventory() {
            const value = read(KEYS.inventory, {});
            return isRecord(value) ? value : {};
        }

        function getBlueprints() {
            const value = read(KEYS.blueprints, []);
            return Array.isArray(value) ? value : [];
        }

        function getDrones() {
            const value = read(KEYS.drones, []);
            return Array.isArray(value) ? value : [];
        }

        function getSelection(fallback) {
            const value = read(KEYS.selection, fallback);
            return isRecord(value) ? value : fallback;
        }

        function stock(part, inventory = getInventory()) {
            const saved = Object.hasOwn(inventory, part.id) ? inventory[part.id] : part.stock;
            return asNonNegativeInteger(saved, asNonNegativeInteger(part.stock, 0));
        }

        // Записываем связанные сущности вместе; при ошибке откатываем записи.
        function commit(changes, silent = false) {
            const previous = [];
            try {
                for (const [key, value] of Object.entries(changes)) {
                    previous.push([key, storage.getItem(key)]);
                    storage.setItem(key, JSON.stringify(value));
                }
            } catch {
                for (const [key, oldValue] of previous.reverse()) {
                    try {
                        if (oldValue === null) storage.removeItem(key);
                        else storage.setItem(key, oldValue);
                    } catch { /* Хранилище недоступно. */ }
                }
                return false;
            }
            if (!silent) onChange();
            return true;
        }

        // В версии 0.7 кнопка «Собрать» одновременно создавала чертёж и
        // расходовала ресурсы. Ранее оплаченные проекты становятся готовыми
        // дронами; чертежи остаются. Денег повторно не снимаем.
        function migrateLegacyBuilds() {
            if (read(KEYS.migrated, false) === true) return true;
            const drones = getDrones();
            const existingSourceIds = new Set(drones.map((drone) => drone.sourceBlueprintId));
            const migrated = getBlueprints()
                .filter((item) => isRecord(item) && validParts(item.parts) &&
                    typeof item.id === "string" && Number.isSafeInteger(item.price))
                .filter((item) => !existingSourceIds.has(item.id))
                .map((item) => ({
                    ...item,
                    id: createId("drone"),
                    sourceBlueprintId: item.id,
                    assembledAt: item.date || new Date().toISOString(),
                    name: item.name || "Ранее собранный дрон"
                }));
            const changes = {
                [KEYS.migrated]: true,
                [KEYS.drones]: [...drones, ...migrated]
            };
            return commit(changes, true);
        }

        function getActiveDrone() {
            const drones = getDrones().filter((drone) => drone && validParts(drone.parts));
            const selectedId = read(KEYS.activeDrone, null);
            return drones.find((drone) => drone.id === selectedId) || drones[0] || null;
        }

        function selectDrone(id) {
            if (!getDrones().some((drone) => drone && drone.id === id)) {
                return { ok: false, error: "Собранный дрон не найден." };
            }
            if (!commit({ [KEYS.activeDrone]: id })) {
                return { ok: false, error: "Не удалось сохранить выбор дрона." };
            }
            return { ok: true };
        }

        function trade(part, quantity, operation) {
            if (!part || !Number.isSafeInteger(part.price) || part.price < 0 ||
                !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY ||
                !["buy", "sell"].includes(operation)) {
                return { ok: false, error: "Укажи корректное количество деталей." };
            }

            const inventory = getInventory();
            const credits = getCredits();
            const currentStock = stock(part, inventory);
            const unitPrice = operation === "buy" ? part.price : sellingPrice(part.price);
            const total = unitPrice * quantity;
            if (!Number.isSafeInteger(total)) {
                return { ok: false, error: "Слишком большое количество деталей." };
            }
            if (operation === "buy" && credits < total) {
                return { ok: false, error: `Не хватает кредитов. Нужно ${total} CR, доступно ${credits} CR.` };
            }
            if (operation === "sell" && currentStock < quantity) {
                return { ok: false, error: `На складе только ${currentStock} шт. детали «${part.name}».` };
            }

            const newCredits = operation === "buy" ? credits - total : credits + total;
            const newStock = operation === "buy" ? currentStock + quantity : currentStock - quantity;
            if (!Number.isSafeInteger(newCredits) || !Number.isSafeInteger(newStock)) {
                return { ok: false, error: "Превышен допустимый размер баланса или запаса." };
            }

            if (!commit({
                [KEYS.credits]: newCredits,
                [KEYS.inventory]: { ...inventory, [part.id]: newStock }
            })) return { ok: false, error: "Не удалось сохранить операцию в браузере." };

            return { ok: true, total, credits: newCredits, stock: newStock };
        }

        // Снимок выбранной конфигурации и характеристик. Никаких списаний.
        function saveBlueprint(parts, stats, requestedName) {
            if (!validParts(parts)) return { ok: false, error: "Конфигурация неполная." };
            const all = getBlueprints();
            const name = requestedName === undefined
                ? `Чертёж №${all.length + 1}` : requestedName;
            if (!validName(name)) {
                return { ok: false, error: `Название должно содержать от 1 до ${MAX_BLUEPRINT_NAME} символов.` };
            }
            const blueprint = {
                id: createId("blueprint"), name: name.trim(),
                date: new Date().toISOString(), parts: { ...parts }, ...stats
            };
            if (!commit({ [KEYS.blueprints]: [...all, blueprint] })) {
                return { ok: false, error: "Не удалось сохранить чертёж." };
            }
            return { ok: true, blueprint };
        }

        // Физическая сборка. Детали и деньги тратятся ТОЛЬКО здесь.
        function assembleDrone(parts, catalog, stats, requestedName) {
            if (!validParts(parts) || !Array.isArray(catalog)) {
                return { ok: false, error: "Некорректная конфигурация дрона." };
            }
            const matched = CATEGORIES.map((category) =>
                catalog.find((part) => part.category === category && part.id === parts[category]));
            if (matched.some((part) => !part || !Number.isSafeInteger(part.price) || part.price < 0)) {
                return { ok: false, error: "Одна из деталей отсутствует в каталоге." };
            }
            const cost = matched.reduce((sum, part, index) =>
                sum + part.price * REQUIRED[CATEGORIES[index]], 0);
            if (!Number.isSafeInteger(cost)) return { ok: false, error: "Ошибка расчёта стоимости." };
            const inventory = getInventory();
            for (let i = 0; i < CATEGORIES.length; i++) {
                if (stock(matched[i], inventory) < REQUIRED[CATEGORIES[i]]) {
                    return { ok: false, error: `Недостаточно деталей «${matched[i].name}».` };
                }
            }
            const credits = getCredits();
            if (credits < cost) {
                return { ok: false, error: `Не хватает кредитов: нужно ${cost} CR, есть ${credits} CR.` };
            }
            const drones = getDrones();
            const name = requestedName === undefined
                ? `Дрон №${drones.length + 1}` : requestedName;
            if (!validName(name)) return { ok: false, error: "Некорректное название дрона." };
            const drone = {
                id: createId("drone"), name: name.trim(),
                assembledAt: new Date().toISOString(), parts: { ...parts },
                ...stats, price: cost
            };
            const updatedInventory = { ...inventory };
            matched.forEach((part, index) => {
                updatedInventory[part.id] = stock(part, inventory) - REQUIRED[CATEGORIES[index]];
            });
            if (!commit({
                [KEYS.credits]: credits - cost,
                [KEYS.inventory]: updatedInventory,
                [KEYS.drones]: [...drones, drone],
                [KEYS.activeDrone]: drone.id
            })) return { ok: false, error: "Не удалось сохранить собранный дрон." };
            return { ok: true, drone, cost };
        }

        function renameBlueprint(id, name) {
            if (!validName(name)) {
                return { ok: false, error: `Название должно содержать от 1 до ${MAX_BLUEPRINT_NAME} символов.` };
            }
            const all = getBlueprints();
            const index = all.findIndex((item) => item && item.id === id);
            if (index < 0) return { ok: false, error: "Чертёж не найден." };
            const updated = all.map((item, i) => i === index ? { ...item, name: name.trim() } : item);
            if (!commit({ [KEYS.blueprints]: updated })) {
                return { ok: false, error: "Не удалось сохранить новое имя." };
            }
            return { ok: true, name: name.trim() };
        }

        function deleteBlueprint(id) {
            const all = getBlueprints();
            const updated = all.filter((item) => !item || item.id !== id);
            if (updated.length === all.length) return { ok: false, error: "Чертёж не найден." };
            if (!commit({ [KEYS.blueprints]: updated })) {
                return { ok: false, error: "Не удалось удалить чертёж." };
            }
            // Чертежи бесплатные. Собранные дроны существуют независимо.
            return { ok: true };
        }

        migrateLegacyBuilds();
        return {
            getCredits, getInventory, getBlueprints, getDrones, getActiveDrone,
            getLevelRewards, claimLevelReward,
            getSelection, stock, commit, trade, saveBlueprint, assembleDrone,
            selectDrone, renameBlueprint, deleteBlueprint, migrateLegacyBuilds
        };
    }

    const api = {
        KEYS, STARTING_CREDITS, SELL_PERCENT, MAX_QUANTITY,
        MAX_BLUEPRINT_NAME, CATEGORIES, REQUIRED, sellingPrice, createStore
    };
    root.SkycraftEconomy = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
