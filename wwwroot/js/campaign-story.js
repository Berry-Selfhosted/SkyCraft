"use strict";
  
                                                           
                                                                        
                                                                         
                                                               
   
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftCampaign = api;
})(typeof window === "undefined" ? null : window, function () {
    const SAVE_KEY = "skycraft.korshun.campaign.v1";
    const chapters = [
        {
            title: "Опушка", region: "ЛЕС / ПЕРВЫЕ ЧАСЫ", biome: "forest", difficulty: "Разведка",
            summary: "Землетрясение разрушило тропы. Найди лагерь туристов под густыми кронами.",
            objective: "Обследуй три сигнальные точки и вернись на посадку.",
            aida: "Кроны скрывают следы. Впереди плотный лес. Как поведём поиск?",
            choices: [
                { id: "high", label: "Подняться над кронами", detail: "Видимость лучше, но впереди открытая ветреная долина.", modifier: "wind", effect: "Следующий уровень: порывистый встречный ветер." },
                { id: "low", label: "Идти под ветвями", detail: "Следы ближе, но в речном ущелье пропадёт навигация.", modifier: "gps", effect: "Следующий уровень: неточная навигация и ограниченный обзор." }
            ]
        },
        {
            title: "Разлив", region: "РЕКА / ПЕРВАЯ ВОЛНА", biome: "river", difficulty: "Поиск",
            summary: "Река вышла из берегов. Между брёвнами дрейфуют плоты с людьми.",
            objective: "Проверь отмеченные плоты и садись на сухой берег.",
            aida: "Тепловизор отсырел. Как мы увидим людей на воде?",
            choices: [
                { id: "spotlight", label: "Прожектор и малые высоты", detail: "Яркий свет поможет сейчас, но брызги забьют объективы.", modifier: "spray", effect: "Следующий уровень: мокрый объектив, периодическая очистка." },
                { id: "audio", label: "Акустические сенсоры", detail: "Можно услышать крики, но шум воды заглушит радиоканал.", modifier: "noise", effect: "Следующий уровень: настройка частоты сканирования." }
            ]
        },
        {
            title: "Край разлома", region: "РАСЩЕЛИНА / ОБРЫВ", biome: "cliff", difficulty: "Риск",
            summary: "На узком уступе остаются люди. Над разломом бьют восходящие потоки.",
            objective: "Осмотри уступы, не задев скалы, и возвращайся.",
            aida: "Порывы непредсказуемы. Какая траектория над разломом безопаснее для группы?",
            choices: [
                { id: "hover", label: "Зависнуть для широкого обзора", detail: "Сенсоры увидят больше, но двигатель будет перегружен.", modifier: "battery", effect: "Следующий уровень: ускоренный разряд батареи." },
                { id: "edge", label: "Идти вдоль защищённой стены", detail: "Меньше ветра, но металлическая порода собьёт компас.", modifier: "compass", effect: "Следующий уровень: магнитные помехи курса." }
            ]
        },
        {
            title: "Туманный берег", region: "ОЗЕРО / ЗОНА ИСПАРЕНИЯ", biome: "lake", difficulty: "Сенсоры",
            summary: "Над разрушенной дамбой висит пыльный туман. Видимость падает.",
            objective: "Найди тепловые отметки вдоль берега и приземлись.",
            aida: "Камера видит почти ничего. Чему поручим распознавание людей?",
            choices: [
                { id: "thermal", label: "Усилить тепловизор", detail: "Он различит силуэты, но нагретые камни создадут ложные цели.", modifier: "decoys", effect: "Следующий уровень: ложные тепловые сигналы." },
                { id: "lidar", label: "Поднять мощность лидара", detail: "Карта рельефа появится, но с шумом от влаги.", modifier: "lidar", effect: "Следующий уровень: помехи лидара, нужна калибровка." }
            ]
        },
        {
            title: "Бурелом", region: "ЛЕС / ТЁМНАЯ НОЧЬ", biome: "deadforest", difficulty: "Ночь",
            summary: "Тёмный лес завален поваленными стволами. Свет выдаёт позицию.",
            objective: "Проложи маршрут через завалы и найди сигнальный костёр.",
            aida: "Осталось мало света и заряда. Как пометим безопасный путь?",
            choices: [
                { id: "markers", label: "Сбросить световые маркеры", detail: "Видимый путь легче проверить, но придётся искать метки.", modifier: "markers", effect: "Следующий уровень: поиск и подтверждение маяков." },
                { id: "infrared", label: "Использовать только ИК-подсветку", detail: "Мы не выдадим себя людям, зато обеспокоим ночных птиц.", modifier: "birds", effect: "Следующий уровень: порывы от пролетающих птиц." }
            ]
        },
        {
            title: "Дно ущелья", region: "РАСЩЕЛИНА / ПОТЕРЯ СВЯЗИ", biome: "gorge", difficulty: "Связь",
            summary: "Спусти аппарат между стенами. GPS пропал, связи почти нет.",
            objective: "Осмотри два укрытия на дне ущелья.",
            aida: "Канал управления рвётся. Доверить стабилизацию автоматике?",
            choices: [
                { id: "autopilot", label: "Передать стабилизацию АИДЕ", detail: "Аппарат будет ровнее, но при поиске мелких целей придётся помогать.", modifier: "autopilot", effect: "Следующий уровень: автокоррекция курса и ручное подтверждение целей." },
                { id: "manual", label: "Сохранить ручное управление", detail: "Контроль останется у пилота ценой задержки связи.", modifier: "lag", effect: "Следующий уровень: задержка отклика управления." }
            ]
        },
        {
            title: "Горный поток", region: "РЕКА / АЭРОДИНАМИЧЕСКАЯ ТРУБА", biome: "torrent", difficulty: "Манёвр",
            summary: "Воздушный поток ускоряется между скалами. Воды становится всё больше.",
            objective: "Пройди между контрольными метками без столкновений.",
            aida: "По центру быстрее, вдоль скал спокойнее. Куда направить Коршуна?",
            choices: [
                { id: "center", label: "Использовать скоростной центр", detail: "Выграем время, но управление станет резким.", modifier: "sensitive", effect: "Следующий уровень: повышенная чувствительность управления." },
                { id: "shelter", label: "Прятаться в ветровых карманах", detail: "Потеряем темп, зато снизим нагрузку на батарею.", modifier: "vibration", effect: "Следующий уровень: вибрация камеры от риска задеть скалы." }
            ]
        },
        {
            title: "Шторм над озером", region: "ОЗЕРО / ОТКРЫТАЯ ВОДА", biome: "storm", difficulty: "Шторм",
            summary: "На полузатопленной лодке ждут помощи. Связной отсек заливает.",
            objective: "Обнаружь лодку и передай координаты спасателям.",
            aida: "Отсек связи намокает. Что важнее — надёжность или дальность?",
            choices: [
                { id: "seal", label: "Герметизировать отсек", detail: "Избежим короткого замыкания, но дальность радиосвязи упадёт.", modifier: "range", effect: "Следующий уровень: уменьшенный радиус миссии." },
                { id: "ignore", label: "Не трогать связь до конца вылета", detail: "Передача не прервётся сейчас, но камера начнёт мигать.", modifier: "blackout", effect: "Следующий уровень: краткие пропадания видео." }
            ]
        },
        {
            title: "Селевой склон", region: "ГОРА / ГРЯЗЕВОЙ ПОТОК", biome: "mud", difficulty: "Ориентация",
            summary: "Поток грязи перекрыл дорогу эвакуации. Объектив забивает пылью.",
            objective: "Осмотри обходной склон и определи проход.",
            aida: "Камеры покрыты грязью. Тратить энергию на очистку?",
            choices: [
                { id: "clean", label: "Включить воздушную очистку", detail: "Обзор вернётся, но компрессоры израсходуют запас энергии.", modifier: "battery", effect: "Следующий уровень: высокий расход батареи." },
                { id: "dirty", label: "Работать с загрязнённой оптикой", detail: "Сохраним заряд, но часть маршрута придётся проходить по приборам.", modifier: "dirty", effect: "Следующий уровень: мутная камера и затруднённый обзор." }
            ]
        },
        {
            title: "Снежная линия", region: "ГОРА / МИНУС ДВАДЦАТЬ", biome: "snow", difficulty: "Холод",
            summary: "Мороз снижает ресурс батареи, снежная пыль прячет горизонт.",
            objective: "Пройди над ледовыми карнизами и найди сигнальный маяк.",
            aida: "Нагрев батареи потребует энергию. Что оставим в приоритете?",
            choices: [
                { id: "heating", label: "Включить прогрев аккумулятора", detail: "Батарея надёжнее, но стабилизация камеры ослабеет.", modifier: "shake", effect: "Следующий уровень: дрожание камеры." },
                { id: "cold", label: "Сохранить резерв без нагрева", detail: "Сэкономим заряд, но опасно надолго зависать на месте.", modifier: "nohover", effect: "Следующий уровень: батарея быстрее садится при зависании." }
            ]
        },
        {
            title: "Скрытый грот", region: "РАСЩЕЛИНА / ПОДЗЕМЕЛЬЕ", biome: "cave", difficulty: "Точность",
            summary: "Среди камней найден узкий вход в укрытие. Любой громкий звук пугает людей.",
            objective: "Найди вход и передай координаты укрытия.",
            aida: "Шум винтов может вызвать осыпь. Как войдём в тесный грот?",
            choices: [
                { id: "glide", label: "Пройти на минимальной тяге", detail: "Меньше шума, но хуже вертикальная управляемость.", modifier: "glide", effect: "Финал: слабая подъёмная тяга и инерционное снижение." },
                { id: "sonar", label: "Включить ультразвуковой сонар", detail: "Контуры видны лучше, но люди встревожатся от импульсов.", modifier: "panic", effect: "Финал: потребуется дополнительно стабилизировать сигнал." }
            ]
        },
        {
            title: "Эпицентр", region: "ГОРА / ФИНАЛЬНЫЙ ВЫЛЕТ", biome: "summit", difficulty: "Финал",
            summary: "Ураган срывает связь. Лидер группы ждёт последнюю попытку эвакуации.",
            objective: "Пройди спасательные точки и мягко приземлись у спасателей.",
            aida: "Оператор, это последний вылет. Коршун может не вернуться. Как поступим?",
            choices: [
                { id: "cable", label: "Пробиться сквозь ветер с тросом", detail: "Риск для дрона, но шанс доставить груз выжившим.", modifier: "end-cable", effect: "Финал: спасательный трос доставлен, Коршун повреждён." },
                { id: "beacon", label: "Сбросить груз и передать координаты", detail: "Сохраним точность передачи, но откажемся от непосредственной эвакуации.", modifier: "end-beacon", effect: "Финал: маяк передан, приближается наземная группа." }
            ]
        }
    ].map((chapter, index) => Object.freeze({
        ...chapter, index: index + 1, id: `story-${String(index + 1).padStart(2, "0")}`,
        model: `story-${String(index + 1).padStart(2, "0")}`,
        choices: Object.freeze(chapter.choices.map(choice => Object.freeze(choice)))
    }));

    function empty() { return { version: 1, finished: {}, choices: {}, best: {} }; }
    function normalize(raw) {
        const result = empty();
        if (!raw || typeof raw !== "object") return result;
        for (const field of ["finished", "choices", "best"]) {
            if (raw[field] && typeof raw[field] === "object" && !Array.isArray(raw[field])) {
                result[field] = { ...raw[field] };
            }
        }
        return result;
    }
    function createStore(storage) {
        function read() {
            try { return normalize(JSON.parse(storage.getItem(SAVE_KEY))); }
            catch { return empty(); }
        }
        function write(value) {
            try { storage.setItem(SAVE_KEY, JSON.stringify(value)); return true; }
            catch { return false; }
        }
        function chapter(number) { return chapters[number - 1] || null; }
        function unlocked(number, data = read()) {
            return number === 1 || (number >= 2 && number <= 12 && Boolean(data.choices[String(number - 1)]));
        }
        function complete(number, seconds) {
            const data = read();
            if (!chapter(number) || !unlocked(number, data) || !Number.isFinite(seconds) || seconds < 0) return false;
            data.finished[number] = true;
            data.best[number] = Math.min(data.best[number] ?? Infinity, seconds);
            return write(data);
        }
        function choose(number, choiceId) {
            const data = read(), entry = chapter(number);
            if (!entry || !data.finished[number] || !entry.choices.some(choice => choice.id === choiceId)) return false;
            if (data.choices[number] && data.choices[number] !== choiceId) {
                                                                               
                                                                                        
                for (let index = number + 1; index <= 12; index++) {
                    delete data.choices[index]; delete data.finished[index]; delete data.best[index];
                }
            }
            data.choices[number] = choiceId;
            return write(data);
        }
        function modifierFor(number, data = read()) {
            if (number < 2 || number > 12) return null;
            const choice = chapter(number - 1)?.choices.find(item => item.id === data.choices[number - 1]);
            return choice?.modifier || null;
        }
        function ending(data = read()) {
            if (!data.finished[12] || !data.choices[12]) return null;
            return data.choices[12] === "cable" ? "rescue" : "beacon";
        }
        function profile(data = read()) {
                                                                               
            const decisions = Object.keys(data.choices).length;
            const protective = Object.values(data.choices).filter(id =>
                ["low", "audio", "edge", "lidar", "markers", "manual", "shelter", "seal", "clean", "heating", "sonar", "beacon"].includes(id)).length;
            return decisions < 2 ? "Стиль пилотирования пока не определён" :
                protective >= Math.ceil(decisions / 2) ? "Осторожный исследователь" : "Решительный оператор";
        }
        return { read, unlocked, complete, choose, modifierFor, ending, profile };
    }
    return Object.freeze({ SAVE_KEY, chapters: Object.freeze(chapters), createStore });
});
