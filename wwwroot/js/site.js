"use strict";

// Здесь только поведение интерфейса. Игровой движок и серверные аккаунты
// можно подключить отдельно, не смешивая их с кодом главного экрана.

const storageKeys = {
    sound: "skycraft.soundEnabled",
    reduceMotion: "skycraft.reduceMotion",
    selectedFrame: "skycraft.selectedFrame"
};

const frameModels = {
    base: { weight: "12 кг", speed: "60 км/ч", range: "800 м" },
    race: { weight: "9 кг", speed: "110 км/ч", range: "450 м" },
    longrange: { weight: "15 кг", speed: "45 км/ч", range: "1800 м" }
};

const settingsOverlay = document.getElementById("settings-overlay");
const settingsDialog = document.getElementById("settings-dialog");
const soundSetting = document.getElementById("setting-sound");
const motionSetting = document.getElementById("setting-motion");
const volumeSetting = document.getElementById("setting-sound-volume");
const volumeValue = document.getElementById("setting-volume-value");
const soundPreview = document.getElementById("test-sound");
const soundEngine = window.SkycraftSounds;
const soundButton = document.getElementById("sound-button");
const soundLabel = document.getElementById("sound-label");
const balanceButton = document.getElementById("balance-button");
const balancePopover = document.getElementById("balance-popover");
const userButton = document.getElementById("user-button");
const userPopover = document.getElementById("user-popover");

let lastFocusedElement = null;
// WAV-звуки и их кэш управляются отдельным файлом ui-sounds.js.

function readSetting(key, defaultValue) {
    try {
        const savedValue = window.SkycraftProfiles.storage.getItem(key);
        return savedValue === null ? defaultValue : savedValue === "true";
    } catch {
        // Например, если в браузере запрещено локальное хранилище.
        return defaultValue;
    }
}

function writeSetting(key, value) {
    try {
        window.SkycraftProfiles.storage.setItem(key, String(value));
    } catch {
        // Отсутствие localStorage не должно ломать управление экраном.
    }
}

let soundEnabled = soundEngine?.enabled ?? readSetting(storageKeys.sound, true);
let reduceMotion = readSetting(storageKeys.reduceMotion, false);

function updateSoundControls() {
    soundSetting.checked = soundEnabled;
    volumeSetting.disabled = !soundEnabled;
    soundPreview.disabled = !soundEnabled;
    soundButton?.setAttribute("aria-pressed", String(soundEnabled));
    soundButton?.classList.toggle("is-muted", !soundEnabled);
    if (soundLabel) {
        soundLabel.textContent = soundEnabled ? "Звук включён" : "Звук выключен";
    }
}

function updateMotionControls() {
    motionSetting.checked = reduceMotion;
    document.body.classList.toggle("reduce-motion", reduceMotion);
}

function updateVolumeControls() {
    const percent = Math.round((soundEngine?.volume ?? 0.55) * 100);
    volumeSetting.value = String(percent);
    volumeValue.textContent = `${percent}%`;
}

function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    soundEngine?.setEnabled(enabled);
    writeSetting(storageKeys.sound, enabled);
    updateSoundControls();
    // На выключение допускаем один завершающий звук по действию игрока.
    soundEngine?.play(enabled ? "toggle-on" : "toggle-off", { force: !enabled });
}

function closePopover(button, popover) {
    button.setAttribute("aria-expanded", "false");
    popover.hidden = true;
}

function closeAllPopovers() {
    closePopover(balanceButton, balancePopover);
    closePopover(userButton, userPopover);
}

function togglePopover(button, popover) {
    const shouldOpen = popover.hidden;
    closeAllPopovers();

    if (shouldOpen) {
        button.setAttribute("aria-expanded", "true");
        popover.hidden = false;
    }
    soundEngine?.play(shouldOpen ? "open" : "close");
}

function openSettings() {
    lastFocusedElement = document.activeElement;
    closeAllPopovers();
    settingsOverlay.hidden = false;
    document.body.classList.add("modal-open");
    settingsDialog.focus();
    soundEngine?.play("open");
}

function closeSettings() {
    settingsOverlay.hidden = true;
    document.body.classList.remove("modal-open");

    if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
    }
    soundEngine?.play("close");
}

balanceButton.addEventListener("click", () => {
    togglePopover(balanceButton, balancePopover);
});

userButton.addEventListener("click", () => {
    togglePopover(userButton, userPopover);
});

document.querySelectorAll("[data-open-settings]").forEach((button) => {
    button.addEventListener("click", openSettings);
});

document.getElementById("close-settings").addEventListener("click", closeSettings);
document.getElementById("save-settings").addEventListener("click", closeSettings);

settingsOverlay.addEventListener("click", (event) => {
    if (event.target === settingsOverlay) {
        closeSettings();
    }
});

