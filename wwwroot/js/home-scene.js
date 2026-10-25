"use strict";

  
                                                                        
                                                                               
                                                    
   
(function () {
    class HomeScene extends window.SkycraftDroneScene {
        constructor(canvas) {
            super(canvas);
            this.yaw = 0.46;
            this.elevation = 0.21;
            this.distance = 13.4;
            this.lastInteraction = 0;
        }

        resetView() {
            this.yaw = 0.46;
            this.elevation = 0.21;
            this.distance = 13.4;
        }

        zoom(delta) {
            this.distance = Math.max(10.7, Math.min(17.0, this.distance + delta));
        }

                                                                   
                                                      
        loadSavedConfiguration() {
            try {
                const selection = JSON.parse(window.SkycraftProfiles.storage.getItem("skycraft.selection.v1"));
                if (selection && typeof selection === "object") {
                    const valid = {};
                    for (const key of ["frame", "motor", "propeller", "battery", "electronics"]) {
                        if (typeof selection[key] === "string") valid[key] = selection[key];
                    }
                    this.setConfiguration(valid);
                }
            } catch {
                                                                           
            }
        }
    }

    const canvas = document.getElementById("home-drone-canvas");
    if (!canvas) return;
    const scene = new HomeScene(canvas);
    scene.loadSavedConfiguration();

                                                                              
    const statsEngine = window.SkycraftDroneStats;
    if (statsEngine) {
        try {
            const specs = statsEngine.calculate(scene.configuration);
            const isDefault = Object.keys(statsEngine.DEFAULTS)
                .every(key => scene.configuration[key] === statsEngine.DEFAULTS[key]);
            document.getElementById("home-drone-title").textContent = isDefault
                ? "Базовый беспилотник" : "Модифицированный беспилотник";
            document.getElementById("home-stat-weight").textContent = `${specs.weight} кг`;
            document.getElementById("home-stat-speed").textContent = `${specs.speed} км/ч`;
            document.getElementById("home-stat-range").textContent = `${specs.range} м`;
        } catch (error) {
            console.warn("SKYCRAFT: не удалось обновить характеристики на главной", error);
        }
    }
})();
