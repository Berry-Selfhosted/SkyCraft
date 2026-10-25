   
                                             
                                            
                                                                            
                                                                 
  
                                                                            
                                                                            
                                                                          
  
                                                                            
                                                                     
   
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

THREE.Cache.enabled = true;

const MODEL_ROOT = '/assets/models/';
const STATIC_CACHE = new Map();
const MOBILE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
const cameraTarget = new THREE.Vector3();
const Y_PIVOT = 1.75;

function loadModel(loader, name) {
    const url = MODEL_ROOT + name + '.glb';
    if (!STATIC_CACHE.has(url)) {
        STATIC_CACHE.set(url, loader.loadAsync(url).then(gltf => {
            const object = gltf.scene;
            object.traverse(child => {
                if (!child.isMesh) return;
                child.castShadow = !MOBILE;
                child.receiveShadow = true;
                                                                               
                                                                                
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (!material) return;
                    material.needsUpdate = true;
                    if (material.alphaTest < 0.04 && material.transparent && material.map) {
                        material.depthWrite = false;
                    }
                });
            });
            return object;
        }).catch(error => {
            STATIC_CACHE.delete(url);                                        
            throw error;
        }));
    }
    return STATIC_CACHE.get(url).then(object => object.clone(true));
}

function partIds(configuration) {
    return [configuration.frame, configuration.motor, configuration.propeller,
        configuration.battery, configuration.electronics].filter(Boolean);
}

function makeGate(THREE, point, color, index) {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, point.z);
    const beam = new THREE.MeshStandardMaterial({
        color, metalness: 0.34, roughness: 0.38,
        emissive: color, emissiveIntensity: 0.18
    });
    const neon = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 });
    const postGeometry = new THREE.CylinderGeometry(0.075, 0.075, 4.5, 9);
    for (const x of [-2.3, 2.3]) {
        const post = new THREE.Mesh(postGeometry, beam);
        post.position.set(x, 0.07, 0);
        post.castShadow = false;
        group.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.13, 0.13), beam);
    top.position.y = 2.31;
    group.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.075, 10, 48), neon);
    ring.position.y = 0.12;
    group.add(ring);
    group.userData.index = index;
    group.userData.beam = beam;
    group.userData.neon = neon;
    return group;
}



function buildWaterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#9ae9ff');
    gradient.addColorStop(0.35, '#43c5ff');
    gradient.addColorStop(0.7, '#1f8de3');
    gradient.addColorStop(1, '#0d5bb5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 90; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(5,54,118,0.16)';
        const x = (i * 31) % 256;
        const y = (i * 19) % 256;
        ctx.beginPath();
        ctx.ellipse(x, y, 20 + (i % 5) * 8, 5 + (i % 3) * 2, ((i % 7) / 7) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2;
    for (let y = -24; y < 288; y += 16) {
        ctx.strokeStyle = y % 32 === 0 ? 'rgba(255,255,255,0.32)' : 'rgba(190,242,255,0.18)';
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 6) {
            const waveY = y + Math.sin((x + y) * 0.055) * 4 + Math.sin(x * 0.14) * 1.4;
            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.needsUpdate = true;
    return texture;
}

function buildGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#88b95a');
    gradient.addColorStop(0.52, '#6f9d48');
    gradient.addColorStop(1, '#5c7f39');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1200; i += 1) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const s = 2 + Math.random() * 8;
        const hue = Math.random() > 0.58
            ? 'rgba(142,99,57,0.34)'
            : (Math.random() > 0.5 ? 'rgba(95,141,56,0.26)' : 'rgba(129,170,82,0.18)');
        ctx.fillStyle = hue;
        ctx.fillRect(x, y, s, s * (0.55 + Math.random()));
    }

    ctx.globalAlpha = 0.28;
    for (let i = -40; i < 300; i += 18) {
        ctx.strokeStyle = i % 36 === 0 ? 'rgba(122,81,41,0.26)' : 'rgba(167,127,82,0.18)';
        ctx.lineWidth = 6 + ((i + 40) % 3);
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 8) {
            const y = i + Math.sin((x + i) * 0.05) * 8 + Math.sin(x * 0.11) * 2;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    texture.needsUpdate = true;
    return texture;
}

