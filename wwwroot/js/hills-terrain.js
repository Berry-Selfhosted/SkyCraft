"use strict";
  
                                                                        
                                                          
  
                                                                           
                                                                
   
(function (root) {
    let pending;
    let data;
    let obstacles = [];
    function load() {
        if (data) return Promise.resolve(data);
        if (!pending) pending = Promise.all([
            fetch('/assets/models/hills-lake-heightmap.json').then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: hills/lake heightfield`);
                return response.json();
            }),
            fetch('/assets/models/hills-lake-obstacles.json').then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: forest colliders`);
                return response.json();
            })
        ]).then(([result, obstaclesJson]) => {
            if (!Number.isFinite(result.width) || !Number.isFinite(result.height) ||
                result.heights?.length !== result.width * result.height) {
                throw new Error('Invalid hills/lake terrain heightfield');
            }
            data = result;
            obstacles = Array.isArray(obstaclesJson?.boxes) ? obstaclesJson.boxes : [];
            return data;
        }).catch(error => { pending = null; throw error; });
        return pending;
    }
    function heightAt(x, z) {
        if (!data) return null;
        const { xMin, zMin, step, width, height, heights } = data;
        const fx = (x - xMin) / step;
        const fz = (z - zMin) / step;
        if (fx < 0 || fx > width - 1 || fz < 0 || fz > height - 1) return null;
        const ix = Math.min(width - 2, Math.floor(fx));
        const iz = Math.min(height - 2, Math.floor(fz));
        const tx = fx - ix;
        const tz = fz - iz;
        const a = heights[iz * width + ix];
        const b = heights[iz * width + ix + 1];
        const c = heights[(iz + 1) * width + ix];
        const d = heights[(iz + 1) * width + ix + 1];
        return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) +
            c * (1 - tx) * tz + d * tx * tz;
    }
    function groundAt(x, z, droneClearance = 1.87) {
        const y = heightAt(x, z);
        return y === null ? droneClearance : y + droneClearance;
    }
    function colliderBoxes() { return obstacles; }
    root.SkycraftHillsTerrain = Object.freeze({ load, heightAt, groundAt, colliderBoxes });
})(window);
