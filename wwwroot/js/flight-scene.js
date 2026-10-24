"use strict";

/*
 * SKYCRAFT — игровой рендер, инерционная физика и две камеры квадрокоптера.
 * Наследует загрузку GLB-моделей, камеру и проекцию из drone-scene.js.
 * Для 3D-деталей используется тот же WebGL-рендер, что и в мастерской.
 */
(function () {
    const TWO_PI = Math.PI * 2;
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    class FlightScene extends window.SkycraftDroneScene {
        constructor(canvas, onChange) {
            super(canvas);
            this.onChange = onChange;
            this.level = null;
            this.mode = "ready";
            this.time = 0;
            this.batteryUsed = 0;
            this.flightPhase = "disarmed";
            this.completionPending = false;
            this.failsafeLanding = false;
            this.lastTouchdown = null;
            this.flightSpecs = { weight: 12, speed: 60, time: 5, range: 800 };
            this.completed = 0;
            this.tutorial = null;
            this.keys = new Set();
            this.physicsState = window.SkycraftFlightPhysics.createState();
            this.rotorState = window.SkycraftRotorDynamics?.createState() || null;
            this.position = this.physicsState.position;
            this.velocity = this.physicsState.velocity;
            this.attitude = this.physicsState.attitude;
            this.cameraMode = "third";
            this.yaw = 0.22;       // смещение камеры относительно направления носа
            this.elevation = 0.38;
            this.distance = 17;
            this.lastTimestamp = performance.now();
            this.lastStatusRefresh = 0;
            this.lastScanNotice = -20;
            this.collisionNoticeAt = -100;
            this.hitFlash = 0;
            this.boundKeyboard = this.handleKey.bind(this);
            window.addEventListener("keydown", this.boundKeyboard);
            window.addEventListener("keyup", this.boundKeyboard);
            window.addEventListener("blur", () => {
                this.keys.clear();
                if (this.mode === "running") this.pause();
            });

            // Конфигурация назначается только после выбора СОБРАННОГО дрона
            // на странице полёта (flight-game.js), не из черновика мастерской.
        }

        setFlightSpecs(specs) {
            // Защищаем физику от повреждённых/старых записей localStorage.
            const base = { weight: 12, speed: 60, time: 5, range: 800 };
            this.flightSpecs = window.SkycraftFlightPhysics.sanitizeSpecs({ ...base, ...specs });
            this.reset();
        }

        setConfiguration(configuration) {
            super.setConfiguration(configuration);
            // При выборе другой сборки отклики ESC и ограничения RPM тоже меняются.
            this.rotorState = window.SkycraftRotorDynamics?.createState() || null;
        }

        get remainingBattery() {
            const limit = (this.flightSpecs?.time ?? 5) * 60;
            return clamp(100 * (1 - (this.batteryUsed || 0) / limit), 0, 100);
        }

        get distanceFromStart() {
            if (!this.level) return 0;
            return Math.hypot(this.position.x - this.level.start.x,
                this.position.z - this.level.start.z);
        }

        get currentObjective() {
            return this.level?.checkpoints?.[this.completed] || null;
        }

        objectiveDistance() {
            const current = this.currentObjective;
            if (!current) return Infinity;
            return Math.hypot(this.position.x - current.x,
                this.position.y - current.y, this.position.z - current.z);
        }

        objectiveNearby(radiusFactor = 1.75) {
            const current = this.currentObjective;
            return !!current && this.objectiveDistance() < (current.radius || 4) * radiusFactor;
        }

        confirmStoryObjective() {
            if (!this.level?.story || this.completionPending) return false;
            const current = this.currentObjective;
            if (!current) return false;
            if (!this.objectiveNearby()) {
                this.notify({ campaignAction: "АИДА: подлети к человеку и нажми F" });
                return false;
            }
            let message = `Найден человек: ${this.completed + 1} / ${this.level.checkpoints.length}`;
            if (this.campaignState && window.SkycraftCampaignEffects?.needsAction(this.campaignState.id)) {
                message = window.SkycraftCampaignEffects.action(this.campaignState,
                    { near: true, index: this.completed }) || message;
            }
            this.completed++;
            if (this.completed === this.level.checkpoints.length && !this.tutorial) {
                this.completionPending = true;
                this.flightPhase = "landing";
                this.keys.clear();
            }
            this.updateTutorial(0);
            this.notify({ checkpoint: true, campaignAction: message });
            return true;
        }

        selectLevel(level) {
            this.level = level;
            this.campaignModifier = level.story && window.SkycraftCampaign
                ? window.SkycraftCampaign.createStore(window.SkycraftProfiles.storage).modifierFor(level.storyIndex)
                : null;
            this.campaignState = window.SkycraftCampaignEffects?.create(this.campaignModifier) || null;
            this.colliders = window.SkycraftCollisions?.build(level) || [];
            // More distant camera to match the 300 m playable scenery.
            this.distance = level.story ? 23 : 17;
            this.yaw = level.story ? 0 : 0.22;
            if (level.terrainModel === 'hills-lake-world') {
                // Height data and collision proxies match the exported GLB, not
                // the old procedural world. Rebuild when async data arrives.
                window.SkycraftHillsTerrain?.load().then(() => {
                    if (this.level !== level) return;
                    this.colliders = window.SkycraftCollisions?.build(level) || [];
                    if (['armed', 'disarmed'].includes(this.flightPhase)) {
                        this.position.y = window.SkycraftHillsTerrain.groundAt(
                            this.position.x, this.position.z,
                            window.SkycraftFlightOperations.GROUND_Y);
                    }
                }).catch(error => console.warn('SKYCRAFT: hills/lake collision map unavailable', error));
            }
            this.reset();
        }

        reset() {
            if (!this.level) return;
            const ground = window.SkycraftFlightOperations.GROUND_Y;
            this.physicsState = window.SkycraftFlightPhysics.createState({
                x: this.level.start.x, y: this.level.start.y ?? ground, z: this.level.start.z
            });
            this.rotorState = window.SkycraftRotorDynamics?.createState() || null;
            this.position = this.physicsState.position;
            this.velocity = this.physicsState.velocity;
            this.attitude = this.physicsState.attitude;
            this.mode = "ready";
            this.time = 0;
            this.batteryUsed = 0;
            this.flightPhase = "disarmed";
            this.completionPending = false;
            this.failsafeLanding = false;
            this.lastTouchdown = null;
            this.collisionCount = 0;
            this.completed = 0;
            this.tutorial = this.level.tutorial && window.SkycraftTutorial
                ? window.SkycraftTutorial.create() : null;
            this.hitFlash = 0;
            this.campaignState = window.SkycraftCampaignEffects?.create(this.campaignModifier) || null;
            this.lastStatusRefresh = 0;
            this.lastScanNotice = -20;
            this.collisionNoticeAt = -100;
            this.keys.clear();
            this.notify();
        }

        start() {
            if (!this.level) return;
            if (this.mode === "done" || this.mode === "depleted") this.reset();
            if (this.mode === "paused") { this.pause(); return; }
            if (this.mode !== "ready") return;
            this.mode = "running";
            // Миссия запущена, но моторы выключены: игрок запускает их вручную.
            this.flightPhase = "disarmed";
            this.updateTutorial(0);
            this.notify();
        }

        armMotors() {
            if (this.mode !== "running" || this.flightPhase !== "disarmed" ||
                this.remainingBattery <= 0) return false;
            this.flightPhase = "armed";
            this.keys.clear();
            this.updateTutorial(0);
            this.notify();
            return true;
        }

        disarmMotors() {
            // Безопасность: при полёте выключить моторы вручную нельзя.
            if (this.mode !== "running" || this.flightPhase !== "armed") return false;
            this.flightPhase = "disarmed";
            this.keys.clear();
            this.notify();
            return true;
        }

        takeoff() {
            if (this.mode !== "running" || this.flightPhase !== "armed" ||
                this.remainingBattery <= 0) return false;
            this.flightPhase = "takeoff";
            this.keys.clear();
            this.notify();
            return true;
        }

        land() {
            if (this.mode !== "running" || this.failsafeLanding || this.completionPending) return false;
            if (this.flightPhase === "landing") {
                // Прервать автопосадку можно только до контакта с землёй.
                this.flightPhase = "flying";
            } else if (["flying", "takeoff"].includes(this.flightPhase)) {
                this.flightPhase = "landing";
                if (this.tutorial && window.SkycraftTutorial.active(this.tutorial).id === "landing") {
                    this.tutorial.landingOrdered = true;
                }
            } else return false;
            this.keys.clear();
            this.notify();
            return true;
        }

        touchGround(contact) {
            this.flightPhase = "disarmed";
            this.keys.clear();
            this.lastTouchdown = contact.hard ? "hard" : "soft";
            // На земле моторы обесточены, их инерция видна в RPM-анимации.
            if (this.tutorial) {
                // Жёсткое касание не даёт зачёта: курсант должен повторить посадку.
                if (contact.hard) this.tutorial.landingOrdered = false;
                this.updateTutorial(0, { touchdown: !contact.hard });
                if (this.tutorial.finished) this.mode = "done";
                else if (this.failsafeLanding) this.mode = "depleted";
            } else if (this.completionPending) this.mode = "done";
            else if (this.failsafeLanding) this.mode = "depleted";
            this.notify({ touchdown: this.lastTouchdown });
        }

        updateTutorial(dt, extra = {}) {
            if (!this.tutorial || !window.SkycraftTutorial) return;
            const changed = window.SkycraftTutorial.update(this.tutorial, {
                mode: this.mode,
                flightPhase: this.flightPhase,
                altitude: this.altitudeAboveGround,
                horizontalSpeed: Math.hypot(this.velocity.x, this.velocity.z),
                position: this.position,
                heading: this.attitude.yaw,
                cameraMode: this.cameraMode,
                completed: this.completed,
                ...extra
            }, dt);
            if (changed) this.notify({ tutorialAdvance: true });
        }

        pause() {
            if (this.mode === "running") {
                this.mode = "paused";
                this.keys.clear();
            } else if (this.mode === "paused") {
                this.mode = "running";
            }
            this.notify();
        }

        setCameraMode(mode) {
            if (!["first", "third"].includes(mode)) return;
            this.cameraMode = mode;
            // При смене ракурса сбрасываем смещение от предыдущей камеры,
            // но НЕ состояние физики и НЕ пройденные ворота.
            this.yaw = mode === "first" ? 0 : 0.22;
            this.elevation = mode === "first" ? 0 : 0.38;
            this.notify();
        }

        toggleCameraMode() {
            this.setCameraMode(this.cameraMode === "third" ? "first" : "third");
        }

        // Переопределяем обработчик конструктора: FPV допускает взгляд вниз.
        bindInteraction() {
            this.canvas.addEventListener("pointerdown", (event) => {
                this.dragPointer = event.pointerId;
                this.previousPointer = [event.clientX, event.clientY];
                this.canvas.setPointerCapture(event.pointerId);
            });
            this.canvas.addEventListener("pointermove", (event) => {
                if (this.dragPointer !== event.pointerId || !this.previousPointer) return;
                const dx = event.clientX - this.previousPointer[0];
                const dy = event.clientY - this.previousPointer[1];
                this.yaw += dx * 0.006;
                this.elevation += dy * 0.004;
                if (this.cameraMode === "first") {
                    this.yaw = clamp(this.yaw, -0.85, 0.85);
                    this.elevation = clamp(this.elevation, -0.55, 0.55);
                } else {
                    this.elevation = clamp(this.elevation, 0.11, 0.82);
                }
                this.previousPointer = [event.clientX, event.clientY];
            });
            const stop = () => { this.dragPointer = null; this.previousPointer = null; };
            this.canvas.addEventListener("pointerup", stop);
            this.canvas.addEventListener("pointercancel", stop);
            this.canvas.addEventListener("wheel", (event) => {
                if (this.cameraMode === "third") {
                    event.preventDefault();
                    this.distance = clamp(this.distance + Math.sign(event.deltaY) * 0.85, 6.5, 24);
                }
            }, { passive: false });
        }

        handleKey(event) {
            const key = event.code;
            const controls = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
                "Space", "ShiftLeft", "ShiftRight", "Escape", "KeyV", "KeyM", "KeyL", "KeyF", "KeyC"];
            if (!controls.includes(key)) return;
            // Esc остаётся рабочим, даже если фокус на кнопке меню паузы.
            if (key === "Escape" && event.type === "keydown" && !event.repeat) {
                const settings = typeof document === "undefined" ? null : document.getElementById("settings-overlay");
                if (!settings || settings.hidden) {
                    if (["running", "paused"].includes(this.mode)) this.pause();
                }
                return;
            }
            if (event.target instanceof HTMLElement &&
                (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(event.target.tagName) ||
                 event.target.isContentEditable)) return;
            if (key === "KeyV" && event.type === "keydown" && !event.repeat) {
                this.toggleCameraMode();
                return;
            }
            if (this.mode !== "running") return;
            if (key === "KeyF") {
                if (event.type === "keydown" && !event.repeat) {
                    if (this.level?.story && this.confirmStoryObjective()) return;
                    if (this.campaignState) {
                        const message = window.SkycraftCampaignEffects?.action(this.campaignState,
                            { near: this.objectiveNearby(), index: this.completed });
                        if (message) this.notify({ campaignAction: message });
                    }
                }
                return;
            }
            if (key === "KeyC") {
                if (event.type === "keydown" && !event.repeat && this.campaignState) {
                    const message = window.SkycraftCampaignEffects?.action(this.campaignState,
                        { near: this.objectiveNearby(), index: this.completed });
                    if (message) this.notify({ campaignAction: message });
                }
                return;
            }
            if (key === "KeyM") {
                if (event.type === "keydown" && !event.repeat) {
                    if (this.flightPhase === "disarmed") this.armMotors();
                    else this.disarmMotors();
                }
                return;
            }
            if (key === "KeyL") {
                if (event.type === "keydown" && !event.repeat) this.land();
                return;
            }
            if (["Space", "ShiftLeft", "ShiftRight"].includes(key)) event.preventDefault();
            if (key === "Space" && event.type === "keydown" && this.flightPhase === "armed") {
                if (!event.repeat) this.takeoff();
                return;
            }
            if (!["flying", "takeoff"].includes(this.flightPhase)) return;
            if (event.type === "keydown") this.keys.add(key);
            else this.keys.delete(key);
        }

        get speed() {
            const kmh = Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z) * 3.6;
            return kmh < 0.05 ? 0 : kmh;
        }

        // HUD altitude is above local terrain, not world Y or mountain elevation.
        get altitudeAboveGround() {
            const ground = window.SkycraftFlightOperations.GROUND_Y;
            const height = this.level?.terrainModel === 'hills-lake-world'
                ? window.SkycraftHillsTerrain?.groundAt(this.position.x, this.position.z, ground)
                : ground;
            return Math.max(0, this.position.y - (Number.isFinite(height) ? height : ground));
        }

        notify(extra = null) {
            this.onChange?.({
                mode: this.mode,
                level: this.level,
                time: this.time,
                completed: this.completed,
                altitude: this.altitudeAboveGround,
                speed: this.speed,
                battery: this.remainingBattery,
                radius: this.distanceFromStart,
                cameraMode: this.cameraMode || "third",
                heading: this.attitude?.yaw ?? 0,
                pitch: this.attitude?.pitch ?? 0,
                roll: this.attitude?.roll ?? 0,
                rpm: window.SkycraftRotorDynamics?.averageRpm(this.rotorState) || 0,
                flightPhase: this.flightPhase,
                motorsArmed: this.flightPhase !== "disarmed",
                failsafeLanding: this.failsafeLanding,
                maxSpeed: this.flightSpecs?.speed ?? 60,
                maxRange: window.SkycraftCampaignEffects?.range(this.campaignState, this.flightSpecs?.range ?? 800)
                    ?? (this.flightSpecs?.range ?? 800),
                collisionCount: this.collisionCount || 0,
                campaign: this.level?.story ? {
                    chapter: this.level.storyIndex,
                    modifier: this.campaignModifier,
                    name: window.SkycraftCampaignEffects?.display(this.campaignModifier) || "НОРМА",
                    description: window.SkycraftCampaignEffects?.description(this.campaignModifier) || "Стандартная разведка",
                    visual: window.SkycraftCampaignEffects?.visual(this.campaignState) || "normal",
                    tuned: Boolean(this.campaignState?.tuned),
                    confirmedIndex: this.campaignState?.confirmedIndex ?? -1
                } : null,
                tutorial: this.tutorial && window.SkycraftTutorial
                    ? window.SkycraftTutorial.details(this.tutorial) : null,
                ...extra
            });
        }

        update(dt) {
            if (this.mode !== "running" || !this.level) return;
            const operation = window.SkycraftFlightOperations;
            const ground = operation.GROUND_Y;
            const supportGroundAt = (x, z, referenceY) => {
                const terrain = this.level.terrainModel === 'hills-lake-world'
                    ? window.SkycraftHillsTerrain?.groundAt(x, z, ground)
                    : ground;
                const support = window.SkycraftCollisions?.supportHeightAt?.(x, z, this.colliders, referenceY);
                const base = Number.isFinite(terrain) ? terrain : ground;
                return Math.max(base, Number.isFinite(support) ? support : base);
            };
            const specs = this.flightSpecs || { weight: 12, speed: 60, time: 5, range: 800 };
            dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.25);
            if (dt <= 0) return;
            this.time += dt;

            // Моторы на земле не создают движения дрона: запрет физический,
            // а не только визуальная блокировка клавиатуры.
            const grounded = ["disarmed", "armed"].includes(this.flightPhase);
            if (grounded) {
                this.position.y = supportGroundAt(this.position.x, this.position.z, this.position.y);
                this.velocity.x = this.velocity.y = this.velocity.z = 0;
                this.attitude.pitch = 0;
                this.attitude.roll = 0;
                this.physicsState.yawRate = 0;
            } else {
                const previous = { ...this.position };
                let input;
                if (this.flightPhase === "landing") {
                    input = operation.landingInput(this.position, this.velocity,
                        this.attitude.yaw, supportGroundAt(this.position.x, this.position.z, this.position.y));
                } else if (this.flightPhase === "takeoff") {
                    input = operation.takeoffInput(this.velocity, this.attitude.yaw);
                } else {
                    input = window.SkycraftFlightPhysics.controlsFromKeys(this.keys);
                    // Third-person steering is CAMERA-relative, so turning the
                    // orbit camera cannot invert W/A/S/D on the screen.
                    // FPV still uses body-relative axes, as in real drone controls.
                    if (this.level.story && this.cameraMode === "third") {
                        input = window.SkycraftFlightOrientation.cameraRelativeInput(input, this.yaw);
                    }
                }
                if (this.level.story && this.campaignState) {
                    input = window.SkycraftCampaignEffects.before(this.campaignState, input, dt);
                }
                window.SkycraftFlightPhysics.step(this.physicsState, input, dt, specs);
                if (this.level.story && this.campaignState) {
                    window.SkycraftCampaignEffects.after(this.campaignState,
                        this.physicsState, dt, window.SkycraftCampaign?.chapters[this.level.storyIndex-1]?.biome,
                        input);
                }
                if (this.flightPhase === "takeoff" &&
                    this.position.y >= Math.max(3.4, this.level.start.y + 0.9)) {
                    this.flightPhase = "flying";
                    this.notify();
                }

                const ceiling = this.level.story
                    ? supportGroundAt(this.position.x, this.position.z, this.position.y) + 35
                    : 11;
                if (this.position.y >= ceiling) {
                    this.position.y = ceiling;
                    this.velocity.y = Math.min(0, this.velocity.y);
                }
                const actualRange = window.SkycraftCampaignEffects?.range(this.campaignState, specs.range) ?? specs.range;
                const rangeLimit = this.distanceFromStart > actualRange;
                let hit = null;
                if (window.SkycraftCollisions && this.colliders) {
                    // Проверка всего перемещения, а не только конечной точки:
                    // дрон не проходит сквозь тонкие стены при высокой скорости.
                    const result = window.SkycraftCollisions.move(
                        previous, { ...this.position }, this.velocity, this.colliders);
                    Object.assign(this.position, result.position);
                    Object.assign(this.velocity, result.velocity);
                    hit = result.collision;
                } else if (this.position.y > ground + .04 && this.collides()) {
                    // Обратная совместимость, если модуль коллизий не загружен.
                    Object.assign(this.position, previous);
                    this.velocity.x = this.velocity.y = this.velocity.z = 0;
                    hit = { name: "Препятствие", impact: 0 };
                }
                if (rangeLimit) {
                    Object.assign(this.position, previous);
                    this.velocity.x = this.velocity.y = this.velocity.z = 0;
                }
                if (hit || rangeLimit) {
                    this.hitFlash = Math.max(this.hitFlash, Math.min(.38, .10 + (hit?.impact || 0) * .025));
                    if (this.time - this.collisionNoticeAt > 1.1) {
                        this.collisionNoticeAt = this.time;
                        if (hit) this.collisionCount = (this.collisionCount || 0) + 1;
                        this.notify(rangeLimit ? { rangeLimit: true } : {
                            collision: true, collisionName: hit.name,
                            collisionImpact: hit.impact
                        });
                    }
                }

                const surfaceGround = supportGroundAt(this.position.x, this.position.z,
                    Math.max(previous.y, this.position.y));
                if (this.position.y <= surfaceGround) {
                    const contact = operation.groundContact(this.physicsState, surfaceGround);
                    if (contact) this.touchGround(contact);
                }
            }
            this.updateTutorial(dt);
            this.hitFlash = Math.max(0, this.hitFlash - dt);
            const motorsOn = this.flightPhase !== "disarmed";
            this.batteryUsed += dt * (this.flightPhase === "armed" ? 0.16 : motorsOn ? 1 : 0)
                * (this.level.story ? window.SkycraftCampaignEffects?.drain(
                    this.campaignState, Math.hypot(this.velocity.x,this.velocity.z)) || 1 : 1);

            // При заряде <= 10% включаем автовозврат к земле, сохранив
            // небольшую резервную энергию для безопасной посадки.
            if (!this.failsafeLanding && this.remainingBattery <= 10 && motorsOn) {
                this.failsafeLanding = true;
                if (this.flightPhase === "armed") {
                    operation.groundContact(this.physicsState, ground);
                    this.touchGround({ hard: false });
                } else {
                    this.flightPhase = "landing";
                    this.keys.clear();
                    this.notify({ lowBattery: true });
                }
            }

            if (this.rotorState && window.SkycraftRotorDynamics) {
                const rotorInput = this.flightPhase === "landing"
                    ? operation.landingInput(this.position, this.velocity, this.attitude.yaw, ground)
                    : this.flightPhase === "takeoff"
                        ? operation.takeoffInput(this.velocity, this.attitude.yaw)
                        : window.SkycraftFlightPhysics.controlsFromKeys(this.keys);
                window.SkycraftRotorDynamics.step(this.rotorState, {
                    mode: "running",
                    motorState: this.flightPhase === "disarmed" ? "off"
                        : this.flightPhase === "armed" ? "idle" : "active",
                    input: rotorInput, attitude: this.attitude,
                    velocity: this.velocity, specs, configuration: this.configuration,
                    battery: this.remainingBattery
                }, dt);
            }

            if (["flying", "takeoff", "landing"].includes(this.flightPhase)) {
                const current = this.level.checkpoints[this.completed];
                const gatesAllowed = !this.tutorial ||
                    window.SkycraftTutorial.active(this.tutorial).id === "gates";
                if (current && !this.completionPending && gatesAllowed) {
                    const distance = this.objectiveDistance();
                    const needsScan = this.level.story && this.campaignState &&
                        window.SkycraftCampaignEffects?.needsAction(this.campaignState.id);
                    if (this.level.story) {
                        if (distance < current.radius * 1.35 &&
                            this.time - (this.lastScanNotice || -20) > 3.0) {
                            this.lastScanNotice = this.time;
                            this.notify({ campaignAction: "АИДА: выживший рядом — подлети ближе и нажми F" });
                        }
                    } else if (distance < current.radius && (!needsScan ||
                        this.campaignState.confirmedIndex === this.completed)) {
                        this.completed++;
                        if (this.completed === this.level.checkpoints.length && !this.tutorial) {
                            // На обычных трассах посадка включается автоматически.
                            this.completionPending = true;
                            this.flightPhase = "landing";
                            this.keys.clear();
                        }
                        // В академии посадка — отдельное действие игрока (клавиша L).
                        this.updateTutorial(0);
                        this.notify({ checkpoint: true });
                    } else if (distance < current.radius && needsScan &&
                        this.time - (this.lastScanNotice || -20) > 3.0) {
                        this.lastScanNotice = this.time;
                        this.notify({ campaignAction: "АИДА: цель требует подтверждения — нажми F" });
                    }
                }
            }
            if (this.time - this.lastStatusRefresh >= 0.05) {
                this.lastStatusRefresh = this.time;
                this.notify();
            }
        }

        collides() {
            if (window.SkycraftCollisions && this.colliders) {
                const p = this.position;
                return this.colliders.some(box =>
                    p.x > box.min.x - window.SkycraftCollisions.DRONE_RADIUS &&
                    p.x < box.max.x + window.SkycraftCollisions.DRONE_RADIUS &&
                    p.y > box.min.y - window.SkycraftCollisions.DRONE_RADIUS &&
                    p.y < box.max.y + window.SkycraftCollisions.DRONE_RADIUS &&
                    p.z > box.min.z - window.SkycraftCollisions.DRONE_RADIUS &&
                    p.z < box.max.z + window.SkycraftCollisions.DRONE_RADIUS);
            }
            const { x, y, z } = this.position;
            const frontBoundary = Number.isFinite(this.level.frontBoundary) ? this.level.frontBoundary : 18;
            const backBoundary = Number.isFinite(this.level.backBoundary) ? this.level.backBoundary : -68;
            if (Math.abs(x) > this.level.boundary || z > frontBoundary || z < backBoundary) return true;
            for (const item of this.level.obstacles) {
                const radius = item.type === "crate" ? item.size * 0.53 + 0.9 : item.size * 0.6 + 0.8;
                const height = item.type === "crate" ? item.size : item.type === "rock" ? item.size * 1.5 : 9;
                if (Math.hypot(x - item.x, z - item.z) < radius && y < height + 1.0) return true;
            }
            return false;
        }

        // FPV: точка обзора закреплена у носовой камеры и смотрит по курсу.
        // Третье лицо: камера преследует дрон с небольшим смещением.
        updateCamera() {
            const yaw = (this.attitude?.yaw || 0) + (this.yaw || 0);
            const heading = this.attitude?.yaw || 0;
            const pitch = this.attitude?.pitch || 0;
            const roll = this.attitude?.roll || 0;
            let cameraPosition, forward, right, up;
            const norm = (v) => {
                const length = Math.hypot(...v) || 1;
                return v.map(n => n / length);
            };
            const cross = (a, b) => [
                a[1] * b[2] - a[2] * b[1],
                a[2] * b[0] - a[0] * b[2],
                a[0] * b[1] - a[1] * b[0]
            ];
            if (this.cameraMode === "first") {
                const lookPitch = clamp(-pitch * 0.40 + (this.elevation || 0), -0.7, 0.7);
                forward = norm([
                    Math.sin(yaw) * Math.cos(lookPitch),
                    Math.sin(lookPitch),
                    -Math.cos(yaw) * Math.cos(lookPitch)
                ]);
                cameraPosition = [
                    this.position.x + Math.sin(heading) * 0.9,
                    this.position.y + 0.12,
                    this.position.z - Math.cos(heading) * 0.9
                ];
                right = norm(cross(forward, [0, 1, 0]));
                up = norm(cross(right, forward));
                // Небольшой крен картинки — ощущение пилотирования.
                const bank = clamp(-roll * 0.32, -0.18, 0.18);
                const cos = Math.cos(bank), sin = Math.sin(bank);
                const bankedRight = right.map((n, i) => n * cos + up[i] * sin);
                up = up.map((n, i) => n * cos - right[i] * sin);
                right = bankedRight;
            } else {
                const target = [this.position.x, this.position.y + 0.25, this.position.z];
                const cosPitch = Math.cos(this.elevation);
                // Камера следует за ХВОСТОМ дрона, а не за его носом.
                // Положительный yaw физики направляет нос в +X;
                // для позиции камеры знак yaw должен быть обратным.
                const follow = window.SkycraftFlightOrientation.chaseOffset(
                    heading, this.yaw, this.distance * cosPitch);
                cameraPosition = [
                    target[0] + follow.x,
                    target[1] + Math.sin(this.elevation) * this.distance,
                    target[2] + follow.z
                ];
                forward = norm(target.map((n, i) => n - cameraPosition[i]));
                right = norm(cross(forward, [0, 1, 0]));
                up = norm(cross(right, forward));
            }
            // Камера третьего лица не проходит сквозь здания и стены.
            if (this.cameraMode === "third" && window.SkycraftCollisions && this.colliders?.length) {
                const center = { ...this.position, y: this.position.y + 0.25 };
                const proposed = { x: cameraPosition[0], y: cameraPosition[1], z: cameraPosition[2] };
                const cameraHit = window.SkycraftCollisions.sweep(center, proposed, this.colliders, 0.25);
                if (cameraHit) {
                    const t = Math.max(0.02, cameraHit.t - 0.025);
                    cameraPosition = ["x", "y", "z"].map(axis => center[axis] +
                        (proposed[axis] - center[axis]) * t);
                    const target = [center.x, center.y, center.z];
                    forward = norm(target.map((n, i) => n - cameraPosition[i]));
                    right = norm(cross(forward, [0, 1, 0]));
                    up = norm(cross(right, forward));
                }
            }
            // A chase camera must not go through the real imported terrain.
            if (this.cameraMode === 'third' && this.level?.terrainModel === 'hills-lake-world') {
                const groundY = window.SkycraftHillsTerrain?.heightAt(
                    cameraPosition[0], cameraPosition[2]);
                if (Number.isFinite(groundY) && cameraPosition[1] < groundY + 0.65) {
                    cameraPosition[1] = groundY + 0.65;
                    const center = [this.position.x, this.position.y + 0.25, this.position.z];
                    forward = norm(center.map((n, i) => n - cameraPosition[i]));
                    right = norm(cross(forward, [0, 1, 0]));
                    up = norm(cross(right, forward));
                }
            }
            this.camera = { position: cameraPosition, right, up, forward };
            this.focalLength = Math.min(this.width * 0.95, this.height * 1.45);
        }

        // Полётная сцена выводится только Three.js; никаких кубов, Canvas2D,
        // процедурных полов или альтернативных 3D-моделей больше нет.
        render() {
            if (!this.level || this.width < 1 || this.height < 1) return;
            super.render();
        }

        animate() {
            const now = performance.now();
            const dt = clamp((now - (this.lastTimestamp || now)) / 1000, 0, 0.055);
            this.lastTimestamp = now;
            if (!document.hidden) {
                this.update(dt);
                if (this.mode !== 'running' && this.rotorState && window.SkycraftRotorDynamics) {
                    window.SkycraftRotorDynamics.step(this.rotorState, {
                        mode: this.mode, configuration: this.configuration
                    }, dt);
                }
                this.render();
            }
            requestAnimationFrame(this.animate);
        }
    }

    window.SkycraftFlightScene = FlightScene;
})();
