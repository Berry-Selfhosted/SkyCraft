"use strict";
/* Экран сюжетной кампании. Рендер DOM, никаких скрытых серверных запросов. */
(function () {
    const campaign = window.SkycraftCampaign;
    const root = document.getElementById("campaign-chapters");
    if (!campaign || !root) return;
    const $ = id => document.getElementById(id);
    const progress = campaign.createStore(window.SkycraftProfiles.storage);
    const economy = window.SkycraftEconomy?.createStore(window.SkycraftProfiles.storage);
    const trained = (() => { try { return window.SkycraftProfiles.storage.getItem("skycraft.tutorial.completed.v1") === "true"; } catch { return false; } })();
    const elapsed = secs => `${String(Math.floor(secs / 60)).padStart(2,"0")}:${String(Math.floor(secs % 60)).padStart(2,"0")}`;
    let selected = 1;
    let pending = null;
    function button(label, extra = "") {
        const b = document.createElement("button"); b.type = "button"; b.className = "campaign-option" + extra;
        b.textContent = label; return b;
    }
    function render() {
        const data = progress.read();
        root.replaceChildren();
        const passed = campaign.chapters.filter(c => data.finished[c.index]).length;
        $("campaign-counter").textContent = `${passed} / 12`;
        $("campaign-progress-title").textContent = passed === 12 ? "ОПЕРАЦИЯ ЗАВЕРШЕНА" : passed ? "СПАСАТЕЛЬНАЯ ОПЕРАЦИЯ ИДЁТ" : "ОПЕРАЦИЯ НЕ НАЧАТА";
        $("campaign-pilot-profile").textContent = progress.profile(data);
        for (const chapter of campaign.chapters) {
            const unlocked = progress.unlocked(chapter.index, data);
            const card = document.createElement("button");
            card.type = "button";
            card.className = `campaign-chapter campaign-chapter--${chapter.biome}`;
            if (chapter.index === selected) card.classList.add("is-selected");
            if (!unlocked || !trained) card.classList.add("is-locked");
            card.setAttribute("aria-pressed", String(chapter.index === selected));
            const status = !trained ? "НУЖНА АКАДЕМИЯ" : data.choices[chapter.index] ? "РЕШЕНИЕ ПРИНЯТО" :
                data.finished[chapter.index] ? "ЖДЁТ ДЕБРИФИНГА" : unlocked ? "ДОСТУПНО" : "ЗАБЛОКИРОВАНО";
            const top = document.createElement("span"); top.className="campaign-chapter-top";
            top.textContent = `${String(chapter.index).padStart(2,"0")} / 12      ${chapter.region}`;
            const icon = document.createElement("span"); icon.className="campaign-chapter-icon";
            icon.textContent = !unlocked ? "⌁" : data.choices[chapter.index] ? "✓" : "◇";
            const title = document.createElement("strong"); title.textContent = chapter.title;
            const small = document.createElement("span"); small.className="campaign-chapter-status"; small.textContent=status;
            const reward = window.SkycraftFlightRewards?.calculate(chapter, progress.modifierFor(chapter.index, data));
            const claimed = economy?.getLevelRewards()[chapter.id];
            const earnings = document.createElement("span");
            earnings.className = "campaign-chapter-reward";
            earnings.textContent = claimed ? `✓ ${claimed.amount} CR получено` : `+${reward?.total ?? 0} CR · первый вылет`;
            card.append(top, icon, title, small, earnings);
            card.addEventListener("click", () => {
                selected=chapter.index;
                render();
                window.SkycraftSounds?.play("select");
                if (trained && progress.unlocked(selected)) launchSelected();
            });
            root.append(card);
        }
        const chosen = campaign.chapters[selected - 1];
        $("campaign-selected-name").textContent = `${String(selected).padStart(2,"0")} — ${chosen.title}`;
        $("campaign-selected-region").textContent=chosen.region;
        const plannedReward = window.SkycraftFlightRewards?.calculate(chosen, progress.modifierFor(selected, data));
        const previousReward = economy?.getLevelRewards()[chosen.id];
        const rewardInfo = $("campaign-selected-reward");
        if (rewardInfo) rewardInfo.textContent = previousReward
            ? `✓ Награда за эту главу уже получена: ${previousReward.amount} CR`
            : `✦ За первое прохождение: +${plannedReward?.total ?? 0} CR${plannedReward?.bonus ? ` (включая ${plannedReward.bonus} CR за риск)` : ""}`;
        const sector = window.SkycraftCampaignLevels?.storyLevels?.[selected - 1];
        $("campaign-selected-desc").textContent = sector ? `${chosen.summary} Сектор: ${sector.sectorName}. Условия: ${sector.weather}.` : chosen.summary;
        const condition = progress.modifierFor(selected, data);
        $("campaign-selected-condition").textContent = condition ? `АИДА / ПОСЛЕДСТВИЕ ВЫБОРА: ${window.SkycraftCampaignEffects?.description(condition) || condition}` :
            selected === 1 ? "АИДА / ПОИСК ПЕРВОГО ЛАГЕРЯ" : "АИДА / НУЖНО РЕШЕНИЕ ПО ПРЕДЫДУЩЕМУ ВЫЛЕТУ";
        const can = trained && progress.unlocked(selected, data);
        $("campaign-launch").disabled = !can;
        $("campaign-launch").innerHTML = data.finished[selected] ? "ПОВТОРИТЬ ВЫЛЕТ <span>↗</span>" : "НАЧАТЬ ВЫЛЕТ <span>↗</span>";
        $("campaign-launch-hint").textContent = !trained ? "Сначала закончи Академию пилота" : !can ? "Сначала прими решение в дебрифинге предыдущей главы" : "Вылет начнётся в общей открытой долине операции. Коршун и канал АИДЫ предоставляются автоматически";
        const ending=progress.ending(data), epilogue=$("campaign-epilogue");
        epilogue.hidden = !ending;
        if (ending) {
            $("campaign-epilogue-title").textContent = ending==="rescue" ? "ЦЕНА ПРЯМОГО СПАСЕНИЯ" : "ПУТЬ КО СПАСЕНИЮ";
            $("campaign-epilogue-text").textContent = ending==="rescue" ?
                "Коршун выдержал ураган лишь на пределе возможностей. Трос доставлен, спасатели получили шанс. АИДА сохраняет запись о решении оператора." :
                "Координаты маяка переданы наземной группе. Людей удалось обнаружить, но помощь придёт позже. АИДА сохраняет запись о решении оператора.";
        }
    }
    function openDebrief(index) {
        const chapter=campaign.chapters[index-1]; if (!chapter) return;
        pending=index;
        $("campaign-debrief-title").textContent = `${String(index).padStart(2,"0")} / ${chapter.title.toUpperCase()}`;
        $("campaign-debrief-voice").textContent=chapter.aida;
        const options=$("campaign-debrief-options"); options.replaceChildren();
        chapter.choices.forEach(choice => {
            const b=button(choice.label);
            const more=document.createElement("small"); more.textContent=`${choice.detail} ${choice.effect}`;
            b.append(more);
            b.addEventListener("click", () => {
                if (progress.choose(index,choice.id)) {
                    $("campaign-pending-debrief").hidden=true;
                    pending=null;
                    selected=Math.min(12,index+1);
                    window.SkycraftSounds?.play("select");
                    render();
                }
            }); options.append(b);
        });
        $("campaign-pending-debrief").hidden = false;
    }
    $("campaign-debrief-close").addEventListener("click", () => { $("campaign-pending-debrief").hidden = true; });
    function launchSelected() {
        const data=progress.read();
        if (!trained || !progress.unlocked(selected,data)) return;
        if (data.finished[selected] && !data.choices[selected]) { openDebrief(selected); return; }
        window.location.assign(`/Flight?level=story-${String(selected).padStart(2,"0")}&autostart=1`);
    }
    $("campaign-launch").addEventListener("click", launchSelected);
    const params=new URLSearchParams(location.search);
    const selectedParam=Number(params.get("chapter"));
    if (selectedParam >= 1 && selectedParam <= 12) selected=selectedParam;
    else selected=campaign.chapters.find(c => progress.unlocked(c.index) && !progress.read().finished[c.index])?.index || 12;
    render();
    const pendingChapter=campaign.chapters.find(c => progress.read().finished[c.index] && !progress.read().choices[c.index]);
    if (pendingChapter && trained) openDebrief(pendingChapter.index);
})();
