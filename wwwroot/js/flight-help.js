"use strict";

  
                                     
                                                             
                                                                            
   
(function () {
    const panel = document.getElementById("flight-help-drawer");
    const toggle = document.getElementById("flight-help-toggle");
    const close = document.getElementById("flight-help-close");
    if (!panel || !toggle || !close) return;

    function setOpen(isOpen) {
        panel.classList.toggle("is-open", isOpen);
        panel.inert = !isOpen;
        panel.setAttribute("aria-hidden", String(!isOpen));
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Скрыть подсказки" : "Показать подсказки по управлению");
        toggle.title = isOpen ? "Закрыть подсказки (I)" : "Открыть подсказки (I)";
    }

    function toggleHelp() {
        const willOpen = toggle.getAttribute("aria-expanded") !== "true";
        setOpen(willOpen);
        window.SkycraftSounds?.play(willOpen ? "open" : "close");
    }

    toggle.addEventListener("click", toggleHelp);
    close.addEventListener("click", () => {
        setOpen(false);
        window.SkycraftSounds?.play("close");
                                                                             
        document.getElementById("flight-canvas")?.focus({ preventScroll: true });
    });

    window.addEventListener("keydown", (event) => {
        if (event.code !== "KeyI" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
                                                                                      
        const settings = document.getElementById("settings-overlay");
        if (settings && !settings.hidden) return;
        event.preventDefault();
        toggleHelp();
    });

    setOpen(false);
})();