function makeRescueTarget(THREE, point, color, index) {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, point.z);
    const accent = new THREE.Color(color);
    const cloth = new THREE.MeshStandardMaterial({
        color: accent.clone().lerp(new THREE.Color('#f7b26c'), 0.55),
        roughness: 0.86, metalness: 0.03
    });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8cfba, roughness: 0.94 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x39455a, roughness: 0.88 });
    const beacon = new THREE.MeshStandardMaterial({
        color: accent, emissive: accent, emissiveIntensity: 0.25,
        transparent: true, opacity: 0.95, roughness: 0.32, metalness: 0.05
    });
    const ring = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7 });

    const pad = new THREE.Mesh(new THREE.RingGeometry(1.28, 1.6, 40), ring);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    group.add(pad);

    const pulse = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.1, 12), beacon);
    pulse.position.y = 1.58;
    group.add(pulse);
    const markerColumn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.27, 9, 10),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.28, depthWrite: false })
    );
    markerColumn.position.y = 5.4;
    group.add(markerColumn);
    const signal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), beacon);
    signal.position.y = 10.2;
    group.add(signal);

    const body = new THREE.Group();
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.2), cloth);
    pelvis.position.y = 0.78;
    body.add(pelvis);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.95, 5, 10), cloth);
    torso.position.y = 1.32;
    body.add(torso);
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.16), dark);
    backpack.position.set(0, 1.25, -0.17);
    body.add(backpack);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), skin);
    neck.position.y = 1.84;
    body.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 18), skin);
    head.position.y = 2.08;
    head.scale.set(0.95, 1.08, 0.96);
    body.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), dark);
    hair.position.y = 2.16;
    hair.rotation.x = -0.12;
    body.add(hair);
    const legGeometry = new THREE.CapsuleGeometry(0.07, 0.7, 4, 8);
    const leftLeg = new THREE.Mesh(legGeometry, dark);
    leftLeg.position.set(-0.12, 0.36, 0);
    leftLeg.rotation.z = 0.06;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.12;
    rightLeg.rotation.z = -0.06;
    body.add(leftLeg, rightLeg);
    const bootGeometry = new THREE.BoxGeometry(0.13, 0.08, 0.24);
    const leftBoot = new THREE.Mesh(bootGeometry, dark);
    leftBoot.position.set(-0.12, 0.02, 0.05);
    const rightBoot = leftBoot.clone();
    rightBoot.position.x = 0.12;
    body.add(leftBoot, rightBoot);
    const armGeometry = new THREE.CapsuleGeometry(0.052, 0.56, 4, 8);
    const leftArm = new THREE.Mesh(armGeometry, cloth);
    leftArm.position.set(-0.34, 1.34, 0.02);
    leftArm.rotation.z = 0.55;
    leftArm.rotation.x = -0.12;
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.34;
    rightArm.rotation.z = -0.55;
    body.add(leftArm, rightArm);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.22, metalness: 0.15 }));
    visor.position.set(0, 2.06, 0.22);
    body.add(visor);
    group.add(body);

    group.userData.index = index;
    group.userData.type = 'rescue';
    group.userData.beam = beacon;
    group.userData.neon = ring;
    group.userData.marker = body;
    group.userData.baseY = point.y;
    return group;
}

function buildDroneLights(THREE) {
                                                                                 
                                                                            
    const group = new THREE.Group();

    const overhead = new THREE.SpotLight(0xf5f8ff, 38, 24, Math.PI / 4.2, 0.48, 1.5);
    overhead.position.set(0, 7.5, 1.2);
    overhead.target.position.set(0, -1.4, 0);
    overhead.castShadow = !MOBILE;
    overhead.shadow.mapSize.set(MOBILE ? 256 : 1024, MOBILE ? 256 : 1024);
    overhead.shadow.bias = -0.00035;
    overhead.shadow.normalBias = 0.025;
    group.add(overhead, overhead.target);

    const fills = [
        { color: 0xe9f0ff, intensity: 12, position: [-5.0, 2.9, 4.4] },
        { color: 0xffffff, intensity: 11, position: [5.0, 3.1, 4.0] },
        { color: 0xbacde8, intensity: 7, position: [-4.2, 3.7, -4.0] },
        { color: 0xd5e3f5, intensity: 7, position: [4.2, 3.7, -4.0] }
    ];
    for (const { color, intensity, position } of fills) {
        const light = new THREE.PointLight(color, intensity, 20, 2);
        light.position.set(...position);
        light.castShadow = false;
        group.add(light);
    }
    return group;
}

