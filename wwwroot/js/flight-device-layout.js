"use strict";
/*
 * Определяем мобильный игровой интерфейс ДО отрисовки страницы.
 * Сохраняем один режим для всех CSS-файлов и игровых контроллеров.
 */
(function () {
    const root = document.documentElement;

    function isMobileFlightLayout() {
        const query = (expression) => window.matchMedia?.(expression)?.matches === true;
        const shortSide = Math.min(window.innerWidth, window.innerHeight);
        const touch = navigator.maxTouchPoints > 0 || query("(pointer: coarse)") || query("(any-pointer: coarse)");
        const mobileBrowser = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
        const phoneSize = shortSide <= 900 && window.innerWidth <= 1600;
        const smallLandscape = window.innerWidth <= 1400 && window.innerHeight <= 760 && window.innerWidth > window.innerHeight;

        // Пейзажная ориентация телефона бывает шире 1000 CSS-пикселей.
        return (mobileBrowser && phoneSize) || (touch && phoneSize) || smallLandscape || window.innerWidth <= 700;
    }

    function sync() {
        const mobile = isMobileFlightLayout();
        root.classList.toggle("skycraft-mobile-flight", mobile);
        root.classList.toggle("skycraft-desktop-flight", !mobile);
        if (document.body) {
            document.body.classList.toggle("is-mobile-flight-ui", mobile);
            document.body.classList.toggle("is-desktop-flight-ui", !mobile);
        }
        return mobile;
    }

    window.SkycraftDeviceLayout = Object.freeze({ sync, isMobileFlightLayout });
    sync();
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("orientationchange", sync, { passive: true });
})();
