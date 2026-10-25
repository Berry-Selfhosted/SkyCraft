"use strict";
  
                                        
                                                                          
                                                                          
   
(function (root, factory) {
    const api = factory(root?.localStorage, root?.sessionStorage);
    if (typeof module === "object" && module.exports) module.exports = { createProfileManager: factory };
    if (root) root.SkycraftProfiles = api;
})(typeof window !== "undefined" ? window : null, function createProfileManager(rawLocal, rawSession) {
    const REGISTRY_KEY = "skycraft.profiles.registry.v1";
    const ACTIVE_KEY = "skycraft.profiles.active.v1";
    const MIGRATED_KEY = "skycraft.profiles.legacyMigrated.v1";
    const DATA_PREFIX = "skycraft.profile.v1.";
    const NAME_PATTERN = /^[\p{L}\p{N}_-][\p{L}\p{N}_ -]{0,22}[\p{L}\p{N}_-]$/u;

    function normalizedName(name) {
        const value = String(name || "").normalize("NFKC").trim();
        if (!NAME_PATTERN.test(value)) throw new Error("Логин: 2–24 символа, буквы, цифры, пробел, _ или -. Пробелы допустимы только внутри логина.");
        return value;
    }
    function nameId(name) { return normalizedName(name).toLocaleLowerCase(); }
    function list() {
        try {
            const value = JSON.parse(rawLocal.getItem(REGISTRY_KEY) || "[]");
            return Array.isArray(value) ? value.filter(profile => profile &&
                typeof profile.id === "string" && /^[a-f0-9-]{24,64}$/.test(profile.id) &&
                typeof profile.name === "string" && NAME_PATTERN.test(profile.name)) : [];
        } catch { return []; }
    }
    function active() {
        try {
            const id = rawSession.getItem(ACTIVE_KEY);
            return list().find(profile => profile.id === id) || null;
        } catch { return null; }
    }
    function key(id, itemKey) {
        if (typeof itemKey !== "string" || !itemKey.startsWith("skycraft.") ||
            itemKey.startsWith("skycraft.profile.") || itemKey.startsWith("skycraft.profiles.")) {
            throw new Error("Недопустимый ключ профиля");
        }
        return `${DATA_PREFIX}${id}.${itemKey}`;
    }
    function dataKey(itemKey) {
        const profile = active();
        if (!profile) throw new Error("Сначала войдите в игровой профиль");
        return key(profile.id, itemKey);
    }
    const storage = Object.freeze({
        getItem(itemKey) { return rawLocal.getItem(dataKey(itemKey)); },
        setItem(itemKey, value) { rawLocal.setItem(dataKey(itemKey), String(value)); },
        removeItem(itemKey) { rawLocal.removeItem(dataKey(itemKey)); }
    });
    function randomId() {
        if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
        const bytes = new Uint8Array(16);
        if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
        else throw new Error("Нужен браузер с безопасным генератором случайных чисел");
        return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    function migrationCandidates() {
        const keys = [];
        for (let i = 0; i < rawLocal.length; i++) {
            const item = rawLocal.key(i);
            if (item?.startsWith("skycraft.") && !item.startsWith("skycraft.profile.") &&
                !item.startsWith("skycraft.profiles.")) keys.push(item);
        }
        return keys;
    }
                                                                           
                                                                    
    function importLegacy(profileId) {
        if (rawLocal.getItem(MIGRATED_KEY) === "1") return 0;
        const candidates = migrationCandidates();
        for (const item of candidates) {
            const value = rawLocal.getItem(item);
            if (value !== null) rawLocal.setItem(key(profileId, item), value);
        }
        for (const item of candidates) rawLocal.removeItem(item);
        rawLocal.setItem(MIGRATED_KEY, "1");
        return candidates.length;
    }
    function register(username) {
        const name = normalizedName(username);
        const current = list();
        if (current.some(profile => nameId(profile.name) === nameId(name))) {
            throw new Error("Такой логин уже существует. Выберите «Войти».");
        }
        if (current.length >= 30) throw new Error("Достигнут предел локальных профилей (30).");
        const profile = { id: randomId(), name, createdAt: new Date().toISOString() };
        rawLocal.setItem(REGISTRY_KEY, JSON.stringify([...current, profile]));
        let migrated = 0;
        try { if (current.length === 0) migrated = importLegacy(profile.id); }
        catch (error) {
                                                                              
            rawLocal.setItem(REGISTRY_KEY, JSON.stringify(current));
            throw new Error(`Не удалось перенести сохранения: ${error.message}`);
        }
        rawSession.setItem(ACTIVE_KEY, profile.id);
        return { profile, migrated };
    }
    function login(username) {
        const name = normalizedName(username);
        const profile = list().find(item => nameId(item.name) === nameId(name));
        if (!profile) throw new Error("Профиль не найден. Сначала зарегистрируйте логин.");
        rawSession.setItem(ACTIVE_KEY, profile.id);
        return profile;
    }
    function logout() { rawSession.removeItem(ACTIVE_KEY); }
    function redirectTarget(candidate) {
                                                                                
        return typeof candidate === "string" && /^\/(?!\/|\\)[^\\\x00-\x1f]*$/.test(candidate)
            && !/^\/Login(?:[/?#]|$)/i.test(candidate) ? candidate : "/";
    }
    function requireLogin() {
        if (active()) return true;
        if (typeof window !== "undefined") {
            const requested = window.location.pathname + window.location.search + window.location.hash;
            window.location.replace(`/Login?returnUrl=${encodeURIComponent(redirectTarget(requested))}`);
        }
        return false;
    }
    return Object.freeze({ list, active, storage, register, login, logout, requireLogin,
        redirectTarget, REGISTRY_KEY, MIGRATED_KEY, DATA_PREFIX });
});