class SkycraftModernRenderer {
    constructor(controller) {
        this.controller = controller;
        this.assetLoader = new GLTFLoader();
        this.container = controller.canvas.parentElement;
        if (getComputedStyle(this.container).position === 'static') {
            this.container.style.position = 'relative';
        }
        this.renderer = new THREE.WebGLRenderer({
            antialias: !MOBILE,
            alpha: false,
            powerPreference: MOBILE ? 'default' : 'high-performance',
            stencil: false
        });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.15 : 1.7));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.32;
        this.renderer.shadowMap.enabled = !MOBILE;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const view = this.renderer.domElement;
        view.className = 'skycraft-modern-canvas';
        Object.assign(view.style, {
            position: 'absolute', inset: '0', width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '0', display: 'block'
        });
        this.container.insertBefore(view, controller.canvas);
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x879baa);
        this.scene.fog = new THREE.FogExp2(0x9caab5, 0.006);
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.08, 560);
                                                                         
                                                                          
        this.environment = new THREE.Group();
        this.environment.name = 'StaticWorld';
        this.environment.matrixAutoUpdate = false;
        this.environment.updateMatrix();
        this.drone = new THREE.Group();
        this.drone.name = 'PlayerDrone';
        this.droneLightRig = buildDroneLights(THREE);
        this.scene.add(this.environment, this.drone);
        this.scene.add(this.droneLightRig);
        this.ambient = new THREE.HemisphereLight(0xe0eaff, 0x525e63, 2.1);
        this.scene.add(this.ambient);
        this.keyLight = new THREE.DirectionalLight(0xffeed0, 3.2);
        this.keyLight.position.set(-28, 48, 17);
        this.keyLight.castShadow = !MOBILE;
        this.keyLight.shadow.mapSize.set(MOBILE ? 512 : 2048, MOBILE ? 512 : 2048);
        Object.assign(this.keyLight.shadow.camera, { left: -54, right: 54, top: 54, bottom: -54, near: 0.1, far: 180 });
        this.keyLight.shadow.bias = -0.0006;
        this.keyLight.shadow.normalBias = 0.04;
        this.scene.add(this.keyLight);
        this.fill = new THREE.DirectionalLight(0x8cbbff, 0.8);
        this.fill.position.set(16, 12, -28);
        this.scene.add(this.fill);
        this.currentLevel = null;
        this.configurationSignature = null;
        this.lastWidth = 0;
        this.lastHeight = 0;
        this.levelReady = false;
        this.loadError = null;
        this.ready = true;
        this.epoch = 0;
        this.gates = [];
        this.rotors = [];
        this.visibilityMode = 'third';
        this.waterTexture = buildWaterTexture();
        this.groundTexture = buildGroundTexture();
        this.animatedWaterTextures = [];
        this.raycaster = new THREE.Raycaster();
        this.createBasicGround();
    }


    applyStoryPalette(level) {
        const skyTop = new THREE.Color(level?.skyTop || '#88a7bf');
        const skyBottom = new THREE.Color(level?.skyBottom || '#dce7f0');
        const floor = new THREE.Color(level?.floor || '#73826d');
        const accent = new THREE.Color(level?.accent || '#7ed9ff');
        this.scene.background.copy(skyTop);
        this.scene.fog.color.copy(skyBottom.clone().lerp(skyTop, 0.18));
        this.ambient.color.copy(skyTop.clone().lerp(new THREE.Color('#ffffff'), 0.42));
        this.ambient.groundColor.copy(new THREE.Color('#74808a'));
        this.keyLight.color.set('#fff5e8');
        this.fill.color.set('#dceaff');
    }

    makeWaterMaterial(level) {
        const map = this.waterTexture.clone();
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(8, 8);
        this.animatedWaterTextures.push(map);
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color('#55c8ff').lerp(new THREE.Color('#1776dd'), 0.28),
            map,
            transparent: true,
            opacity: 0.995,
            metalness: 0.22,
            roughness: 0.19,
            emissive: new THREE.Color('#0b4d90'),
            emissiveIntensity: 0.05
        });
    }

    makeGroundMaterial(level, variant = 'grass') {
        const map = this.groundTexture.clone();
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.set(variant === 'mountain' ? 6 : 10, variant === 'mountain' ? 6 : 10);
        const normal = this.groundTexture.clone();
        normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
        normal.repeat.copy(map.repeat);
        normal.needsUpdate = true;
        map.needsUpdate = true;
        const baseColor = variant === 'mountain'
            ? new THREE.Color(level?.floor || '#82b155').lerp(new THREE.Color('#9f8156'), 0.48)
            : new THREE.Color(level?.floor || '#82b155').lerp(new THREE.Color('#6f9b46'), 0.26);
        return new THREE.MeshStandardMaterial({
            color: baseColor,
            map,
            roughness: variant === 'mountain' ? 0.95 : 0.98,
            metalness: 0.02,
            bumpMap: normal,
            bumpScale: variant === 'mountain' ? 0.06 : 0.04
        });
    }

    buildHangarLighting() {
        const group = new THREE.Group();
        const positions = [
            [-9, 8.5, -4],
            [0, 9.25, 0],
            [9, 8.5, 4]
        ];
        positions.forEach(([x, y, z], index) => {
            const spot = new THREE.SpotLight(index === 1 ? 0xfff1cf : 0xd8ecff, index === 1 ? 1.8 : 1.1, 42, Math.PI / 4.6, 0.38, 1.35);
            spot.position.set(x, y, z);
            spot.target.position.set(x * 0.08, 1.45, z * 0.08);
            spot.castShadow = !MOBILE;
            if (spot.shadow) {
                spot.shadow.mapSize.set(MOBILE ? 256 : 1024, MOBILE ? 256 : 1024);
                spot.shadow.bias = -0.0002;
            }
            group.add(spot, spot.target);
        });
        const fill = new THREE.PointLight(0x8cc6ff, 0.5, 48, 2);
        fill.position.set(0, 3.4, 10);
        const side = new THREE.PointLight(0x6edcff, 0.3, 30, 2);
        side.position.set(-7, 4.2, -6);
        const side2 = new THREE.PointLight(0x6edcff, 0.25, 30, 2);
        side2.position.set(7, 4.2, -6);
        group.add(fill, side, side2);
        return group;
    }

    sampleGroundHeight(x, z, fallback = 0) {
        const meshes = [];
        this.environment.traverse(object => {
            if (!object.isMesh || !object.visible) return;
            const name = (object.name || '').toLowerCase();
            if (name.includes('helper') || name.includes('ring') || name.includes('target') || name.includes('lake') || name.includes('water')) return;
            meshes.push(object);
        });
        if (!meshes.length) return fallback;
        this.raycaster.set(new THREE.Vector3(x, 250, z), new THREE.Vector3(0, -1, 0));
        const hits = this.raycaster.intersectObjects(meshes, false);
        const hit = hits.find(item => Number.isFinite(item.point?.y));
        return hit ? hit.point.y : fallback;
    }

    placeTargetsOnGround(points) {
        if (!Array.isArray(points)) return;
        points.forEach(point => {
            if (!point) return;
            const terrain = window.SkycraftHillsTerrain?.heightAt(point.x, point.z);
            const groundY = Number.isFinite(terrain) ? terrain
                : this.sampleGroundHeight(point.x, point.z, point.y || 0);
                                                                              
                                                                                  
            point.groundY = groundY;
            point.y = groundY + 5.2;
        });
    }

    makeStylizedTree(center, size) {
        const group = new THREE.Group();
        const height = THREE.MathUtils.clamp(size.y || Math.max(size.x, size.z) * 2.8 || 8, 5.5, 14);
        const radius = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.45 || height * 0.22, 0.8, 3.8);
        const baseY = center.y - (size.y || height) * 0.5;
        group.position.set(center.x, baseY, center.z);
        group.rotation.y = (center.x * 0.137 + center.z * 0.091) % Math.PI;
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.16, radius * 0.24, height * 0.42, 7),
            new THREE.MeshStandardMaterial({ color: 0x705339, roughness: 0.96 })
        );
        trunk.position.y = height * 0.21;
        trunk.castShadow = !MOBILE;
        trunk.receiveShadow = true;
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f35, roughness: 0.97 });
        const foliageMidMaterial = new THREE.MeshStandardMaterial({ color: 0x4c9a52, roughness: 0.95 });
        const coneLow = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.08, height * 0.46, 7), foliageMaterial);
        coneLow.position.y = height * 0.47;
        const coneMid = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.82, height * 0.35, 7), foliageMidMaterial);
        coneMid.position.y = height * 0.72;
        const coneTop = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.56, height * 0.24, 7), foliageMaterial);
        coneTop.position.y = height * 0.94;
        const groundShadow = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 1.18, 18),
            new THREE.MeshBasicMaterial({ color: 0x27451e, transparent: true, opacity: 0.22 })
        );
        groundShadow.rotation.x = -Math.PI / 2;
        groundShadow.position.y = 0.025;
        for (const mesh of [coneLow, coneMid, coneTop]) {
            mesh.castShadow = !MOBILE;
            mesh.receiveShadow = true;
        }
        group.add(groundShadow, trunk, coneLow, coneMid, coneTop);
        return group;
    }

    stylizeStoryWorld(asset, level) {
        const treeSeeds = [];
        const cliffColor = new THREE.Color('#aa9a7d');
        const trunkColor = new THREE.Color('#6a5039');
        const grassMaterial = this.makeGroundMaterial(level, 'grass');
        const mountainMaterial = this.makeGroundMaterial(level, 'mountain');
        asset.traverse(mesh => {
            if (!mesh.isMesh) return;
            const name = (mesh.name || '').toLowerCase();
            mesh.castShadow = !MOBILE && !name.includes('lake');
            mesh.receiveShadow = true;
            if (name.includes('pine') || name.includes('nativepine')) {
                const box = new THREE.Box3().setFromObject(mesh);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                if (size.length() > 0.01) treeSeeds.push({ center, size });
                mesh.visible = false;
                return;
            }
            if (name.includes('lake') || name.includes('water')) {
                mesh.material = this.makeWaterMaterial(level);
                return;
            }
            if (name.includes('rock') || name.includes('cliff')) {
                mesh.material = new THREE.MeshStandardMaterial({ color: cliffColor, roughness: 0.93, metalness: 0.02 });
                return;
            }
            if (name.includes('mountain')) {
                mesh.material = mountainMaterial.clone();
                return;
            }
            if (name.includes('hill') || name.includes('ground') || name.includes('terrain')) {
                mesh.material = grassMaterial.clone();
                return;
            }
            if (name.includes('trunk')) {
                mesh.material = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.96 });
            }
        });
        treeSeeds.forEach(seed => asset.add(this.makeStylizedTree(seed.center, seed.size)));
    }

    createBasicGround() {
        this.floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
            new THREE.MeshStandardMaterial({ color: 0x566978, metalness: 0, roughness: 0.94 }));
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.1;
        this.floor.receiveShadow = true;
    }


                                                                                      
    configureWeather(level) {
        if (this.weatherSystem) {
            this.scene.remove(this.weatherSystem.mesh);
            this.weatherSystem.mesh.geometry.dispose();
            this.weatherSystem.mesh.material.dispose();
            this.weatherSystem = null;
        }
        const biome = level?.story ? level.biome : null;
        const rain = ['storm', 'river', 'torrent'].includes(biome);
        const snow = biome === 'snow';
        const dust = biome === 'mud' || biome === 'cliff';
        const mist = ['lake', 'deadforest', 'gorge', 'cave'].includes(biome);
        if (this.scene.fog) this.scene.fog.density = biome === 'storm' ? 0.012
            : biome === 'snow' ? 0.014 : dust ? 0.009 : mist ? 0.011
            : biome === 'summit' ? 0.007 : level?.story ? 0.0035 : 0.013;
        if (!rain && !snow && !dust && !mist && biome !== 'summit') return;
        const kind = rain ? 'rain' : snow ? 'snow' : dust ? 'dust' : mist ? 'mist' : 'snow';
        const count = MOBILE ? (rain ? 240 : 140) : (rain ? 620 : 340);
        const segment = kind === 'rain';
        const verts = new Float32Array(count * (segment ? 6 : 3));
        const seeds = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const k = i * 3;
            seeds[k] = Math.random() * 54 - 27;
            seeds[k + 1] = Math.random() * 28 - 8;
            seeds[k + 2] = Math.random() * 54 - 27;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        const material = segment ? new THREE.LineBasicMaterial({
            color: 0xa4d6ff, transparent: true, opacity: biome === 'storm' ? 0.63 : 0.38,
            depthWrite: false
        }) : new THREE.PointsMaterial({
            color: kind === 'dust' ? 0xd6b58a : kind === 'mist' ? 0xc6dfeb : 0xf3f9ff,
            size: kind === 'snow' ? 0.21 : kind === 'mist' ? 0.35 : 0.13,
            transparent: true, opacity: kind === 'mist' ? 0.32 : 0.75,
            sizeAttenuation: true, depthWrite: false
        });
        const mesh = segment ? new THREE.LineSegments(geometry, material) : new THREE.Points(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 6;
        this.scene.add(mesh);
        this.weatherSystem = { kind, mesh, verts, seeds, count, segment };
    }

    updateWeather(controller) {
        const weather = this.weatherSystem;
        if (!weather) return;
        const t = performance.now() * 0.001;
        const camera = this.camera.position;
        const { kind, seeds, verts, count, segment } = weather;
        const fall = kind === 'rain' ? 18 : kind === 'snow' ? 2.7 : kind === 'dust' ? 1.3 : 0.6;
        const wind = kind === 'rain' ? 4.8 : kind === 'dust' ? 2 : 0.6;
        for (let i = 0; i < count; i++) {
            const k = i * 3;
            const x = camera.x + ((seeds[k] + t * wind + 27) % 54) - 27;
            const y = camera.y + ((seeds[k + 1] - t * fall + 10000) % 28) - 8;
            const z = camera.z + seeds[k + 2];
            if (segment) {
                const offset = i * 6;
                verts[offset] = x; verts[offset + 1] = y; verts[offset + 2] = z;
                verts[offset + 3] = x - 0.20; verts[offset + 4] = y - 1.25; verts[offset + 5] = z;
            } else {
                verts[k] = x + Math.sin(t + i) * 0.4;
                verts[k + 1] = y;
                verts[k + 2] = z;
            }
        }
        weather.mesh.geometry.attributes.position.needsUpdate = true;
    }

    async loadLevel(level) {
        const epoch = ++this.epoch;
        this.levelReady = false;
        this.loadError = null;
        this.currentLevel = level;
        this.animatedWaterTextures = [];
        this.environment.clear();
        this.gates = [];
        const story = !!level?.story;
                                                                                        
                                                                         
        const scenery = story;
        if (story) this.applyStoryPalette(level);
        else {
            this.scene.background.set(0x182538);
            this.scene.fog.color.set(0x253349);
            this.ambient.color.set(0xe0eaff);
            this.ambient.groundColor.set(0x525e63);
            this.keyLight.color.set(0xffeed0);
            this.fill.color.set(0x8cbbff);
        }
        this.configureWeather(level);
        this.ambient.intensity = story ? 1.15 : (level?.kind === 'academy' ? 1.6 : 0.85);
        this.keyLight.intensity = story ? 3.35 : (level?.kind === 'academy' ? 2.2 : 1.25);
        this.fill.intensity = story ? 1.0 : (level?.kind === 'academy' ? 0.8 : 0.35);
        this.renderer.toneMappingExposure = story ? 1.08 : (level?.kind === 'academy' ? 1.3 : 1.06);
        try {
            if (scenery) {
                const asset = await loadModel(this.assetLoader,
                    'hills-lake-world');
                if (epoch !== this.epoch) return;
                                                                             
                                                                                
                                                                         
                asset.name = 'UploadedHillsLakeGLB';
                asset.scale.setScalar(1);
                asset.position.set(0, 0, 0);
                                                                        
                                                                        
                asset.rotation.set(0, 0, 0);
                asset.traverse(mesh => {
                    if (!mesh.isMesh) return;
                    mesh.castShadow = !MOBILE && !mesh.name.toLowerCase().includes('lake');
                    mesh.receiveShadow = true;
                });
                this.stylizeStoryWorld(asset, level);
                this.environment.add(asset);
                                                                             
                                                                               
                                                                    
                await window.SkycraftHillsTerrain?.load();
                if (epoch !== this.epoch) return;
                this.placeTargetsOnGround(level?.checkpoints);
            } else if (level?.kind === 'hangar' || !level) {
                                                                          
                                                                              
                                                             
                const ids = level?.kind === 'hangar'
                    ? ['hangar-floor', 'hangar-structure', 'hangar-lighting', 'hangar-props']
                    : ['hangar-floor', 'hangar-shell', 'hangar-structure', 'hangar-lighting', 'hangar-props'];
                await this.addStatic(ids, epoch);
                this.environment.add(this.buildHangarLighting());
            } else if (level?.kind === 'academy') {
                await this.addStatic(['academy-course', 'academy-beacons'], epoch);
                this.environment.add(this.floor);
            } else {
                this.environment.add(this.floor);
                                                                        
                for (const item of level?.obstacles || []) {
                    const h = item.type === 'tower' ? 7.5 : item.type === 'rock' ? item.size * 1.35 : item.size;
                    const geometry = new THREE.DodecahedronGeometry(item.size * 0.52, 1);
                    const material = new THREE.MeshStandardMaterial({color: item.type === 'rock' ? 0x776e73 : 0x748ca6, roughness: 0.95});
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(item.x, h / 2, item.z);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this.environment.add(mesh);
                }
            }
            if (epoch !== this.epoch) return;
            if (level?.checkpoints) {
                level.checkpoints.forEach((point, index) => {
                    const markerPoint = level.story
                        ? { ...point, y: (point.groundY ?? point.y - 5.2) + 0.08 } : point;
                    const marker = level.story
                        ? makeRescueTarget(THREE, markerPoint, new THREE.Color(level.accent || '#8bdad0'), index)
                        : makeGate(THREE, point, new THREE.Color(level.accent || '#8bdad0'), index);
                    this.gates.push(marker);
                    this.environment.add(marker);
                });
            }
            this.levelReady = true;
        } catch (error) {
            this.levelReady = false;
            if (epoch !== this.epoch) return;
            this.loadError = error;
            console.error('SKYCRAFT: GLB scene failed to load', error);
        }
    }

    async addStatic(ids, epoch) {
        const results = await Promise.allSettled(ids.map(id => loadModel(this.assetLoader, id)));
        if (epoch !== this.epoch) return;
        results.forEach((result, index) => {
            if (result.status !== 'fulfilled') {
                console.warn('SKYCRAFT: environment model unavailable', ids[index], result.reason);
            } else {
                this.environment.add(result.value);
            }
        });
    }

    async rebuildDrone(configuration) {
        const key = partIds(configuration).join('|');
        if (key === this.configurationSignature) return;
        this.configurationSignature = key;
        const parts = await Promise.allSettled(partIds(configuration).map(id => loadModel(this.assetLoader, id)));
        if (this.configurationSignature !== key) return;
        const templates = new Map();
        partIds(configuration).forEach((id,i) => {
            if (parts[i].status === 'fulfilled') templates.set(id, parts[i].value);
        });
        if (!templates.get(configuration.frame)) {
            this.configurationSignature = null;                              
            return;
        }
        this.drone.clear();
        const body = new THREE.Group();
        body.add(templates.get(configuration.frame).clone(true));
        const battery = templates.get(configuration.battery);
        const chip = templates.get(configuration.electronics);
        if (battery) { const mesh = battery.clone(true); mesh.position.set(0, 1.30, -0.08); body.add(mesh); }
        if (chip) { const mesh = chip.clone(true); mesh.position.set(0, 2.36, -0.16); body.add(mesh); }
        const motor = templates.get(configuration.motor);
        const prop = templates.get(configuration.propeller);
        this.rotors = [];
        for (const x of [-2.33, 2.33]) for (const z of [-1.49, 1.49]) {
            if (motor) { const m = motor.clone(true); m.position.set(x, 2.20, z); body.add(m); }
            if (prop) {
                const p = prop.clone(true);
                p.position.set(x, 2.55, z);
                body.add(p);
                this.rotors.push(p);
            }
        }
        const pivot = new THREE.Group();
        body.position.y = -Y_PIVOT;
        pivot.add(body);
        this.drone.add(pivot);
        this.bodyPivot = pivot;
        this.drone.visible = true;
    }

    render(controller) {
        if (controller.level !== this.currentLevel) {
            this.loadLevel(controller.level).catch(error => console.error('SKYCRAFT renderer',error));
        }
        this.rebuildDrone(controller.configuration).catch(error => console.error('SKYCRAFT drone load',error));
        if (!this.levelReady) return false;
        if (!this.drone.children.length) return false;
        const width = Math.max(1, controller.width || controller.canvas.clientWidth);
        const height = Math.max(1, controller.height || controller.canvas.clientHeight);
        if (width !== this.lastWidth || height !== this.lastHeight) {
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.lastWidth = width;
            this.lastHeight = height;
        }
        if (!controller.camera?.forward) controller.updateCamera();
        const pos = controller.camera.position;
        const forward = controller.camera.forward;
        const up = controller.camera.up;
        this.camera.position.set(pos[0], pos[1], pos[2]);
        this.camera.up.set(up[0], up[1], up[2]);
        cameraTarget.set(pos[0] + forward[0], pos[1] + forward[1], pos[2] + forward[2]);
        this.camera.lookAt(cameraTarget);
                                                                      
                                                                     
        this.camera.fov = THREE.MathUtils.clamp(2 * Math.atan(height / (2 * Math.max(controller.focalLength, 1))) * 180 / Math.PI, 24, 85);
        this.camera.updateProjectionMatrix();
        const flight = !!controller.level;
        if (flight) {
            const {position, attitude} = controller;
            this.drone.position.set(position.x, position.y, position.z);
            if (this.bodyPivot) {
                this.bodyPivot.rotation.order = 'YXZ';
                this.bodyPivot.rotation.set(attitude.pitch, window.SkycraftFlightOrientation?.modelYaw(attitude.yaw) || 0, attitude.roll, 'YXZ');
            }
            this.droneLightRig.position.set(position.x, position.y, position.z);
            this.droneLightRig.visible = false;                                   
            this.drone.visible = controller.cameraMode !== 'first';
            const active = controller.tutorial && window.SkycraftTutorial &&
                !['gates', 'landing'].includes(window.SkycraftTutorial.active(controller.tutorial).id);
            this.gates.forEach((gate,index) => {
                gate.visible = !active;
                const current = index === controller.completed;
                const done = index < controller.completed;
                const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.004 + index * 1.4);
                if (gate.userData.type === 'rescue') {
                    gate.userData.neon.opacity = done ? 0.16 : current ? 0.9 : 0.34;
                    gate.userData.beam.emissiveIntensity = done ? 0.12 : current ? 0.65 + pulse * 0.35 : 0.18;
                    if (gate.userData.marker) gate.userData.marker.position.y = 0.04 * pulse;
                } else {
                    gate.userData.neon.opacity = done ? 0.12 : current ? 0.95 : 0.3;
                    gate.userData.beam.emissiveIntensity = current ? 0.8 : 0.08;
                }
            });
            controller.rotorState?.rotors?.forEach((rotor,index) => {
                if (this.rotors[index]) this.rotors[index].rotation.y = rotor.angle || 0;
            });
        } else {
            this.drone.position.set(0, Y_PIVOT, 0);
            this.droneLightRig.position.set(0, Y_PIVOT, 0);
            this.droneLightRig.visible = true;
            if (this.bodyPivot) this.bodyPivot.rotation.set(0, 0, 0);
            this.drone.visible = true;
        }
        const waterTime = performance.now() * 0.00016;
        this.animatedWaterTextures.forEach((texture, index) => {
            texture.offset.x = waterTime * (0.32 + index * 0.015);
            texture.offset.y = waterTime * 0.11;
        });
        this.updateWeather(controller);
        this.renderer.render(this.scene, this.camera);
        return true;
    }

    dispose() {
        this.epoch += 1;
        if (this.weatherSystem) {
            this.scene.remove(this.weatherSystem.mesh);
            this.weatherSystem.mesh.geometry.dispose();
            this.weatherSystem.mesh.material.dispose();
        }
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}

export { SkycraftModernRenderer };
