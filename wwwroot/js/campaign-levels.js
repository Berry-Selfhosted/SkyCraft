"use strict";
/*
 * Сюжетные вылеты кампании на одной большой 3D-карте.
 * Разные главы используют разные сектора общей спасательной долины,
 * поэтому игра ощущается как единая операция, а не набор разрозненных арен.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftCampaignLevels = api;
})(typeof window !== "undefined" ? window : null, function () {
    const sharedBounds = Object.freeze({ boundary: 138, frontBoundary: 125, backBoundary: -138 });

    const palettes = {
        forest: { skyTop: "#7eb1e3", skyBottom: "#dff1ff", floor: "#72a659", accent: "#68c8ff" },
        river: { skyTop: "#77addf", skyBottom: "#dcefff", floor: "#76a765", accent: "#5fbdf2" },
        cliff: { skyTop: "#82b5e4", skyBottom: "#e6f4ff", floor: "#86a05f", accent: "#f4b16f" },
        lake: { skyTop: "#7eb3ea", skyBottom: "#dff3ff", floor: "#79ae63", accent: "#59c4ff" },
        deadforest: { skyTop: "#7198bc", skyBottom: "#d4e5f2", floor: "#668a54", accent: "#b9d66c" },
        gorge: { skyTop: "#7ba6d0", skyBottom: "#deeeff", floor: "#7e9a61", accent: "#f5c27c" },
        torrent: { skyTop: "#73a0cd", skyBottom: "#d4ebff", floor: "#6e9760", accent: "#63c7ff" },
        storm: { skyTop: "#6d8fb5", skyBottom: "#cedfed", floor: "#6a8d59", accent: "#5cb8eb" },
        mud: { skyTop: "#88a8c3", skyBottom: "#ddebfa", floor: "#789354", accent: "#d9b06d" },
        snow: { skyTop: "#9bc0e9", skyBottom: "#f2f8ff", floor: "#8ea88a", accent: "#8ad8ff" },
        cave: { skyTop: "#7c9fc4", skyBottom: "#dbeaf8", floor: "#6f9159", accent: "#a8bfff" },
        summit: { skyTop: "#88b6e4", skyBottom: "#edf7ff", floor: "#86a36b", accent: "#ffd37a" }
    };

    const sectors = [
        { x: -42, z: -18, biome: "forest", subtitle: "СЕКТОР ALFA / ЛЕСНАЯ ОПУШКА", weather: "Порывистый лесной ветер" },
        { x: -10, z: -58, biome: "river", subtitle: "СЕКТОР BRAVO / РАЗЛИВ РЕКИ", weather: "Вода, блики и шум потока" },
        { x: 36, z: -46, biome: "cliff", subtitle: "СЕКТОР CHARLIE / КРАЙ РАЗЛОМА", weather: "Вертикальные потоки и каменная кромка" },
        { x: 10, z: -122, biome: "lake", subtitle: "СЕКТОР DELTA / ТУМАННЫЙ БЕРЕГ", weather: "Туман и испарения озера" },
        { x: -58, z: -112, biome: "deadforest", subtitle: "СЕКТОР ECHO / НОЧНОЙ БУРЕЛОМ", weather: "Темнота и лабиринт из стволов" },
        { x: 50, z: -112, biome: "gorge", subtitle: "СЕКТОР FOXTROT / ДНО УЩЕЛЬЯ", weather: "Потеря GPS и рваная связь" },
        { x: 22, z: -150, biome: "torrent", subtitle: "СЕКТОР GOLF / ГОРНЫЙ ПОТОК", weather: "Эффект аэродинамической трубы" },
        { x: 18, z: -176, biome: "storm", subtitle: "СЕКТОР HOTEL / ШТОРМ НАД ОЗЕРОМ", weather: "Дождь, волны и ветер" },
        { x: -26, z: -180, biome: "mud", subtitle: "СЕКТОР INDIA / СЕЛЕВОЙ СКЛОН", weather: "Грязь, пыль и нулевая видимость" },
        { x: 58, z: -190, biome: "snow", subtitle: "СЕКТОР JULIET / СНЕЖНАЯ ЛИНИЯ", weather: "Холод и белая мгла" },
        { x: 38, z: -197, biome: "cave", subtitle: "СЕКТОР KILO / СКРЫТЫЙ ГРОТ", weather: "Эхо, теснота и тьма" },
        { x: 0, z: -202, biome: "summit", subtitle: "СЕКТОР LIMA / ВЕРШИНА И ЭПИЦЕНТР", weather: "Ураган и предельная нагрузка" }
    ];


    // Start pads and gates sampled directly from the converted Blender terrain.
    // Each chapter occupies a distinct place of the same 300 × 280 m level.
    const terrainRoutes = [
        { start: { x: -68, y: 12.961, z: 69 }, checkpoints: [
            { x: -58, y: 16.458, z: 60, radius: 5.5 },
            { x: -74, y: 14.220, z: 46, radius: 5.5 },
            { x: -52, y: 17.776, z: 34, radius: 5.5 }
        ] },
        { start: { x: -43, y: 15.536, z: 75 }, checkpoints: [
            { x: -54, y: 17.941, z: 67, radius: 5.5 },
            { x: -36, y: 10.991, z: 58, radius: 5.5 },
            { x: -49, y: 10.293, z: 42, radius: 5.5 }
        ] },
        { start: { x: -6, y: 19.216, z: 79 }, checkpoints: [
            { x: 6, y: 35.396, z: 68, radius: 5.5 },
            { x: -14, y: 14.516, z: 56, radius: 5.5 },
            { x: 10, y: 20.622, z: 44, radius: 5.5 }
        ] },
        { start: { x: 48, y: 29.991, z: 81 }, checkpoints: [
            { x: 40, y: 32.786, z: 73, radius: 5.5 },
            { x: 55, y: 22.232, z: 59, radius: 5.5 },
            { x: 33, y: 8.874, z: 47, radius: 5.5 }
        ] },
        { start: { x: 72, y: 18.943, z: 40 }, checkpoints: [
            { x: 80, y: 19.379, z: 28, radius: 5.5 },
            { x: 67, y: 9.107, z: 17, radius: 5.5 },
            { x: 84, y: 16.967, z: 4, radius: 5.5 }
        ] },
        { start: { x: 82, y: 14.041, z: -41 }, checkpoints: [
            { x: 73, y: 7.131, z: -50, radius: 5.5 },
            { x: 84, y: 16.274, z: -64, radius: 5.5 },
            { x: 68, y: 18.540, z: -79, radius: 5.5 }
        ] },
        { start: { x: 64, y: 15.798, z: -90 }, checkpoints: [
            { x: 73, y: 15.333, z: -101, radius: 5.5 },
            { x: 59, y: 15.628, z: -114, radius: 5.5 },
            { x: 78, y: 17.557, z: -126, radius: 5.5 }
        ] },
        { start: { x: 2, y: 19.456, z: -93 }, checkpoints: [
            { x: -8, y: 17.575, z: -105, radius: 5.5 },
            { x: 6, y: 16.244, z: -118, radius: 5.5 },
            { x: -15, y: 16.657, z: -124, radius: 5.5 }
        ] },
        { start: { x: -63, y: 12.844, z: -96 }, checkpoints: [
            { x: -55, y: 16.372, z: -108, radius: 5.5 },
            { x: -70, y: 17.161, z: -112, radius: 5.5 },
            { x: -48, y: 17.100, z: -120, radius: 5.5 }
        ] },
        { start: { x: -76, y: 12.050, z: 65 }, checkpoints: [
            { x: -85, y: 14.447, z: 53, radius: 5.5 },
            { x: -71, y: 10.832, z: 41, radius: 5.5 },
            { x: -89, y: 10.922, z: 28, radius: 5.5 }
        ] },
        { start: { x: -96, y: 13.750, z: 106 }, checkpoints: [
            { x: -87, y: 16.979, z: 95, radius: 5.5 },
            { x: -101, y: 16.677, z: 83, radius: 5.5 },
            { x: -83, y: 15.992, z: 70, radius: 5.5 }
        ] },
        { start: { x: -16, y: 12.372, z: 112 }, checkpoints: [
            { x: -26, y: 16.595, z: 101, radius: 5.5 },
            { x: -12, y: 17.330, z: 88, radius: 5.5 },
            { x: -31, y: 18.026, z: 75, radius: 5.5 }
        ] }
    ];

    const storyLevels = sectors.map((sector, index) => {
        const chapter = window.SkycraftCampaign?.chapters?.[index];
        const palette = palettes[sector.biome] || palettes.forest;
        const storyId = chapter?.id || `story-${String(index + 1).padStart(2, "0")}`;
        const route = terrainRoutes[index];
        return Object.freeze({
            id: storyId,
            story: true,
            storyIndex: index + 1,
            tutorial: false,
            kind: "story",
            openWorld: true,
            name: chapter?.title || `Глава ${index + 1}`,
            subtitle: sector.subtitle,
            description: chapter?.summary || "Сюжетный вылет",
            difficulty: chapter?.difficulty || "Операция",
            accent: palette.accent,
            skyTop: palette.skyTop,
            skyBottom: palette.skyBottom,
            floor: palette.floor,
            terrainModel: "hills-lake-world",
            // Only the supplied textured forest GLB is drawn by Three.js.
            weather: sector.weather,
            sectorName: sector.subtitle,
            sun: { x: index < 6 ? 0.76 : 0.68, y: index % 2 ? 0.17 : 0.22 },
            start: route.start,
            checkpoints: route.checkpoints,
            // No invisible legacy obstacles: solid collisions come from
            // hills-lake-heightmap.json and native-pine trunk colliders.
            obstacles: [],
            extraColliders: [],
            ...sharedBounds
        });
    });

    return Object.freeze({ storyLevels });
});
