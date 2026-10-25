"use strict";

  
                                                    
                                                             
                                                            
   
const baseLevels = [
    {
        id: "hangar",
        name: "Первый взлёт",
        subtitle: "АНГАР 01 / ОБУЧЕНИЕ",
        description: "Лёгкая трасса с широкими воротами. Освой управление высотой и полёт вперёд.",
        difficulty: "Легко",
        accent: "#887dff",
        skyTop: "#091320",
        skyBottom: "#263651",
        floor: "#263247",
        kind: "hangar",
        start: { x: 0, y: 2.2, z: 11 },
        checkpoints: [
            { x: 0, y: 2.4, z: 1, radius: 2.8 },
            { x: 3, y: 3.2, z: -10, radius: 2.8 },
            { x: -3, y: 2.7, z: -22, radius: 2.8 },
            { x: 0, y: 3.5, z: -34, radius: 3 }
        ],
        obstacles: [
            { type: "crate", x: -5.5, z: -7, size: 2.1 },
            { type: "crate", x: 7, z: -17, size: 2.2 },
            { type: "crate", x: -7, z: -27, size: 2.0 }
        ],
        boundary: 15
    },
    {
        id: "training",
        name: "Полигон",
        subtitle: "ПОЛИГОН 02 / СЛАЛОМ",
        description: "Пролетай между вышками и контейнерами на открытом тренировочном поле.",
        difficulty: "Средне",
        accent: "#49cdbb",
        skyTop: "#122133",
        skyBottom: "#416272",
        floor: "#263d3d",
        kind: "training",
        start: { x: 0, y: 2.2, z: 11 },
        checkpoints: [
            { x: -5, y: 2.8, z: 0, radius: 2.8 },
            { x: 5, y: 3.2, z: -12, radius: 2.8 },
            { x: -5, y: 3.8, z: -24, radius: 2.8 },
            { x: 4, y: 3.1, z: -37, radius: 2.8 },
            { x: 0, y: 3.4, z: -48, radius: 3 }
        ],
        obstacles: [
            { type: "tower", x: 0, z: -4, size: 2.3 },
            { type: "crate", x: -3, z: -13, size: 2.2 },
            { type: "tower", x: 1, z: -22, size: 2.8 },
            { type: "crate", x: -2, z: -33, size: 2.3 },
            { type: "tower", x: -6, z: -42, size: 2.5 }
        ],
        boundary: 17
    },
    {
        id: "canyon",
        name: "Каменный каньон",
        subtitle: "КАНЬОН 03 / МАНЁВР",
        description: "Узкий маршрут между скалами с подъёмами и сменой направления.",
        difficulty: "Сложно",
        accent: "#efab6d",
        skyTop: "#1c1e30",
        skyBottom: "#5e4554",
        floor: "#4a3940",
        kind: "canyon",
        start: { x: 0, y: 2.5, z: 11 },
        checkpoints: [
            { x: 0, y: 3.2, z: 0, radius: 2.6 },
            { x: -3, y: 4.2, z: -12, radius: 2.6 },
            { x: 4, y: 4.5, z: -23, radius: 2.6 },
            { x: -2, y: 3.3, z: -36, radius: 2.6 },
            { x: 0, y: 5.1, z: -49, radius: 3 }
        ],
        obstacles: [
            { type: "rock", x: 6.5, z: -4, size: 4.2 },
            { type: "rock", x: -6.8, z: -8, size: 5.4 },
            { type: "rock", x: 6.5, z: -17, size: 5.8 },
            { type: "rock", x: -6.3, z: -25, size: 5.3 },
            { type: "rock", x: 7, z: -33, size: 5.4 },
            { type: "rock", x: -7, z: -42, size: 6.1 }
        ],
        boundary: 10
    },
    {
        id: "academy",
        tutorial: true,
        name: "Академия пилота",
        subtitle: "АКАДЕМИЯ / ОБЯЗАТЕЛЬНОЕ ОБУЧЕНИЕ",
        description: "От запуска моторов до безопасной посадки — все основы управления квадрокоптером.",
        difficulty: "Обучение",
        accent: "#62d6ca",
        skyTop: "#081320", skyBottom: "#294256", floor: "#1b2d3a",
        kind: "academy",
        start: { x: 0, y: 1.87, z: 12 },
        checkpoints: [
            { x: 0, y: 5.2, z: -11, radius: 3.5 },
            { x: 3, y: 4.8, z: -26, radius: 3.5 }
        ],
        obstacles: [], boundary: 38
    }
];

window.SkycraftLevels = Object.freeze(baseLevels.concat(window.SkycraftCampaignLevels?.storyLevels || []));
