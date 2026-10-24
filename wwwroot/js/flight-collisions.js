"use strict";

/*
 * SKYCRAFT: физические объёмы уровней и непрерывная проверка столкновений.
 * Координаты: X/Z — горизонталь, Y — высота, размеры в игровых метрах.
 * Вместо пересчёта тысяч треугольников GLB для физики используются
 * простые AABB-коллайдеры, повторяющие габариты видимых конструкций.
 * Дрон приближён сферой — быстрый и стабильный компромисс для аркадной физики.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftCollisions = api;
})(typeof window !== "undefined" ? window : null, function () {
    const DRONE_RADIUS = 1.02;
    const EPSILON = 0.002;
    const box = (name, center, size) => ({
        name,
        min: { x: center[0] - size[0]/2, y: center[1] - size[1]/2, z: center[2] - size[2]/2 },
        max: { x: center[0] + size[0]/2, y: center[1] + size[1]/2, z: center[2] + size[2]/2 }
    });

    function build(level) {
        const items = [];
        const add = (name, pos, size) => items.push(box(name, pos, size));
        if (!level) return items;
        // Непроницаемые границы мира. Пол и высота обрабатываются отдельно
        // существующим модулем посадки и ограничением высоты.
        const boundary = level.boundary;
        const frontBoundary = Number.isFinite(level.frontBoundary) ? level.frontBoundary : 18;
        const backBoundary = Number.isFinite(level.backBoundary) ? level.backBoundary : -68;
        const centerZ = (frontBoundary + backBoundary) / 2;
        const depth = Math.abs(frontBoundary - backBoundary) + 10;
        for (const sign of [-1, 1]) add("Граница полигона", [sign * (boundary + 1), 6, centerZ], [2, 22, depth]);
        add("Граница полигона", [0, 6, frontBoundary + 1], [boundary * 2 + 4, 22, 2]);
        add("Граница полигона", [0, 6, backBoundary - 1], [boundary * 2 + 4, 22, 2]);

        for (const item of level.obstacles || []) {
            const { x, z, size } = item;
            if (item.type === "crate") {
                add("Грузовой ящик", [x, size/2, z], [size, size, size]);
            } else if (item.type === "tower") {
                // Столб и верхняя площадка вышки имеют разные габариты.
                add("Опора вышки", [x, 3.8, z], [size * .42, 7.6, size * .42]);
                add("Платформа вышки", [x, 7.7, z], [size, .30, size]);
            } else if (item.type === "rock") {
                // По ярусам drawBoulder(), но без мелких декоративных граней.
                add("Скала", [x, size * .27, z], [size * .95, size * .57, size * .77]);
                add("Скала", [x + size * .05, size * .69, z + size * .08],
                    [size * .74, size * .5, size * .65]);
                add("Скала", [x - size * .11, size * 1.02, z],
                    [size * .49, size * .28, size * .48]);
            }
        }

        for (const extra of level.extraColliders || []) {
            if (!extra?.center || !extra?.size) continue;
            items.push(box(extra.name || "Объект сцены", extra.center, extra.size));
        }
        if (level.terrainModel === 'hills-lake-world') {
            // Pine trunks located at their actual mesh instance positions, not invisible legacy
            // scenery. Loaded by hills-terrain.js and scoped to this level.
            const forest = typeof window !== 'undefined' ? window.SkycraftHillsTerrain : null;
            for (const trunk of forest?.colliderBoxes?.() || []) {
                if (!trunk.center || !trunk.size) continue;
                items.push(box(trunk.name || 'Дерево', trunk.center, trunk.size));
            }
        }
        if (level.kind === "hangar") {
            for (const x of [-13.4, 13.4]) for (const z of [-12.7, -4.5, 3.7]) {
                add("Колонна ангара", [x, 4.3, z], [.95, 8.65, .70]);
            }
            for (const x of [-11.8, 11.8]) {
                add("Галерея ангара", [x, 5.4, -9], [3.7, .24, 11]);
                add("Верстак", [Math.sign(x) * 11.5, 1.28, 5.6], [2.5, .3, 1.2]);
            }
            for (const z of [-12.7, -4.5, 3.7]) {
                add("Балка ангара", [0, 8.35, z], [28.8, .5, .72]);
            }
            // Контейнеры и шкафы из hangar-props.glb. Координаты соответствуют
            // Tools/generate_hangar.py — при редактировании GLB меняй их здесь.
            const crates = [[-11,.65,-2.5],[-10.1,.65,-2.5],[-11,1.84,-2.5],
                [11,.68,-7.2],[12.1,.68,-7.2],[11,.68,-5.9],
                [-10,.65,-12],[10,.65,2.3]];
            crates.forEach(([x,y,z],index) => {
                const width = index % 2 ? .95 : 1.15;
                add("Контейнер ангара", [x,y,z], [width,1.23,1.2]);
            });
            for (const x of [-12.3,12.3]) {
                add("Электрошкаф", [x,1.33,-11.6], [1.2,2.65,1.32]);
            }
            // Стойки продолжения трассы созданы из box() в drawGround.
            for (const x of [-14, 14]) for (const z of [-30, -50]) {
                add("Колонна ангара", [x, 4.4, z], [.54, 8.8, .75]);
            }
        } else if (level.kind === "academy") {
            for (const x of [-18.3, 18.3]) for (const z of [15, -5, -25, -47]) {
                add("Мачта академии", [x, 3.2, z], [.64, 6.4, .64]);
                add("Основание мачты", [x, .25, z], [1.4, .5, 1.4]);
            }
            for (const x of [-22, 22]) for (const z of [-9, -32, -47]) {
                add("Контейнер академии", [x, 1.1, z], [3.1, 2.2, 4.3]);
            }
            for (const z of [15, -5, -25, -47]) {
                add("Верхняя ферма", [0, 8.3, z], [38, .34, .4]);
            }
        } else if (level.kind === "training") {
            // На открытом полигоне также учитываем видимые деревья.
            for (const x of [-13, 13]) for (const z of [-4, -25, -48]) {
                add("Дерево", [x, 2.8, z], [1.5, 4.3, 1.5]);
            }
        } else if (level.kind === "canyon") {
            // Дополнительные стены каньона, видимые в drawGround().
            for (let z = -57; z <= 17; z += 9) {
                for (const x of [-13, -10, 10, 13]) {
                    const size = 6 + (Math.abs(z + x) % 4);
                    add("Скала каньона", [x, size * .45, z],
                        [size * .91, size * .91, size * .7]);
                }
            }
        }
        return items;
    }

    // Sweep ray от центра дрона к целевой точке через AABB,
    // расширенный на его радиус (Minkowski sum). Не пропускает тонкую стену
    // даже при больших dt / высоких скоростях.
    function sweepBox(from, to, collider, radius = DRONE_RADIUS) {
        let enter = 0, leave = 1;
        let normal = null;
        for (const axis of ["x", "y", "z"]) {
            const lower = collider.min[axis] - radius;
            const upper = collider.max[axis] + radius;
            const delta = to[axis] - from[axis];
            if (Math.abs(delta) < 1e-9) {
                if (from[axis] < lower || from[axis] > upper) return null;
                continue;
            }
            const t1 = (lower - from[axis]) / delta;
            const t2 = (upper - from[axis]) / delta;
            const near = Math.min(t1, t2);
            const far = Math.max(t1, t2);
            if (near >= enter) {
                enter = near;
                normal = { x: 0, y: 0, z: 0 };
                normal[axis] = delta > 0 ? -1 : 1;
            }
            leave = Math.min(leave, far);
            if (enter > leave) return null;
        }
        if (enter > 1 || leave < 0) return null;
        if (normal === null) {
            // Уже внутри коллайдера. Выталкиваем в сторону ближайшей грани.
            let distance = Infinity;
            for (const axis of ["x", "y", "z"]) {
                for (const [side, sign] of [[collider.min[axis] - radius, -1], [collider.max[axis] + radius, 1]]) {
                    const d = Math.abs(from[axis] - side);
                    if (d < distance) {
                        distance = d;
                        normal = { x: 0, y: 0, z: 0 };
                        normal[axis] = sign;
                    }
                }
            }
        }
        return { t: Math.max(0, enter), normal, collider };
    }

    function sweep(from, to, colliders, radius = DRONE_RADIUS) {
        let hit = null;
        for (const collider of colliders || []) {
            const candidate = sweepBox(from, to, collider, radius);
            if (candidate && (!hit || candidate.t < hit.t)) hit = candidate;
        }
        return hit;
    }

    function supportHeightAt(x, z, colliders, referenceY = Infinity, radius = DRONE_RADIUS) {
        let best = null;
        for (const collider of colliders || []) {
            if (x < collider.min.x - radius * 0.2 || x > collider.max.x + radius * 0.2 ||
                z < collider.min.z - radius * 0.2 || z > collider.max.z + radius * 0.2) continue;
            const top = collider.max.y + radius;
            if (referenceY + radius * 0.35 < top) continue;
            if (best === null || top > best) best = top;
        }
        return best;
    }

    function resolvePenetration(position, velocity, colliders, radius = DRONE_RADIUS, maxIterations = 8) {
        let resolved = null;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let best = null;
            for (const collider of colliders || []) {
                const minX = collider.min.x - radius, maxX = collider.max.x + radius;
                const minY = collider.min.y - radius, maxY = collider.max.y + radius;
                const minZ = collider.min.z - radius, maxZ = collider.max.z + radius;
                if (position.x <= minX || position.x >= maxX ||
                    position.y <= minY || position.y >= maxY ||
                    position.z <= minZ || position.z >= maxZ) continue;

                const overlaps = [
                    { axis: "x", sign: -1, depth: position.x - minX },
                    { axis: "x", sign: 1, depth: maxX - position.x },
                    { axis: "y", sign: -1, depth: position.y - minY },
                    { axis: "y", sign: 1, depth: maxY - position.y },
                    { axis: "z", sign: -1, depth: position.z - minZ },
                    { axis: "z", sign: 1, depth: maxZ - position.z }
                ];
                overlaps.sort((a, b) => a.depth - b.depth);
                const candidate = overlaps[0];
                if (!best || candidate.depth < best.depth) {
                    best = { ...candidate, collider };
                }
            }
            if (!best) break;
            const normal = { x: 0, y: 0, z: 0 };
            normal[best.axis] = best.sign;
            position[best.axis] += best.sign * (best.depth + EPSILON);
            const inwardSpeed = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
            if (inwardSpeed < 0) {
                velocity.x -= inwardSpeed * normal.x;
                velocity.y -= inwardSpeed * normal.y;
                velocity.z -= inwardSpeed * normal.z;
            }
            if (!resolved) resolved = {
                name: best.collider.name,
                impact: Math.max(0, -inwardSpeed),
                normal
            };
        }
        return resolved;
    }

    function move(from, target, velocity, colliders, radius = DRONE_RADIUS) {
        let position = { ...from };
        let remaining = {
            x: target.x - from.x, y: target.y - from.y, z: target.z - from.z
        };
        const v = { ...velocity };
        let first = null;
        const initialOverlap = resolvePenetration(position, v, colliders, radius);
        if (initialOverlap && !first) first = { name: initialOverlap.name, impact: initialOverlap.impact };
        // До четырёх столкновений за кадр — скольжение вдоль стен/углов.
        for (let iteration = 0; iteration < 4; iteration++) {
            const end = { x: position.x + remaining.x, y: position.y + remaining.y, z: position.z + remaining.z };
            const hit = sweep(position, end, colliders, radius);
            if (!hit) { position = end; break; }
            const factor = Math.max(0, hit.t - EPSILON);
            for (const axis of ["x", "y", "z"]) position[axis] += remaining[axis] * factor;
            const n = hit.normal;
            const inwardSpeed = v.x*n.x + v.y*n.y + v.z*n.z;
            if (!first) first = { name: hit.collider.name, impact: Math.max(0, -inwardSpeed) };
            if (inwardSpeed < 0) {
                // Потеря энергии на удар; небольшая упругая отдача.
                for (const axis of ["x", "y", "z"]) v[axis] -= inwardSpeed * n[axis] * 1.02;
                for (const axis of ["x", "y", "z"]) if (!n[axis]) v[axis] *= 0.88;
            }
            const left = 1 - factor;
            const into = remaining.x*n.x + remaining.y*n.y + remaining.z*n.z;
            for (const axis of ["x", "y", "z"]) {
                remaining[axis] = (remaining[axis] - Math.min(0, into) * n[axis]) * left;
                position[axis] += n[axis] * (EPSILON * 2);
            }
            const overlap = resolvePenetration(position, v, colliders, radius);
            if (!first && overlap) first = { name: overlap.name, impact: overlap.impact };
            if (Math.hypot(remaining.x, remaining.y, remaining.z) < EPSILON) break;
        }
        const finalOverlap = resolvePenetration(position, v, colliders, radius);
        if (!first && finalOverlap) first = { name: finalOverlap.name, impact: finalOverlap.impact };
        return { position, velocity: v, collision: first };
    }

    return { DRONE_RADIUS, box, build, sweepBox, sweep, supportHeightAt, resolvePenetration, move };
});
