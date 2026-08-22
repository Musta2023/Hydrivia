import * as THREE from 'three';

/**
 * Modèles 3D botaniques et hydrauliques procéduraux ultra-optimisés pour HYDRIVIA
 * Conçus pour un rendu 60+ FPS et une navigation fluide dans la scène WebGL.
 */

// ==========================================
// 1. GÉNÉRATEURS DE TEXTURES PROCÉDURALES
// ==========================================

export const createProceduralSoilTexture = () => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#26190f';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const radius = Math.random() * 2.0 + 0.5;
      const shade = Math.random();
      if (shade > 0.6) {
        ctx.fillStyle = `rgba(60, 42, 28, ${Math.random() * 0.7 + 0.3})`;
      } else if (shade > 0.3) {
        ctx.fillStyle = `rgba(22, 14, 8, ${Math.random() * 0.8 + 0.2})`;
      } else {
        ctx.fillStyle = `rgba(80, 58, 38, ${Math.random() * 0.4 + 0.1})`;
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
};

export const createProceduralLeafTexture = (type) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (type === 'tomato') {
      grad.addColorStop(0, '#438029');
      grad.addColorStop(0.5, '#2e6b20');
      grad.addColorStop(1, '#1e4d14');
    } else {
      grad.addColorStop(0, '#52b740');
      grad.addColorStop(0.4, '#2d9124');
      grad.addColorStop(1, '#1b6315');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    // Nervure principale
    ctx.strokeStyle = type === 'tomato' ? 'rgba(140, 200, 90, 0.75)' : 'rgba(160, 225, 110, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 256);
    ctx.quadraticCurveTo(63, 128, 64, 0);
    ctx.stroke();

    // Nervures secondaires
    ctx.strokeStyle = type === 'tomato' ? 'rgba(120, 180, 80, 0.5)' : 'rgba(140, 210, 95, 0.55)';
    ctx.lineWidth = 1.5;
    for (let y = 230; y > 20; y -= 24) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(90, y - 12, 120, y - 26);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(38, y - 12, 8, y - 26);
      ctx.stroke();
    }
  }

  return new THREE.CanvasTexture(canvas);
};