// Удерживаем клавиатурный фокус внутри открытого модального окна.
settingsOverlay.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
        return;
    }

    const focusable = [...settingsDialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'
    )];
    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    } else if (document.activeElement === settingsDialog) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (!settingsOverlay.hidden) {
            closeSettings();
        } else {
            closeAllPopovers();
        }
    }
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".popover-anchor")) {
        closeAllPopovers();
    }

});

soundSetting.addEventListener("change", () => setSoundEnabled(soundSetting.checked));

soundButton?.addEventListener("click", () => setSoundEnabled(!soundEnabled));

volumeSetting.addEventListener("input", () => {
    soundEngine?.setVolume(Number(volumeSetting.value) / 100);
    updateVolumeControls();
});
volumeSetting.addEventListener("change", () => soundEngine?.play("select"));
soundPreview.addEventListener("click", () => soundEngine?.play("success"));

motionSetting.addEventListener("change", () => {
    reduceMotion = motionSetting.checked;
    writeSetting(storageKeys.reduceMotion, reduceMotion);
    updateMotionControls();
});

updateSoundControls();
updateMotionControls();
updateVolumeControls();

// Cross-tab notifications use real prefixed keys; ignore other pilots' data.
function belongsToCurrentProfileStorageEvent(eventKey, logicalKey) {
    const profile = window.SkycraftProfiles?.active();
    return eventKey === null || (profile && eventKey ===
        `${window.SkycraftProfiles.DATA_PREFIX}${profile.id}.${logicalKey}`);
}

window.addEventListener("storage", (event) => {
    if (belongsToCurrentProfileStorageEvent(event.key, storageKeys.sound) ||
        belongsToCurrentProfileStorageEvent(event.key, "skycraft.soundVolume.v1")) {
        soundEnabled = soundEngine?.enabled ?? readSetting(storageKeys.sound, true);
        updateSoundControls();
        updateVolumeControls();
    }
});

// Баланс синхронизируется с мастерской и другими страницами интерфейса.
function updateAccountBalance() {
    let credits = 420;
    try {
        const savedCredits = Number(window.SkycraftProfiles.storage.getItem("skycraft.credits.v1"));
        if (window.SkycraftProfiles.storage.getItem("skycraft.credits.v1") !== null && Number.isFinite(savedCredits)) {
            credits = Math.max(0, savedCredits);
        }
    } catch { /* демо-баланс по умолчанию */ }

    document.querySelectorAll("[data-player-credits]").forEach((element) => {
        element.textContent = String(credits);
    });
    balanceButton.setAttribute("aria-label", `Баланс: ${credits} кредитов`);
}

window.addEventListener("skycraft:credits-changed", updateAccountBalance);
// Покупки и продажи в другой вкладке тоже отражаются в шапке сайта.
window.addEventListener("storage", (event) => {
    if (belongsToCurrentProfileStorageEvent(event.key, "skycraft.credits.v1")) {
        updateAccountBalance();
    }
});
updateAccountBalance();

// Демонстрационный конструктор. Сведения сохраняются только в этом браузере.
const builderForm = document.getElementById("builder-form");

if (builderForm) {
    const frameSelector = document.getElementById("frame-type");
    const savedFrame = (() => {
        try {
            return window.SkycraftProfiles.storage.getItem(storageKeys.selectedFrame);
        } catch {
            return null;
        }
    })();

    if (savedFrame && Object.hasOwn(frameModels, savedFrame)) {
        frameSelector.value = savedFrame;
    }

    function updateFrameStats() {
        const model = frameModels[frameSelector.value];
        document.getElementById("builder-weight").textContent = model.weight;
        document.getElementById("builder-speed").textContent = model.speed;
        document.getElementById("builder-range").textContent = model.range;
        document.getElementById("builder-message").textContent = "";
    }

    frameSelector.addEventListener("change", updateFrameStats);
    builderForm.addEventListener("submit", (event) => {
        event.preventDefault();

        try {
            window.SkycraftProfiles.storage.setItem(storageKeys.selectedFrame, frameSelector.value);
            document.getElementById("builder-message").textContent =
                "Прототип сохранён в этом браузере.";
        } catch {
            document.getElementById("builder-message").textContent =
                "Сохранение недоступно в этом браузере.";
        }
    });

    updateFrameStats();
}

// Локальный профиль пилота: имя отображается в шапке всех игровых страниц.
(function showActiveLocalPilot() {
    const profile = window.SkycraftProfiles?.active();
    if (!profile) return;
    document.querySelectorAll("[data-user-profile-name]").forEach(node => {
        node.textContent = profile.name;
    });
    document.getElementById("profile-logout")?.addEventListener("click", () => {
        window.SkycraftProfiles.logout();
        window.location.assign("/Login");
    });
})();
