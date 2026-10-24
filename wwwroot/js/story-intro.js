
"use strict";
(function () {
    const manager = window.SkycraftProfiles;
    if (!manager || !location.pathname.match(/^\/$|^\/Index/i)) return;
    const storage = manager.storage;
    const root = document.getElementById("story-intro-overlay");
    if (!root) return;
    const SEEN_KEY = "skycraft.story.intro.complete.v1";
    const CHOICE_KEY = "skycraft.story.intro.choice.v1";
    const OPEN_CAMPAIGN_AFTER = "skycraft.story.intro.gotoCampaign.v1";
    const log = document.getElementById("story-intro-log");
    const nextBtn = document.getElementById("story-intro-next");
    const skipBtn = document.getElementById("story-intro-skip");
    const choicesBox = document.getElementById("story-intro-choices");
    const choiceList = document.getElementById("story-intro-choice-list");
    const finishBox = document.getElementById("story-intro-finish");
    const closeBtn = document.getElementById("story-intro-close");
    const openCampaignBtn = document.getElementById("story-intro-open-campaign");
    const leftImg = document.getElementById("story-intro-left-image");
    const rightImg = document.getElementById("story-intro-right-image");
    const leftCard = root.querySelector('.story-intro-portrait--left');
    const rightCard = root.querySelector('.story-intro-portrait--right');

    function read(key) { try { return storage.getItem(key); } catch { return null; } }
    function write(key, value) { try { storage.setItem(key, value); } catch { return false; } return true; }

    const script = [
        { speaker: "aida", name: "АИДА", emotion: "neutral", text: "Оператор Коршун, подтверждаю регистрацию. Я — АИДА, автономная система аварийного поиска. Готова сопровождать первый вылет." },
        { speaker: "korshun", name: "Коршун", emotion: "focused", text: "Принял, АИДА. Что по обстановке?" },
        { speaker: "aida", name: "АИДА", emotion: "alert", text: "Сильное землетрясение вызвало оползни и прорыв естественной дамбы горного озера. Связь с туристическими группами фрагментарна. Район спасения разбит на двенадцать секторных вылетов." },
        { speaker: "korshun", name: "Коршун", emotion: "concern", text: "То есть сначала академия и калибровка, потом полноценная операция?" },
        { speaker: "aida", name: "АИДА", emotion: "smile", text: "Верно. Но уже сейчас нужно определить приоритет первой поисковой схемы. Это повлияет на характер следующего задания и стиль всей операции." }
    ];
    const choices = [
        { id: "force", label: "[A] Форсируем двигатели", detail: "Игнорируем перегрев. Следующий вылет будет быстрее, но возрастёт риск нестабильности тяги и сноса ветром." },
        { id: "passive", label: "[Б] Пассивное сканирование", detail: "Снижаем высоту и экономим заряд. Дальность связи и зона уверенного обзора уменьшатся." },
        { id: "sensors", label: "[В] Лидар и тепловизор", detail: "Используем все сенсоры сразу. Видимость станет лучше, но интерфейс и акустика будут перегружены." }
    ];

    let index = 0;
    let completed = false;

    function portraitFor(speaker, emotion) {
        return `/assets/characters/${speaker === "aida" ? `aida-${emotion}` : `korshun-${emotion}`}.png`;
    }
    function highlight(speaker, emotion) {
        leftCard.classList.toggle('is-speaking', speaker === 'aida');
        rightCard.classList.toggle('is-speaking', speaker === 'korshun');
        if (speaker === 'aida') leftImg.src = portraitFor('aida', emotion);
        else rightImg.src = portraitFor('korshun', emotion);
    }
    function appendMessage(entry) {
        const bubble = document.createElement('article');
        bubble.className = 'story-intro-bubble';
        bubble.dataset.speaker = entry.speaker;
        bubble.innerHTML = `<header><strong>${entry.name}</strong><small>${entry.speaker === 'aida' ? 'ИИ-ассистент' : 'Оператор БПЛА'}</small></header><p>${entry.text}</p>`;
        log.append(bubble);
        log.scrollTop = log.scrollHeight;
        highlight(entry.speaker, entry.emotion);
    }
    function showChoices() {
        choicesBox.hidden = false;
        nextBtn.hidden = true;
        choiceList.replaceChildren();
        choices.forEach(choice => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'story-intro-choice';
            button.innerHTML = `<strong>${choice.label}</strong><span>${choice.detail}</span>`;
            button.addEventListener('click', () => selectChoice(choice.id, button));
            choiceList.append(button);
        });
    }
    function selectChoice(id, button) {
        if (completed) return;
        completed = true;
        write(CHOICE_KEY, id);
        write(SEEN_KEY, '1');
        [...choiceList.children].forEach(node => {
            node.disabled = true;
            node.classList.toggle('is-picked', node === button);
        });
        const reply = {
            speaker: 'aida', name: 'АИДА', emotion: id === 'force' ? 'alert' : (id === 'sensors' ? 'smile' : 'neutral'),
            text: id === 'force'
                ? 'Принято. Увеличиваю допустимый порог тяги. Я отмечу оператора как склонного к риску.'
                : id === 'passive'
                    ? 'Принято. Перевожу шаблон вылета в экономичный режим и уменьшаю рабочую высоту.'
                    : 'Принято. Поднимаю приоритет лидара и тепловизора. Интерфейс получит расширенные показания.'
        };
        appendMessage(reply);
        finishBox.hidden = false;
    }
    function advance() {
        if (completed) return;
        if (index < script.length) {
            appendMessage(script[index]);
            index += 1;
            if (index >= script.length) showChoices();
        }
    }
    function fastForward() {
        while (index < script.length) advance();
    }
    function close(goCampaign) {
        write(SEEN_KEY, '1');
        if (goCampaign) write(OPEN_CAMPAIGN_AFTER, '1');
        root.hidden = true;
        document.body.classList.remove('story-intro-open');
        if (goCampaign) location.assign('/Campaign');
    }
    function onKeydown(event) {
        if (root.hidden) return;
        if (event.key === 'Escape') { fastForward(); return; }
        if ((event.key === 'Enter' || event.key === ' ') && !choicesBox.hidden && !completed) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!choicesBox.hidden && completed) close(false);
            else if (index < script.length) advance();
        }
    }
    function bind() {
        nextBtn?.addEventListener('click', () => advance());
        skipBtn?.addEventListener('click', () => fastForward());
        closeBtn?.addEventListener('click', () => close(false));
        openCampaignBtn?.addEventListener('click', () => close(true));
        root.querySelector('.story-intro-chat-shell')?.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            if (index < script.length) advance();
        });
        document.addEventListener('keydown', onKeydown);
    }
    function init() {
        if (read(SEEN_KEY) === '1') return;
        root.hidden = false;
        document.body.classList.add('story-intro-open');
        bind();
        advance();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