export const createProceduralOnionSkinTexture = () => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#f0d999');
    grad.addColorStop(0.3, '#d4a14c');
    grad.addColorStop(0.7, '#ba7a30');
    grad.addColorStop(1, '#824614');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    for (let x = 0; x < 128; x += 3) {
      ctx.strokeStyle = `rgba(90, 45, 10, ${Math.random() * 0.35 + 0.05})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, 128);
      ctx.stroke();
    }
  }
  return new THREE.CanvasTexture(canvas);
};

// Textures mises en cache
let cachedSoilTexture = null;
let cachedTomatoLeafTexture = null;
let cachedMintLeafTexture = null;
let cachedOnionTexture = null;

const getTomatoLeafTexture = () => {
  if (!cachedTomatoLeafTexture && typeof document !== 'undefined') {
    cachedTomatoLeafTexture = createProceduralLeafTexture('tomato');
  }
  return cachedTomatoLeafTexture;
};

const getMintLeafTexture = () => {
  if (!cachedMintLeafTexture && typeof document !== 'undefined') {
    cachedMintLeafTexture = createProceduralLeafTexture('mint');
  }
  return cachedMintLeafTexture;
};

const getOnionSkinTexture = () => {
  if (!cachedOnionTexture && typeof document !== 'undefined') {
    cachedOnionTexture = createProceduralOnionSkinTexture();
  }
  return cachedOnionTexture;
};

// ==========================================
// 2. GÉOMÉTRIES & MATÉRIAUX RÉUTILISABLES
// ==========================================

function createCurvedLeafGeometry(width = 0.16, length = 0.32, curveAmount = 0.06) {
  const segmentsX = 2;
  const segmentsY = 4;
  const geom = new THREE.PlaneGeometry(width, length, segmentsX, segmentsY);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const normalizedY = (y + length / 2) / length;
    const shapeProfile = Math.sin(normalizedY * Math.PI) * (1 - normalizedY * 0.3);
    pos.setX(i, x * (shapeProfile + 0.2));
    const archZ = Math.sin(normalizedY * Math.PI) * curveAmount;
    pos.setZ(i, archZ);
  }

  geom.computeVertexNormals();
  geom.translate(0, length / 2, 0);
  return geom;
}

function createStarCalyxGeometry(scale = 0.045) {
  const geom = new THREE.ConeGeometry(scale * 0.9, scale * 0.5, 5);
  geom.rotateX(Math.PI);
  return geom;
}

const sharedCalyxGeom = createStarCalyxGeometry(0.05);
const sharedCalyxMat = new THREE.MeshStandardMaterial({ color: 0x3d7023, roughness: 0.6 });

// ==========================================
// 3. PLANT DE TOMATE (Solanum lycopersicum)
// ==========================================
export const createTomatoPlantGroup = (health = 'healthy') => {
  const group = new THREE.Group();

  let leafColor = 0x3b7d23;
  let tomatoRipeColor = 0xe02200;
  let tomatoRipeningColor = 0xf58b00;
  let tomatoGreenColor = 0x76b82a;

  if (health === 'warning') {
    leafColor = 0x6e8a2a;
    tomatoRipeColor = 0xc94a10;
  } else if (health === 'critical') {
    leafColor = 0x8a7a35;
    tomatoRipeColor = 0x8a4520;
  }

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x2d5c1e,
    roughness: 0.75,
  });

  const leafTex = getTomatoLeafTexture();
  const leafMat = new THREE.MeshStandardMaterial({
    color: leafColor,
    map: leafTex || undefined,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });

  const ripeTomatoMat = new THREE.MeshStandardMaterial({
    color: tomatoRipeColor,
    roughness: 0.2,
    metalness: 0.05,
  });

  const ripeningTomatoMat = new THREE.MeshStandardMaterial({
    color: tomatoRipeningColor,
    roughness: 0.25,
  });

  const greenTomatoMat = new THREE.MeshStandardMaterial({
    color: tomatoGreenColor,
    roughness: 0.35,
  });

  const woodStakeMat = new THREE.MeshStandardMaterial({
    color: 0x54402a,
    roughness: 0.9,
  });

  // 1. Tuteur en bambou
  const stakeGeom = new THREE.CylinderGeometry(0.016, 0.018, 1.2, 5);
  const stakeMesh = new THREE.Mesh(stakeGeom, woodStakeMat);
  stakeMesh.position.set(-0.05, 0.6, -0.03);
  stakeMesh.castShadow = true;
  group.add(stakeMesh);

  // 2. Tige principale
  const stemPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.02, 0.35, 0.01),
    new THREE.Vector3(-0.02, 0.7, 0.02),
    new THREE.Vector3(0.01, 1.05, -0.01),
    new THREE.Vector3(0.0, 1.18, 0.0),
  ];
  const stemCurve = new THREE.CatmullRomCurve3(stemPoints);
  const mainStemGeom = new THREE.TubeGeometry(stemCurve, 10, 0.016, 5, false);
  const mainStemMesh = new THREE.Mesh(mainStemGeom, stemMat);
  mainStemMesh.castShadow = true;
  group.add(mainStemMesh);

  // 3. Branches avec feuillage
  const branchNodes = [
    { y: 0.3, angle: 0.4, pitch: 0.6, length: 0.36, scale: 0.9 },
    { y: 0.5, angle: -1.2, pitch: 0.55, length: 0.4, scale: 1.0 },
    { y: 0.72, angle: 2.1, pitch: 0.5, length: 0.4, scale: 1.0 },
    { y: 0.92, angle: -2.6, pitch: 0.45, length: 0.32, scale: 0.85 },
    { y: 1.1, angle: 1.0, pitch: 0.35, length: 0.24, scale: 0.7 },
  ];

  branchNodes.forEach((node) => {
    const branchGroup = new THREE.Group();
    branchGroup.position.set(
      Math.sin(node.angle) * 0.02,
      node.y,
      Math.cos(node.angle) * 0.02
    );
    branchGroup.rotation.y = node.angle;
    branchGroup.rotation.x = node.pitch;

    const petioleGeom = new THREE.CylinderGeometry(0.006, 0.009, node.length, 4);
    petioleGeom.translate(0, node.length / 2, 0);
    const petioleMesh = new THREE.Mesh(petioleGeom, stemMat);
    branchGroup.add(petioleMesh);

    // Feuille terminale
    const terminalLeafGeom = createCurvedLeafGeometry(0.14 * node.scale, 0.22 * node.scale, 0.05);
    const terminalLeaf = new THREE.Mesh(terminalLeafGeom, leafMat);
    terminalLeaf.position.set(0, node.length, 0);
    branchGroup.add(terminalLeaf);

    // Folioles latérales
    const pairScale = node.scale * 0.8;
    const pairY = node.length * 0.55;

    const leftGeom = createCurvedLeafGeometry(0.11 * pairScale, 0.17 * pairScale, 0.04);
    const leftLeaf = new THREE.Mesh(leftGeom, leafMat);
    leftLeaf.position.set(0, pairY, 0);
    leftLeaf.rotation.z = Math.PI / 3.2;
    branchGroup.add(leftLeaf);

    const rightGeom = createCurvedLeafGeometry(0.11 * pairScale, 0.17 * pairScale, 0.04);
    const rightLeaf = new THREE.Mesh(rightGeom, leafMat);
    rightLeaf.position.set(0, pairY, 0);
    rightLeaf.rotation.z = -Math.PI / 3.2;
    branchGroup.add(rightLeaf);

    group.add(branchGroup);
  });

  // 4. Grappes de tomates
  const tomatoClusters = [
    {
      y: 0.45,
      angle: -0.6,
      fruits: [
        { radius: 0.08, offset: [0.07, -0.03, 0.09], mat: ripeTomatoMat },
        { radius: 0.072, offset: [-0.05, -0.02, 0.1], mat: ripeTomatoMat },
        { radius: 0.06, offset: [0.02, 0.02, 0.13], mat: ripeningTomatoMat },
      ],
    },
    {
      y: 0.75,
      angle: 1.4,
      fruits: [
        { radius: 0.07, offset: [0.05, -0.02, 0.08], mat: ripeTomatoMat },
        { radius: 0.055, offset: [-0.05, 0.02, 0.1], mat: greenTomatoMat },
      ],
    },
  ];

  tomatoClusters.forEach((cluster) => {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(
      Math.sin(cluster.angle) * 0.03,
      cluster.y,
      Math.cos(cluster.angle) * 0.03
    );
    clusterGroup.rotation.y = cluster.angle;

    cluster.fruits.forEach((f) => {
      const tomatoUnit = new THREE.Group();
      tomatoUnit.position.set(f.offset[0], f.offset[1], f.offset[2]);

      const fruitGeom = new THREE.SphereGeometry(f.radius, 10, 10);
      fruitGeom.scale(1.08, 0.94, 1.08);
      const fruitMesh = new THREE.Mesh(fruitGeom, f.mat);
      fruitMesh.castShadow = true;
      tomatoUnit.add(fruitMesh);

      const calyxMesh = new THREE.Mesh(sharedCalyxGeom, sharedCalyxMat);
      calyxMesh.position.y = f.radius * 0.85;
      calyxMesh.scale.setScalar(f.radius * 14);
      tomatoUnit.add(calyxMesh);

      clusterGroup.add(tomatoUnit);
    });

    group.add(clusterGroup);
  });

  return group;
};

// ==========================================
// 4. PLANT DE MENTHE (Mentha)
// ==========================================
export const createMintPlantGroup = (health = 'healthy') => {
  const group = new THREE.Group();

  let mintColor = 0x2da84a;
  let topShootColor = 0x58d66a;
  if (health === 'warning') {
    mintColor = 0x6e9c35;
    topShootColor = 0x8ab846;
  } else if (health === 'critical') {
    mintColor = 0x8a7a35;
    topShootColor = 0x9a8840;
  }

  const leafTex = getMintLeafTexture();
  const matureLeafMat = new THREE.MeshStandardMaterial({
    color: mintColor,
    map: leafTex || undefined,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  const youngLeafMat = new THREE.MeshStandardMaterial({
    color: topShootColor,
    map: leafTex || undefined,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x1f6630,
    roughness: 0.7,
  });

  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4f8,
    roughness: 0.8,
  });

  const stemConfigs = [
    { height: 0.45, x: 0, z: 0, tiltX: 0, tiltZ: 0, hasFlower: true },
    { height: 0.42, x: 0.07, z: 0.05, tiltX: 0.15, tiltZ: -0.15, hasFlower: true },
    { height: 0.38, x: -0.08, z: 0.04, tiltX: 0.12, tiltZ: 0.18, hasFlower: false },
    { height: 0.35, x: 0.04, z: -0.08, tiltX: -0.18, tiltZ: -0.1, hasFlower: false },
    { height: 0.32, x: -0.07, z: -0.06, tiltX: -0.14, tiltZ: 0.15, hasFlower: false },
  ];

  stemConfigs.forEach((sc) => {
    const stalk = new THREE.Group();
    stalk.position.set(sc.x, 0, sc.z);
    stalk.rotation.x = sc.tiltX;
    stalk.rotation.z = sc.tiltZ;

    const stemGeom = new THREE.BoxGeometry(0.012, sc.height, 0.012);
    stemGeom.translate(0, sc.height / 2, 0);
    const stemMesh = new THREE.Mesh(stemGeom, stemMat);
    stalk.add(stemMesh);

    const numNodes = 3;
    for (let n = 1; n <= numNodes; n++) {
      const nodeY = (sc.height * n) / (numNodes + 0.5);
      const isYoung = n === numNodes;
      const mat = isYoung ? youngLeafMat : matureLeafMat;
      const leafScale = (0.6 + (n / numNodes) * 0.4) * (sc.height / 0.45);
      const nodeRotY = (n % 2) * (Math.PI / 2);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.y = nodeY;
      nodeGroup.rotation.y = nodeRotY;

      const leafGeom1 = createCurvedLeafGeometry(0.085 * leafScale, 0.14 * leafScale, 0.03);
      const leaf1 = new THREE.Mesh(leafGeom1, mat);
      leaf1.rotation.z = Math.PI / 2.6;
      nodeGroup.add(leaf1);

      const leafGeom2 = createCurvedLeafGeometry(0.085 * leafScale, 0.14 * leafScale, 0.03);
      const leaf2 = new THREE.Mesh(leafGeom2, mat);
      leaf2.rotation.z = -Math.PI / 2.6;
      nodeGroup.add(leaf2);

      stalk.add(nodeGroup);
    }

    if (sc.hasFlower) {
      const flowerSpikeGeom = new THREE.CylinderGeometry(0.015, 0.02, 0.07, 6);
      const flowerSpike = new THREE.Mesh(flowerSpikeGeom, flowerMat);
      flowerSpike.position.y = sc.height + 0.035;
      stalk.add(flowerSpike);
    }

    group.add(stalk);
  });

  return group;
};

// ==========================================
// 5. PLANT D'OIGNON (Allium cepa)
// ==========================================
export const createOnionPlantGroup = (health = 'healthy') => {
  const group = new THREE.Group();

  let shootColor = 0x2e8540;
  let bulbColor = 0xd9a852;
  if (health === 'warning') {
    shootColor = 0x768f30;
    bulbColor = 0xc29040;
  } else if (health === 'critical') {
    shootColor = 0x8f7c32;
    bulbColor = 0x9e7330;
  }

  const onionTex = getOnionSkinTexture();
  const bulbMat = new THREE.MeshStandardMaterial({
    color: bulbColor,
    map: onionTex || undefined,
    roughness: 0.55,
    metalness: 0.1,
  });

  const shootMat = new THREE.MeshStandardMaterial({
    color: shootColor,
    roughness: 0.35,
  });

  const sheathMat = new THREE.MeshStandardMaterial({
    color: 0xbfd494,
    roughness: 0.6,
  });

  // Bulbe
  const bulbGeom = new THREE.SphereGeometry(0.11, 10, 10);
  bulbGeom.scale(1.2, 0.95, 1.2);
  const bulbMesh = new THREE.Mesh(bulbGeom, bulbMat);
  bulbMesh.position.y = 0.07;
  bulbMesh.castShadow = true;
  group.add(bulbMesh);

  // Collet
  const neckGeom = new THREE.CylinderGeometry(0.045, 0.065, 0.12, 8);
  const neckMesh = new THREE.Mesh(neckGeom, sheathMat);
  neckMesh.position.y = 0.16;
  group.add(neckMesh);

  // Tiges tubulaires
  const shootBlades = [
    { height: 0.68, angle: 0.2, curveDist: 0.18, rad: 0.022 },
    { height: 0.62, angle: 1.5, curveDist: 0.2, rad: 0.02 },
    { height: 0.56, angle: -1.2, curveDist: 0.16, rad: 0.019 },
    { height: 0.48, angle: -2.6, curveDist: 0.16, rad: 0.017 },
  ];

  shootBlades.forEach((b) => {
    const curvePoints = [
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(
        Math.sin(b.angle) * (b.curveDist * 0.4),
        0.2 + b.height * 0.5,
        Math.cos(b.angle) * (b.curveDist * 0.4)
      ),
      new THREE.Vector3(
        Math.sin(b.angle) * b.curveDist,
        0.2 + b.height,
        Math.cos(b.angle) * b.curveDist
      ),
    ];
    const bladeCurve = new THREE.CatmullRomCurve3(curvePoints);
    const bladeGeom = new THREE.TubeGeometry(bladeCurve, 8, b.rad, 5, false);
    const bladeMesh = new THREE.Mesh(bladeGeom, shootMat);
    group.add(bladeMesh);
  });

  return group;
};

// ==========================================
// 6. RÉSERVOIR D'EAU 7000 L
// ==========================================
export const createWaterTankMesh = (capacityL = 7000, currentL = 5250) => {
  const group = new THREE.Group();
  const radius = 1.9;
  const height = 2.4;
  const fillRatio = Math.max(0.05, Math.min(1.0, currentL / capacityL));

  // Socle en béton
  const baseGeom = new THREE.CylinderGeometry(radius * 1.15, radius * 1.2, 0.35, 24);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e2e28, roughness: 0.85, metalness: 0.2 });
  const baseMesh = new THREE.Mesh(baseGeom, baseMat);
  baseMesh.position.y = 0.175;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Paroi translucide
  const wallGeom = new THREE.CylinderGeometry(radius, radius, height, 24, 1, true);
  const wallMat = new THREE.MeshPhysicalMaterial({
    color: 0x90d4e8,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.8,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wallMesh = new THREE.Mesh(wallGeom, wallMat);
  wallMesh.position.y = 0.35 + height / 2;
  group.add(wallMesh);

  // Dôme / Toit
  const roofGeom = new THREE.ConeGeometry(radius * 1.05, 0.55, 24);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x16221e, metalness: 0.85, roughness: 0.35 });
  const roofMesh = new THREE.Mesh(roofGeom, roofMat);
  roofMesh.position.y = 0.35 + height + 0.275;
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // Volume d'eau interne
  const waterHeight = height * fillRatio;
  const waterGeom = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, waterHeight, 20);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x006633,
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
  });
  const waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.name = 'tank-water-body';
  waterMesh.position.y = 0.35 + waterHeight / 2;
  group.add(waterMesh);

  // Disque surface d'eau
  const topDiskGeom = new THREE.CircleGeometry(radius * 0.94, 20);
  const topDiskMat = new THREE.MeshStandardMaterial({
    color: 0x38efc6,
    emissive: 0x00ff88,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const topDisk = new THREE.Mesh(topDiskGeom, topDiskMat);
  topDisk.name = 'tank-water-surface';
  topDisk.rotation.x = -Math.PI / 2;
  topDisk.position.y = 0.35 + waterHeight;
  group.add(topDisk);

  return group;
};

// ==========================================
// 7. GROUPE MOTOPOMPE 30 L/MIN
// ==========================================
export const createPumpMesh = () => {
  const group = new THREE.Group();

  const motorMat = new THREE.MeshStandardMaterial({ color: 0x122e20, roughness: 0.35, metalness: 0.7 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x0f1714, roughness: 0.6, metalness: 0.85 });

  const baseGeom = new THREE.BoxGeometry(1.6, 0.15, 0.9);
  const baseMesh = new THREE.Mesh(baseGeom, ironMat);
  baseMesh.position.y = 0.075;
  group.add(baseMesh);

  const motorGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.85, 16);
  const motorMesh = new THREE.Mesh(motorGeom, motorMat);
  motorMesh.rotation.z = Math.PI / 2;
  motorMesh.position.set(-0.25, 0.45, 0);
  motorMesh.castShadow = true;
  group.add(motorMesh);

  const voluteGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 16);
  const voluteMesh = new THREE.Mesh(voluteGeom, motorMat);
  voluteMesh.position.set(0.4, 0.45, 0);
  voluteMesh.castShadow = true;
  group.add(voluteMesh);

  const outletGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12);
  const outletMesh = new THREE.Mesh(outletGeom, ironMat);
  outletMesh.position.set(0.4, 0.8, 0);
  group.add(outletMesh);

  const gaugeDialGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12);
  const gaugeDialMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const gaugeDial = new THREE.Mesh(gaugeDialGeom, gaugeDialMat);
  gaugeDial.rotation.x = Math.PI / 2;
  gaugeDial.position.set(0.4, 1.12, 0.12);
  group.add(gaugeDial);

  return group;
};

// ==========================================
// 8. ÉLECTROVANNE SOLÉNOÏDE
// ==========================================
export const createValveMesh = (state = 'OFF') => {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2e28, roughness: 0.5, metalness: 0.75 });
  const actuatorMat = new THREE.MeshStandardMaterial({ color: 0x2a423a, roughness: 0.4, metalness: 0.65 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: state === 'ON' ? 0x00ff88 : 0xff3b3b,
    emissive: state === 'ON' ? 0x00ff88 : 0xff2222,
    emissiveIntensity: 0.9,
  });

  const bodyGeom = new THREE.BoxGeometry(0.4, 0.35, 0.35);
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.position.y = 0.18;
  group.add(bodyMesh);

  const coilGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.4, 12);
  const coilMesh = new THREE.Mesh(coilGeom, actuatorMat);
  coilMesh.position.y = 0.48;
  group.add(coilMesh);

  const ledGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const ledMesh = new THREE.Mesh(ledGeom, ledMat);
  ledMesh.name = 'valve-led';
  ledMesh.position.y = 0.72;
  group.add(ledMesh);

  return group;
};

// ==========================================
// 9. SONDE IOT CONNECTÉE
// ==========================================
export const createSensorStakeMesh = (online = true) => {
  const group = new THREE.Group();

  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x0d1311, roughness: 0.4 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: online ? 0x00ff88 : 0xff3b3b,
    emissive: online ? 0x00ff88 : 0xff3b3b,
    emissiveIntensity: 0.8,
  });

  const rodGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
  const rod = new THREE.Mesh(rodGeom, stakeMat);
  rod.position.y = 0.35;
  group.add(rod);

  const headGeom = new THREE.BoxGeometry(0.15, 0.12, 0.12);
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 0.72;
  group.add(head);

  const antGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4);
  const ant = new THREE.Mesh(antGeom, stakeMat);
  ant.position.y = 0.9;
  group.add(ant);

  const ledGeom = new THREE.SphereGeometry(0.03, 6, 6);
  const led = new THREE.Mesh(ledGeom, ledMat);
  led.position.set(0, 0.74, 0.065);
  group.add(led);

  return group;
};
