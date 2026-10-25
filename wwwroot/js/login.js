"use strict";
(function () {
    const manager = window.SkycraftProfiles;
    const $ = id => document.getElementById(id);
    const input = $("profile-username");
    const message = $("profile-message");
    const profiles = $("profile-list");
    const returnUrl = manager.redirectTarget(new URLSearchParams(location.search).get("returnUrl"));
    const active = manager.active();
    if (active) $("profile-current").textContent = `Сейчас выбран профиль ${active.name}`;

    function showError(error) {
        message.textContent = error?.message || String(error);
        message.dataset.error = "true";
    }
    function proceed() { location.assign(returnUrl); }
    function submit(mode) {
        try {
            message.textContent = "";
            message.dataset.error = "false";
            const result = mode === "register" ? manager.register(input.value) : manager.login(input.value);
            if (result?.migrated) {
                                                                            
                                                                                
                console.info(`SKYCRAFT: перенесено ${result.migrated} ключей сохранений`);
            }
            proceed();
        } catch (error) { showError(error); }
    }
    $("profile-register").addEventListener("click", () => submit("register"));
    $("profile-form").addEventListener("submit", event => { event.preventDefault(); submit("login"); });
    function renderProfiles() {
        profiles.replaceChildren();
        const items = manager.list();
        $("profile-existing").hidden = items.length === 0;
        for (const profile of items) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "profile-known";
            const avatar = document.createElement("span");
            avatar.className = "profile-known-avatar";
            avatar.textContent = profile.name.slice(0, 1).toUpperCase();
            const label = document.createElement("span");
            label.textContent = profile.name;
            button.append(avatar, label);
            button.addEventListener("click", () => { input.value = profile.name; submit("login"); });
            profiles.append(button);
        }
    }
    renderProfiles();
    input.focus();
})();
