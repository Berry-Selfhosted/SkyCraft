"use strict";

  
                                            
                                                          
                                                                      
                                                                     
   
(function () {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const normalize = ([x, y, z]) => {
        const length = Math.hypot(x, y, z) || 1;
        return [x / length, y / length, z / length];
    };
    const cross = ([ax, ay, az], [bx, by, bz]) => [
        ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
    ];

    class DroneScene {
        constructor(canvas) {
            this.canvas = canvas;
            this.yaw = 0.57;
            this.elevation = 0.30;
            this.distance = 11.4;
            this.dragPointer = null;
            this.previousPointer = null;
            this.configuration = {
                frame: 'frame-light',
                motor: 'motor-base',
                propeller: 'prop-base',
                battery: 'battery-base',
                electronics: 'chip-base'
            };
            this.camera = {};
            this.animationFrame = 0;
            this.modernRenderer = null;
            this.renderError = null;

                                                                                 
            canvas.style.background = 'transparent';
            canvas.style.touchAction = 'none';
            this.createRenderStatus();
            this.bindInteraction();
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas);
            this.resize();

                                                                         
                                                                             
            import('/js/three-scene.js?v=0.31.0').then(({ SkycraftModernRenderer }) => {
                this.modernRenderer = new SkycraftModernRenderer(this);
                this.render();
            }).catch(error => {
                this.renderError = error;
                console.error('SKYCRAFT: Three.js не загружен', error);
                this.setRenderStatus('error', 'Не удалось запустить 3D-движок. Проверь Three.js и WebGL.');
            });
            this.animate = this.animate.bind(this);
            requestAnimationFrame(this.animate);
        }

        createRenderStatus() {
            const parent = this.canvas.parentElement;
            if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
            let element = parent.querySelector('.skycraft-render-status');
            if (!element) {
                element = document.createElement('div');
                element.className = 'skycraft-render-status';
                element.setAttribute('role', 'status');
                element.setAttribute('aria-live', 'polite');
                parent.appendChild(element);
            }
            this.renderStatus = element;
            this.setRenderStatus('loading', 'Загрузка 3D-сцены…');
        }

        setRenderStatus(state, message) {
            if (!this.renderStatus) return;
            this.renderStatus.dataset.state = state;
            this.renderStatus.textContent = state === 'ready' ? '' : message;
            this.renderStatus.hidden = state === 'ready';
        }

        setConfiguration(configuration) {
            this.renderError = null;
            this.configuration = { ...this.configuration, ...configuration };
                                                                          
            this.modernRenderer?.rebuildDrone(this.configuration).catch(error => {
                this.renderError = error;
                this.setRenderStatus('error', 'Не удалось загрузить модель беспилотника.');
            });
        }

        updateModelStatus() {
            const status = document.getElementById('glb-model-status') ||
                document.getElementById('home-3d-status');
            if (!status) return;
            const ready = Boolean(this.modernRenderer?.drone.children.length);
            status.textContent = this.renderError ? 'Ошибка загрузки 3D-модели'
                : ready ? 'Модели GLB загружены' : 'Загрузка 3D-моделей…';
            status.dataset.error = String(Boolean(this.renderError));
            status.dataset.loaded = String(ready);
        }

        resetView() {
            this.yaw = 0.57;
            this.elevation = 0.30;
            this.distance = 11.4;
        }

        zoom(delta) {
            this.distance = clamp(this.distance + delta, 7.8, 17);
        }

        bindInteraction() {
            this.canvas.addEventListener('pointerdown', event => {
                this.dragPointer = event.pointerId;
                this.previousPointer = [event.clientX, event.clientY];
                this.canvas.setPointerCapture(event.pointerId);
            });
            this.canvas.addEventListener('pointermove', event => {
                if (event.pointerId !== this.dragPointer || !this.previousPointer) return;
                const dx = event.clientX - this.previousPointer[0];
                const dy = event.clientY - this.previousPointer[1];
                this.yaw += dx * 0.008;
                this.elevation = clamp(this.elevation + dy * 0.0045, 0.11, 0.82);
                this.previousPointer = [event.clientX, event.clientY];
            });
            const stop = () => { this.dragPointer = null; this.previousPointer = null; };
            this.canvas.addEventListener('pointerup', stop);
            this.canvas.addEventListener('pointercancel', stop);
            this.canvas.addEventListener('wheel', event => {
                event.preventDefault();
                this.zoom(Math.sign(event.deltaY) * 0.65);
            }, { passive: false });
        }

        resize() {
            const bounds = this.canvas.getBoundingClientRect();
            this.width = Math.max(1, bounds.width);
            this.height = Math.max(1, bounds.height);
        }

        updateCamera() {
            const target = [0, 1.50, 0];
            const cos = Math.cos(this.elevation);
            const position = [
                Math.sin(this.yaw) * this.distance * cos,
                target[1] + Math.sin(this.elevation) * this.distance,
                Math.cos(this.yaw) * this.distance * cos
            ];
            const forward = normalize(target.map((value, index) => value - position[index]));
            const right = normalize(cross(forward, [0, 1, 0]));
            const up = normalize(cross(right, forward));
            this.camera = { position, forward, right, up };
            this.focalLength = Math.min(this.width * 0.95, this.height * 1.56);
        }

        render() {
            if (this.width < 1 || this.height < 1) return;
            this.updateCamera();
            if (!this.modernRenderer || this.renderError) return;
            const result = this.modernRenderer.render(this);
            if (result) this.setRenderStatus('ready');
            else if (this.modernRenderer.loadError) {
                this.setRenderStatus('error', 'Ошибка GLB: ' + this.modernRenderer.loadError.message);
            } else this.setRenderStatus('loading', 'Загрузка 3D-модели и окружения…');
            this.updateModelStatus();
        }

        animate() {
            if (!document.hidden) {
                const now = performance.now();
                                                                           
                if (now - (this.lastRenderAt || 0) >= 33) {
                    this.lastRenderAt = now;
                    this.render();
                }
            }
            requestAnimationFrame(this.animate);
        }
    }

    window.SkycraftDroneScene = DroneScene;
})();
