"use strict";

  
                                     
                                                         
                                                                                 
                                                                          
   
(function () {
    const ENABLED_KEY = "skycraft.soundEnabled";
    const VOLUME_KEY = "skycraft.soundVolume.v1";
    const DIRECTORY = "/assets/audio/";
    const NAMES = [
        "click", "hover", "select", "toggle-on", "toggle-off",
        "open", "close", "success", "error", "buy", "sell",
        "assemble", "start", "checkpoint", "complete"
    ];
    const files = new Set(NAMES);
    const pools = new Map();
    const lastPlayed = new Map();
    const MAX_INSTANCES = 3;

    function loadValue(key) {
        try { return window.SkycraftProfiles.storage.getItem(key); }
        catch { return null; }
    }

    function saveValue(key, value) {
        try { window.SkycraftProfiles.storage.setItem(key, String(value)); }
        catch {                                                                }
    }

    function validVolume(value) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.55;
    }

    let enabled = loadValue(ENABLED_KEY) !== "false";
    let volume = loadValue(VOLUME_KEY) === null ? 0.55 : validVolume(loadValue(VOLUME_KEY));

    function prepare(name) {
        if (!pools.has(name)) {
            const audio = new Audio(`${DIRECTORY}${name}.wav`);
            audio.preload = "auto";
            pools.set(name, [audio]);
        }
        return pools.get(name);
    }

    function play(name = "click", options = {}) {
        if ((!enabled && !options.force) || volume <= 0 || !files.has(name)) return false;

        const now = performance.now();
                                                                                      
        const cooldown = { hover: 95, error: 260, checkpoint: 160 }[name] ?? 24;
        if (now - (lastPlayed.get(name) ?? -Infinity) < cooldown) return false;
        lastPlayed.set(name, now);

        try {
            const pool = prepare(name);
            let player = pool.find((audio) => audio.paused || audio.ended);
            if (!player && pool.length < MAX_INSTANCES) {
                player = new Audio(`${DIRECTORY}${name}.wav`);
                player.preload = "auto";
                pool.push(player);
            }
            if (!player) player = pool[0];
            player.pause();
            player.currentTime = 0;
            player.volume = volume;
                                                                                   
            const request = player.play();
            request?.catch?.(() => {});
            return true;
        } catch {
            return false;                                         
        }
    }

    function setEnabled(value) {
        enabled = Boolean(value);
        saveValue(ENABLED_KEY, enabled);
        if (!enabled) {
            for (const pool of pools.values()) {
                pool.forEach((player) => player.pause());
            }
        }
        return enabled;
    }

    function setVolume(value) {
        volume = validVolume(value);
        saveValue(VOLUME_KEY, volume);
        for (const pool of pools.values()) {
            pool.forEach((player) => { player.volume = volume; });
        }
        return volume;
    }

    const api = {
        play,
        setEnabled,
        setVolume,
        get enabled() { return enabled; },
        get volume() { return volume; },
        sounds: Object.freeze([...NAMES])
    };
    window.SkycraftSounds = api;

                                                                                       
    window.addEventListener("skycraft:ui-sound", (event) => {
        if (typeof event.detail?.kind === "string") play(event.detail.kind);
    });

    const externallyHandled = [
        "#sound-button", "[data-open-settings]", "#close-settings",
        "#save-settings", "#balance-button", "#user-button",
        "[data-sound-preview]", "[data-buy]", "[data-sell]",
        "#create-blueprint-button", "#assemble-button", "#reset-workshop-demo",
        ".blueprint-delete", ".blueprint-rename-form button[type='submit']",
        "#flight-start", "#flight-pause", "#flight-reset", "#flight-retry",
        "#flight-help-toggle", "#flight-help-close",
        "[data-flight-key]"
    ].join(",");

    function getControl(event) {
        return event.target instanceof Element
            ? event.target.closest("button, a[href]")
            : null;
    }

    document.addEventListener("click", (event) => {
        const control = getControl(event);
        if (!control || control.matches(":disabled") || control.closest(externallyHandled)) return;
        if (control.matches("[aria-pressed], [data-slot], .part-card, .flight-level-card")) {
            play("select");
        } else if (control.matches(".workshop-nav-link, .workshop-back, .overview-card-link")) {
            play("select");
        } else {
            play("click");
        }
    });

    document.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        if (target.id === "setting-sound" || target.id === "setting-sound-volume") return;
        if (target instanceof HTMLInputElement && target.type === "checkbox") {
            play(target.checked ? "toggle-on" : "toggle-off");
        } else if (target.matches("select, input[type='number']")) {
            play("select");
        }
    });

                                                                                
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
        document.addEventListener("pointerover", (event) => {
            const control = getControl(event);
            if (!control || control.matches(":disabled")) return;
            if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
            play("hover");
        });
    }

    window.addEventListener("storage", (event) => {
        if (event.key === ENABLED_KEY || event.key === null) {
            enabled = loadValue(ENABLED_KEY) !== "false";
        }
        if (event.key === VOLUME_KEY || event.key === null) {
            volume = loadValue(VOLUME_KEY) === null ? 0.55 : validVolume(loadValue(VOLUME_KEY));
        }
    });
})();
