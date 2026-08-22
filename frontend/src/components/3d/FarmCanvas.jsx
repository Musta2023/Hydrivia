import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  createTomatoPlantGroup,
  createMintPlantGroup,
  createOnionPlantGroup,
  createWaterTankMesh,
  createPumpMesh,
  createValveMesh,
  createSensorStakeMesh,
  createProceduralSoilTexture,
} from './farm3dModels';

export default function FarmCanvas({
  telemetry,
  selectedZoneId,
  setSelectedZoneId,
  selectedElement,
  setSelectedElement,
  cameraPreset,
  setCameraPreset,
  onToggleValve,
  onTogglePump,
}) {
  const containerRef = useRef(null);
  const [hoveredObject, setHoveredObject] = useState(null);

  // References Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  const controlsState = useRef({
    target: new THREE.Vector3(0, 1, 0),
    desiredTarget: new THREE.Vector3(0, 1, 0),
    desiredPosition: new THREE.Vector3(0, 14, 22),
    isDragging: false,
    prevMousePos: { x: 0, y: 0 },
    spherical: new THREE.Spherical(26, Math.PI / 3.8, 0),
  });

  // Dynamic 3D references
  const tankWaterRef = useRef(null);
  const tankDiskRef = useRef(null);
  const pipeWaterParticlesRef = useRef(null);
  const mistParticlesRef = useRef(null);
  const valveMeshesRef = useRef(new Map());
  const zoneGroupsRef = useRef(new Map());
  const zoneBorderRingsRef = useRef(new Map());
  const animatedCropsRef = useRef([]);
  const interactiveObjectsRef = useRef([]);

  // 3D Highlight references
  const highlightMeshesRef = useRef({
    zones: new Map(),
    pump: null,
    tank: null,
    valves: new Map(),
    sensors: new Map(),
  });

  // Screen-projected 2D coordinates for the active visual connector
  const [projectedAnchor, setProjectedAnchor] = useState(null);

  const zonesData = telemetry?.zones || {
    1: { id: 1, plant: 'Tomate', soil_humidity: 45.0, valve: 'OFF' },
    2: { id: 2, plant: 'Menthe', soil_humidity: 52.0, valve: 'OFF' },
    3: { id: 3, plant: 'Oignon', soil_humidity: 38.0, valve: 'OFF' },
  };

  const tankData = telemetry?.tank || {
    water_level: 75.0,
    volume_liters: 5250.0,
    capacity_liters: 7000.0,
  };

  const pumpData = telemetry?.pump || {
    pump: 'OFF',
    flow_rate: 30,
  };

  // Presets caméra
  const applyCameraPreset = useCallback((preset) => {
    const s = controlsState.current;
    if (preset === 'free') {
      s.desiredPosition.set(0, 14, 22);
      s.desiredTarget.set(0, 1, 0);
    } else if (preset === 'top') {
      s.desiredPosition.set(0, 26, 0.1);
      s.desiredTarget.set(0, 0, 0);
    } else if (preset === 'water_path') {
      s.desiredPosition.set(4, 7, 14);
      s.desiredTarget.set(2, 1, 4);
    } else if (preset === 'zone1') {
      s.desiredPosition.set(-7, 7, 7);
      s.desiredTarget.set(-7, 0.5, -2);
    } else if (preset === 'zone2') {
      s.desiredPosition.set(0, 7, 7);
      s.desiredTarget.set(0, 0.5, -2);
    } else if (preset === 'zone3') {
      s.desiredPosition.set(7, 7, 7);
      s.desiredTarget.set(7, 0.5, -2);
    } else if (preset === 'tank') {
      s.desiredPosition.set(9, 5, 11);
      s.desiredTarget.set(6, 1.5, 5);
    } else if (preset === 'pump') {
      s.desiredPosition.set(-1, 4, 10);
      s.desiredTarget.set(-2, 0.6, 5);
    }
  }, []);

  useEffect(() => {
    applyCameraPreset(cameraPreset);
  }, [cameraPreset, applyCameraPreset]);

  // Initialisation Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070a09);
    scene.fog = new THREE.FogExp2(0x070a09, 0.016);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 200);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xd4e8d4, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x00ff88, 0x070a09, 0.65);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    dirLight.position.set(25, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x00b4d8, 0.5);
    fillLight.position.set(-20, 15, -15);
    scene.add(fillLight);

    // 5. Environnement : Collines & Arbres
    const createDistantMountains = () => {
      const group = new THREE.Group();
      const mountMat = new THREE.MeshStandardMaterial({
        color: 0x0d1a14,
        roughness: 0.95,
        flatShading: true,
      });

      const peaks = [
        { x: -35, z: -45, r: 18, h: 12 },
        { x: -10, z: -55, r: 24, h: 16 },
        { x: 15, z: -50, r: 22, h: 14 },
        { x: 40, z: -45, r: 20, h: 13 },
        { x: -50, z: -25, r: 16, h: 9 },
        { x: 50, z: -25, r: 16, h: 9 },
      ];

      peaks.forEach((p) => {
        const geom = new THREE.ConeGeometry(p.r, p.h, 7);
        const mesh = new THREE.Mesh(geom, mountMat);
        mesh.position.set(p.x, p.h / 2 - 2, p.z);
        group.add(mesh);
      });

      const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x2e1c11, roughness: 0.9 });
      const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x13381a, roughness: 0.8 });
      const treeGeom = new THREE.DodecahedronGeometry(0.8, 1);
      const trunkGeom = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 5);

      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        const rad = 24 + Math.random() * 8;
        const x = Math.cos(angle) * rad;
        const z = Math.sin(angle) * rad - 5;
        if (z > 14) continue;

        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeom, treeTrunkMat);
        trunk.position.y = 0.6;
        tree.add(trunk);

        const crown = new THREE.Mesh(treeGeom, treeLeafMat);
        crown.position.y = 1.6;
        crown.scale.set(1.2 + Math.random() * 0.4, 1.4 + Math.random() * 0.5, 1.2 + Math.random() * 0.4);
        tree.add(crown);

        tree.position.set(x, 0, z);
        group.add(tree);
      }

      return group;
    };
    scene.add(createDistantMountains());

    // 6. Sol & Terrain principal
    const groundGeom = new THREE.PlaneGeometry(80, 80, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f1a14,
      roughness: 0.9,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Allée centrale
    const pathGeom = new THREE.PlaneGeometry(28, 20);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x16221c,
      roughness: 0.95,
    });
    const pathMesh = new THREE.Mesh(pathGeom, pathMat);
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.set(0, 0.01, 1);
    pathMesh.receiveShadow = true;
    scene.add(pathMesh);

    // 7. Parcelles Agricoles (Zone 1 Tomate, Zone 2 Menthe, Zone 3 Oignon)
    const zoneConfigs = [
      { id: 1, x: -7, z: -2, width: 5.4, depth: 9.0, crop: 'tomato', name: 'ZONE 1', color: 0x00ff88 },
      { id: 2, x: 0, z: -2, width: 5.4, depth: 9.0, crop: 'mint', name: 'ZONE 2', color: 0x00ffcc },
      { id: 3, x: 7, z: -2, width: 5.4, depth: 9.0, crop: 'onion', name: 'ZONE 3', color: 0xffaa00 },
    ];

    zoneGroupsRef.current.clear();
    zoneBorderRingsRef.current.clear();
    highlightMeshesRef.current.zones.clear();
    highlightMeshesRef.current.valves.clear();
    highlightMeshesRef.current.sensors.clear();
    animatedCropsRef.current = [];
    interactiveObjectsRef.current = [];

    const soilTexture = createProceduralSoilTexture();

    const dripTubeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,
      metalness: 0.2,
    });
    const emitterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.4,
      metalness: 0.3,
    });

    zoneConfigs.forEach((zc) => {
      const zoneGroup = new THREE.Group();
      zoneGroup.name = `zone-group-${zc.id}`;
      zoneGroup.position.set(zc.x, 0, zc.z);

      // Lit de terre surélevé
      const soilBedGeom = new THREE.BoxGeometry(zc.width, 0.35, zc.depth);
      const soilBedMat = new THREE.MeshStandardMaterial({
        color: 0x2b1d14,
        map: soilTexture,
        roughness: 0.92,
        metalness: 0.05,
      });
      const soilBed = new THREE.Mesh(soilBedGeom, soilBedMat);
      soilBed.position.y = 0.175;
      soilBed.receiveShadow = true;
      soilBed.castShadow = true;
      soilBed.userData = { type: 'zone', id: zc.id };
      zoneGroup.add(soilBed);
      interactiveObjectsRef.current.push(soilBed);

      // Sillons et cultures (4 rangées x 5 plants)
      const furrowMat = new THREE.MeshStandardMaterial({
        color: 0x23160e,
        map: soilTexture,
        roughness: 0.95,
      });
      const numRows = 4;
      const rowSpacing = (zc.width - 0.9) / (numRows - 1);
      const cropsInRow = 5;
      const cropSpacing = (zc.depth - 1.4) / (cropsInRow - 1);

      for (let r = 0; r < numRows; r++) {
        const rowX = -zc.width / 2 + 0.45 + r * rowSpacing;

        const furrowGeom = new THREE.CylinderGeometry(0.18, 0.22, zc.depth - 0.4, 6);
        const furrowMesh = new THREE.Mesh(furrowGeom, furrowMat);
        furrowMesh.rotation.x = Math.PI / 2;
        furrowMesh.position.set(rowX, 0.36, 0);
        furrowMesh.receiveShadow = true;
        zoneGroup.add(furrowMesh);

        const dripTubeGeom = new THREE.CylinderGeometry(0.016, 0.016, zc.depth - 0.5, 4);
        const dripTube = new THREE.Mesh(dripTubeGeom, dripTubeMat);
        dripTube.rotation.x = Math.PI / 2;
        dripTube.position.set(rowX + 0.08, 0.38, 0);
        zoneGroup.add(dripTube);

        for (let c = 0; c < cropsInRow; c++) {
          const cropZ = -zc.depth / 2 + 0.7 + c * cropSpacing;
          let plantGroup;

          if (zc.crop === 'tomato') {
            plantGroup = createTomatoPlantGroup('healthy');
          } else if (zc.crop === 'mint') {
            plantGroup = createMintPlantGroup('healthy');
          } else {
            plantGroup = createOnionPlantGroup('healthy');
          }

          const baseRotX = (Math.random() - 0.5) * 0.06;
          const baseRotZ = (Math.random() - 0.5) * 0.06;
          plantGroup.position.set(rowX + (Math.random() - 0.5) * 0.04, 0.38, cropZ + (Math.random() - 0.5) * 0.04);
          plantGroup.scale.setScalar(0.92 + Math.random() * 0.18);
          plantGroup.rotation.y = Math.random() * Math.PI * 2;
          plantGroup.rotation.x = baseRotX;
          plantGroup.rotation.z = baseRotZ;
          plantGroup.userData = { type: 'crop', zoneId: zc.id, crop: zc.crop };
          zoneGroup.add(plantGroup);
          interactiveObjectsRef.current.push(plantGroup);

          animatedCropsRef.current.push({
            mesh: plantGroup,
            baseRotX,
            baseRotZ,
            speed: 1.6 + Math.random() * 0.8,
            phase: Math.random() * Math.PI * 2,
          });

          const emitterGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 4);
          const emitter = new THREE.Mesh(emitterGeom, emitterMat);
          emitter.position.set(rowX + 0.08, 0.39, cropZ);
          zoneGroup.add(emitter);
        }
      }

      // Sonde d'humidité IoT
      const sensorStake = createSensorStakeMesh(true);
      sensorStake.position.set(zc.width / 2 - 0.5, 0.36, zc.depth / 2 - 0.8);
      sensorStake.userData = { type: 'sensor', zoneId: zc.id };
      zoneGroup.add(sensorStake);
      interactiveObjectsRef.current.push(sensorStake);

      // Highlight Halo pour Sonde
      const sensorHaloGeom = new THREE.RingGeometry(0.25, 0.42, 24);
      const sensorHaloMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      const sensorHalo = new THREE.Mesh(sensorHaloGeom, sensorHaloMat);
      sensorHalo.rotation.x = -Math.PI / 2;
      sensorHalo.position.set(zc.width / 2 - 0.5, 0.37, zc.depth / 2 - 0.8);
      zoneGroup.add(sensorHalo);
      highlightMeshesRef.current.sensors.set(zc.id, sensorHalo);

      // Bordure néon standard
      const ringPoints = [
        new THREE.Vector3(-zc.width / 2 - 0.05, 0.38, -zc.depth / 2 - 0.05),
        new THREE.Vector3(zc.width / 2 + 0.05, 0.38, -zc.depth / 2 - 0.05),
        new THREE.Vector3(zc.width / 2 + 0.05, 0.38, zc.depth / 2 + 0.05),
        new THREE.Vector3(-zc.width / 2 - 0.05, 0.38, zc.depth / 2 + 0.05),
        new THREE.Vector3(-zc.width / 2 - 0.05, 0.38, -zc.depth / 2 - 0.05),
      ];
      const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPoints);
      const ringMat = new THREE.LineBasicMaterial({
        color: zc.color,
        linewidth: 2,
        transparent: true,
        opacity: 0.45,
      });
      const borderLine = new THREE.Line(ringGeom, ringMat);
      borderLine.name = `zone-border-${zc.id}`;
      zoneGroup.add(borderLine);
      zoneBorderRingsRef.current.set(zc.id, borderLine);

      // Highlight Selection Box pour Zone
      const selRingMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        linewidth: 4,
        transparent: true,
        opacity: 0,
      });
      const selBorder = new THREE.Line(ringGeom.clone(), selRingMat);
      selBorder.position.y = 0.02;
      zoneGroup.add(selBorder);
      highlightMeshesRef.current.zones.set(zc.id, selBorder);

      scene.add(zoneGroup);
      zoneGroupsRef.current.set(zc.id, zoneGroup);
    });

    // 8. Réservoir d'eau 7000 L
    const tankGroup = createWaterTankMesh(tankData.capacity_liters, tankData.volume_liters);
    tankGroup.position.set(6.2, 0, 5.2);
    tankGroup.userData = { type: 'tank' };
    scene.add(tankGroup);
    interactiveObjectsRef.current.push(tankGroup);

    // Highlight Halo Réservoir
    const tankHaloGeom = new THREE.RingGeometry(2.3, 2.7, 36);
    const tankHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const tankHalo = new THREE.Mesh(tankHaloGeom, tankHaloMat);
    tankHalo.rotation.x = -Math.PI / 2;
    tankHalo.position.set(6.2, 0.03, 5.2);
    scene.add(tankHalo);
    highlightMeshesRef.current.tank = tankHalo;

    const waterBody = tankGroup.getObjectByName('tank-water-body');
    const waterSurf = tankGroup.getObjectByName('tank-water-surface');
    if (waterBody) tankWaterRef.current = waterBody;
    if (waterSurf) tankDiskRef.current = waterSurf;

    // 9. Pompe principale 30 L/min
    const pumpGroup = createPumpMesh();
    pumpGroup.position.set(-2.2, 0, 5.2);
    pumpGroup.userData = { type: 'pump' };
    scene.add(pumpGroup);
    interactiveObjectsRef.current.push(pumpGroup);

    // Highlight Halo Pompe
    const pumpHaloGeom = new THREE.RingGeometry(1.3, 1.6, 32);
    const pumpHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const pumpHalo = new THREE.Mesh(pumpHaloGeom, pumpHaloMat);
    pumpHalo.rotation.x = -Math.PI / 2;
    pumpHalo.position.set(-2.2, 0.03, 5.2);
    scene.add(pumpHalo);
    highlightMeshesRef.current.pump = pumpHalo;

    // 10. Réseau hydraulique et électrovannes
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x2a423a,
      metalness: 0.85,
      roughness: 0.25,
    });
    const pipeGeom = new THREE.CylinderGeometry(0.12, 0.12, 1, 16);

    const pipeTankToPump = new THREE.Mesh(pipeGeom, pipeMat);
    pipeTankToPump.rotation.z = Math.PI / 2;
    pipeTankToPump.scale.y = 7.0;
    pipeTankToPump.position.set(2.0, 0.45, 5.2);
    scene.add(pipeTankToPump);

    const pipePumpToLeft = new THREE.Mesh(pipeGeom, pipeMat);
    pipePumpToLeft.rotation.z = Math.PI / 2;
    pipePumpToLeft.scale.y = 6.2;
    pipePumpToLeft.position.set(-5.6, 0.45, 5.2);
    scene.add(pipePumpToLeft);

    const pipeNorth1 = new THREE.Mesh(pipeGeom, pipeMat);
    pipeNorth1.rotation.x = Math.PI / 2;
    pipeNorth1.scale.y = 2.4;
    pipeNorth1.position.set(-8.7, 0.45, 4.0);
    scene.add(pipeNorth1);

    const pipeManifold = new THREE.Mesh(pipeGeom, pipeMat);
    pipeManifold.rotation.z = Math.PI / 2;
    pipeManifold.scale.y = 16.6;
    pipeManifold.position.set(-0.4, 0.45, 2.8);
    scene.add(pipeManifold);

    // 3 Électrovannes
    valveMeshesRef.current.clear();
    const valvePositions = [
      { id: 1, x: -7.0, z: 2.8 },
      { id: 2, x: 0.0, z: 2.8 },
      { id: 3, x: 7.0, z: 2.8 },
    ];

    valvePositions.forEach((vp) => {
      const valve = createValveMesh('OFF');
      valve.position.set(vp.x, 0.45, vp.z);
      valve.userData = { type: 'valve', zoneId: vp.id };
      scene.add(valve);
      valveMeshesRef.current.set(vp.id, valve);
      interactiveObjectsRef.current.push(valve);

      // Highlight Halo Vanne
      const valveHaloGeom = new THREE.RingGeometry(0.4, 0.6, 24);
      const valveHaloMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      const valveHalo = new THREE.Mesh(valveHaloGeom, valveHaloMat);
      valveHalo.rotation.x = -Math.PI / 2;
      valveHalo.position.set(vp.x, 0.03, vp.z);
      scene.add(valveHalo);
      highlightMeshesRef.current.valves.set(vp.id, valveHalo);

      const subPipe = new THREE.Mesh(pipeGeom, pipeMat);
      subPipe.rotation.x = Math.PI / 2;
      subPipe.scale.y = 1.2;
      subPipe.position.set(vp.x, 0.45, vp.z - 0.6);
      scene.add(subPipe);

      const riser = new THREE.Mesh(pipeGeom, pipeMat);
      riser.scale.set(0.6, 1.2, 0.6);
      riser.position.set(vp.x, 1.0, vp.z - 1.2);
      scene.add(riser);

      const nozzleGeom = new THREE.ConeGeometry(0.16, 0.2, 12);
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
      nozzle.position.set(vp.x, 1.6, vp.z - 1.2);
      scene.add(nozzle);
    });

    // 11. Particules de flux d'eau
    const particleCount = 140;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 16;
      particlePositions[i * 3 + 1] = 0.45 + (Math.random() - 0.5) * 0.08;
      particlePositions[i * 3 + 2] = 5.2 + (Math.random() - 0.5) * 0.08;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00ff88,
      size: 0.14,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const pipeParticles = new THREE.Points(particleGeom, particleMat);
    scene.add(pipeParticles);
    pipeWaterParticlesRef.current = pipeParticles;

    // 12. Particules de brumisation
    const mistCount = 200;
    const mistGeom = new THREE.BufferGeometry();
    const mistPositions = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      mistPositions[i * 3] = (Math.random() - 0.5) * 18;
      mistPositions[i * 3 + 1] = 0.5 + Math.random() * 1.8;
      mistPositions[i * 3 + 2] = -2 + (Math.random() - 0.5) * 8;
    }
    mistGeom.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    const mistMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.12,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const mistParticles = new THREE.Points(mistGeom, mistMat);
    scene.add(mistParticles);
    mistParticlesRef.current = mistParticles;

    // Gestion de la souris
    let animationFrameId;
    let clock = new THREE.Clock();
    let lastHoverTime = 0;

    const handleMouseDown = (e) => {
      if (e.button === 0 || e.button === 2) {
        controlsState.current.isDragging = true;
        controlsState.current.prevMousePos = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e) => {
      if (controlsState.current.isDragging) {
        const deltaX = e.clientX - controlsState.current.prevMousePos.x;
        const deltaY = e.clientY - controlsState.current.prevMousePos.y;
        controlsState.current.prevMousePos = { x: e.clientX, y: e.clientY };

        const s = controlsState.current;
        if (e.buttons === 1) {
          s.spherical.theta -= deltaX * 0.007;
          s.spherical.phi = Math.max(0.12, Math.min(Math.PI / 2.1, s.spherical.phi - deltaY * 0.007));
          s.desiredPosition.setFromSpherical(s.spherical).add(s.desiredTarget);
        } else if (e.buttons === 2) {
          const panSpeed = 0.018;
          const right = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
          s.desiredTarget.addScaledVector(right, deltaX * panSpeed);
          s.desiredPosition.addScaledVector(right, deltaX * panSpeed);
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, true);
      if (intersects.length > 0) {
        let topObj = intersects[0].object;
        let foundName = null;
        while (topObj && !foundName) {
          if (topObj.userData?.type) {
            foundName = `${topObj.userData.type} ${topObj.userData.id || topObj.userData.zoneId || ''}`;
          }
          topObj = topObj.parent;
        }
        setHoveredObject(foundName);
      } else {
        setHoveredObject(null);
      }
    };

    const handleMouseUp = () => {
      controlsState.current.isDragging = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const s = controlsState.current;
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      s.spherical.radius = Math.max(8, Math.min(50, s.spherical.radius * zoomFactor));
      s.desiredPosition.setFromSpherical(s.spherical).add(s.desiredTarget);
    };

    const handleClick = (e) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        let foundData = null;
        while (obj) {
          if (obj.userData?.type) {
            foundData = obj.userData;
            break;
          }
          obj = obj.parent;
        }

        if (foundData) {
          if (foundData.type === 'zone') {
            const zId = Number(foundData.id);
            setSelectedZoneId(zId);
            setSelectedElement({ type: 'zone', id: zId });
          } else if (foundData.type === 'crop') {
            const zId = Number(foundData.zoneId);
            setSelectedZoneId(zId);
            setSelectedElement({ type: 'zone', id: zId });
          } else if (foundData.type === 'sensor') {
            const zId = Number(foundData.zoneId);
            setSelectedElement({ type: 'sensor', id: zId });
          } else if (foundData.type === 'valve') {
            const vId = Number(foundData.zoneId);
            setSelectedElement({ type: 'valve', id: vId });
          } else if (foundData.type === 'pump') {
            setSelectedElement({ type: 'pump', id: 'main-pump' });
          } else if (foundData.type === 'tank') {
            setSelectedElement({ type: 'tank', id: 'main-tank' });
          }
        }
      } else {
        // Clic dans le vide -> Désélection propre
        setSelectedElement(null);
        setSelectedZoneId(null);
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('click', handleClick);
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Coordonnées 3D monde des éléments sélectionnables
    const getAnchorWorldPos = (type, id) => {
      if (type === 'zone') {
        const zId = Number(id);
        const map = {
          1: new THREE.Vector3(-7, 0.45, -2),
          2: new THREE.Vector3(0, 0.45, -2),
          3: new THREE.Vector3(7, 0.45, -2),
        };
        return map[zId] || new THREE.Vector3(0, 0.45, 0);
      }
      if (type === 'sensor') {
        const zId = Number(id);
        const map = {
          1: new THREE.Vector3(-4.8, 0.8, 1.7),
          2: new THREE.Vector3(2.2, 0.8, 1.7),
          3: new THREE.Vector3(9.2, 0.8, 1.7),
        };
        return map[zId] || new THREE.Vector3(0, 0.8, 0);
      }
      if (type === 'valve') {
        const vId = Number(id);
        const map = {
          1: new THREE.Vector3(-7.0, 0.7, 2.8),
          2: new THREE.Vector3(0.0, 0.7, 2.8),
          3: new THREE.Vector3(7.0, 0.7, 2.8),
        };
        return map[vId] || new THREE.Vector3(0, 0.7, 2.8);
      }
      if (type === 'pump') {
        return new THREE.Vector3(-2.2, 0.9, 5.2);
      }
      if (type === 'tank') {
        return new THREE.Vector3(6.2, 2.6, 5.2);
      }
      return null;
    };

    // Boucle d'animation
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Interpolation fluide de la caméra
      const s = controlsState.current;
      const lerpFactor = s.isDragging ? 0.35 : 0.12;
      camera.position.lerp(s.desiredPosition, lerpFactor);
      s.target.lerp(s.desiredTarget, lerpFactor);
      camera.lookAt(s.target);

      // Calcul projection 3D -> 2D pour la ligne de liaison et l'annotation flottante
      if (selectedElementRef.current && cameraRef.current && containerRef.current) {
        const pos3D = getAnchorWorldPos(selectedElementRef.current.type, selectedElementRef.current.id);
        if (pos3D) {
          const projected = pos3D.clone().project(cameraRef.current);
          const rect = containerRef.current.getBoundingClientRect();
          const isFront = projected.z < 1.0;

          if (isFront && rect.width > 0 && rect.height > 0) {
            const screenX = ((projected.x + 1) / 2) * rect.width;
            const screenY = ((-projected.y + 1) / 2) * rect.height;
            setProjectedAnchor({ x: screenX, y: screenY, visible: true });
          } else {
            setProjectedAnchor((prev) => (prev ? { ...prev, visible: false } : null));
          }
        }
      } else {
        setProjectedAnchor(null);
      }

      // Animation dynamique des Highlight Halos
      const pulse = Math.sin(elapsed * 4.5) * 0.2 + 0.8;
      const sel = selectedElementRef.current;

      // Zones Highlights
      highlightMeshesRef.current.zones.forEach((mesh, zId) => {
        const isSelected = sel?.type === 'zone' && Number(sel.id) === zId;
        mesh.material.opacity = isSelected ? 0.95 * pulse : 0.0;
        mesh.position.y = isSelected ? 0.02 + Math.sin(elapsed * 3) * 0.01 : 0.02;
      });

      // Pump Highlight
      if (highlightMeshesRef.current.pump) {
        const isSelected = sel?.type === 'pump';
        highlightMeshesRef.current.pump.material.opacity = isSelected ? 0.85 * pulse : 0.0;
        if (isSelected) {
          highlightMeshesRef.current.pump.scale.setScalar(1.0 + Math.sin(elapsed * 4) * 0.03);
        }
      }

      // Tank Highlight
      if (highlightMeshesRef.current.tank) {
        const isSelected = sel?.type === 'tank';
        highlightMeshesRef.current.tank.material.opacity = isSelected ? 0.85 * pulse : 0.0;
        if (isSelected) {
          highlightMeshesRef.current.tank.scale.setScalar(1.0 + Math.sin(elapsed * 4) * 0.02);
        }
      }

      // Valves Highlights
      highlightMeshesRef.current.valves.forEach((mesh, vId) => {
        const isSelected = sel?.type === 'valve' && Number(sel.id) === vId;
        mesh.material.opacity = isSelected ? 0.9 * pulse : 0.0;
        if (isSelected) {
          mesh.scale.setScalar(1.0 + Math.sin(elapsed * 5) * 0.04);
        }
      });

      // Sensors Highlights
      highlightMeshesRef.current.sensors.forEach((mesh, sId) => {
        const isSelected = sel?.type === 'sensor' && Number(sel.id) === sId;
        mesh.material.opacity = isSelected ? 0.95 * pulse : 0.0;
        if (isSelected) {
          mesh.scale.setScalar(1.0 + Math.sin(elapsed * 5) * 0.05);
        }
      });

      // Animation d'écoulement d'eau
      if (pipeWaterParticlesRef.current) {
        const geom = pipeWaterParticlesRef.current.geometry;
        const pos = geom.attributes.position.array;
        const isFlowing = pumpData.pump === 'ON' || Object.values(zonesData).some((z) => z.valve === 'ON' || z.watering_active);

        for (let i = 0; i < particleCount; i++) {
          if (isFlowing) {
            pos[i * 3] -= delta * 6.5;
            if (pos[i * 3] < -8.5) {
              pos[i * 3] = 6.2;
            }
          }
        }
        geom.attributes.position.needsUpdate = true;
        pipeWaterParticlesRef.current.material.opacity = isFlowing ? 0.9 : 0.2;
      }

      // Brume des arroseurs
      if (mistParticlesRef.current) {
        const anyIrrigating = Object.values(zonesData).some((z) => z.valve === 'ON' || z.watering_active);
        const mat = mistParticlesRef.current.material;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, anyIrrigating ? 0.65 : 0.0, 0.1);

        if (mat.opacity > 0.01) {
          const geom = mistParticlesRef.current.geometry;
          const pos = geom.attributes.position.array;
          for (let i = 0; i < mistCount; i++) {
            pos[i * 3 + 1] += Math.sin(elapsed * 4 + i) * 0.01;
          }
          geom.attributes.position.needsUpdate = true;
        }
      }

      // Brise de vent sur cultures
      if (animatedCropsRef.current.length > 0) {
        for (let i = 0; i < animatedCropsRef.current.length; i++) {
          const c = animatedCropsRef.current[i];
          const wind = Math.sin(elapsed * c.speed + c.phase) * 0.022;
          c.mesh.rotation.z = c.baseRotZ + wind;
          c.mesh.rotation.x = c.baseRotX + Math.cos(elapsed * (c.speed * 0.8) + c.phase) * 0.012;
        }
      }

      // Ondulation surface réservoir
      if (tankDiskRef.current) {
        const levelPct = tankData.water_level || 75;
        tankDiskRef.current.position.y = 0.35 + (2.4 * Math.max(0.05, levelPct / 100)) + Math.sin(elapsed * 2.5) * 0.015;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, []);

  // Garder une référence synchronisée à selectedElement pour la boucle animate()
  const selectedElementRef = useRef(selectedElement);
  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  // Synchronisation télémétrie en temps réel
  useEffect(() => {
    [1, 2, 3].forEach((zId) => {
      const z = zonesData[zId];
      if (!z) return;

      const valveGroup = valveMeshesRef.current.get(zId);
      if (valveGroup) {
        const led = valveGroup.getObjectByName('valve-led');
        if (led && led.material) {
          const isOn = z.valve === 'ON';
          led.material.color.setHex(isOn ? 0x00ff88 : 0xff3b3b);
          led.material.emissive.setHex(isOn ? 0x00ff88 : 0xaa1111);
        }
      }

      const border = zoneBorderRingsRef.current.get(zId);
      if (border && border.material) {
        let hex = 0x00ff88;
        if (z.valve === 'ON' || z.watering_active) hex = 0x00e5ff;
        else if (z.soil_humidity < 30) hex = 0xffaa00;
        else if (z.soil_humidity < 20) hex = 0xff3b3b;
        border.material.color.setHex(hex);
      }
    });

    if (tankWaterRef.current) {
      const levelPct = tankData.water_level || 75;
      const height = 2.4 * Math.max(0.05, Math.min(1.0, levelPct / 100));
      tankWaterRef.current.scale.set(1, Math.max(0.05, levelPct / 100), 1);
      tankWaterRef.current.position.y = 0.35 + height / 2;
    }
  }, [zonesData, tankData]);

  // Rendu de l'annotation 3D purement transparente (SANS FOND, SANS CARTE)
  const renderFloating3DAnnotation = () => {
    if (!selectedElement || !projectedAnchor || !projectedAnchor.visible) return null;

    const anchorX = projectedAnchor.x;
    const anchorY = projectedAnchor.y;
    const type = selectedElement.type;
    const id = selectedElement.id;

    // Hauteur de la ligne de connexion
    const lineLength = 36;
    const annotationBottomY = anchorY - lineLength;

    const textShadowStyle = {
      textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.85)',
    };

    return (
      <div className="absolute inset-0 pointer-events-none z-30">
        {/* Ligne fine de connexion SVG reliant l'annotation au point d'ancrage 3D */}
        <svg className="w-full h-full absolute inset-0 pointer-events-none overflow-visible">
          {/* Ligne verticale de liaison */}
          <line
            x1={anchorX}
            y1={annotationBottomY}
            x2={anchorX}
            y2={anchorY}
            stroke="rgba(0, 255, 136, 0.65)"
            strokeWidth="1.2"
          />

          {/* Nœud d'ancrage sur l'objet 3D */}
          <circle
            cx={anchorX}
            cy={anchorY}
            r="2.5"
            fill="#00ff88"
          />
          <circle
            cx={anchorX}
            cy={anchorY}
            r="5.5"
            fill="none"
            stroke="rgba(0, 255, 136, 0.4)"
            strokeWidth="1"
            className="animate-ping"
          />
        </svg>

        {/* Texte annotatif transparent en superposition directe sur la scène 3D */}
        <div
          style={{
            left: `${anchorX}px`,
            top: `${annotationBottomY - 4}px`,
            transform: 'translate(-50%, -100%)',
            ...textShadowStyle,
          }}
          className="absolute pointer-events-auto select-none text-center whitespace-nowrap animate-in fade-in duration-150"
        >
          {/* ── ZONE (Zone 1, 2, 3) ── */}
          {type === 'zone' && (() => {
            const zId = Number(id);
            const z = zonesData[zId] || { plant: 'Plante', soil_humidity: 45, valve: 'OFF' };
            const isOpen = z.valve === 'ON';
            return (
              <div className="flex flex-col items-center">
                <div className="text-xs font-semibold text-white tracking-wide">
                  Zone {zId}
                </div>
                <div className="text-[11px] font-medium text-slate-300">
                  {z.plant || `Culture ${zId}`}
                </div>
                <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                  Humidité du sol <span className="text-emerald-400 font-bold ml-1">{Number(z.soil_humidity).toFixed(0)} %</span>
                </div>
                <div className="text-[10px] font-mono text-slate-300">
                  Vanne <span className={`font-bold ml-1 ${isOpen ? 'text-emerald-400' : 'text-rose-400'}`}>{isOpen ? 'OUVERTE' : 'FERMÉE'}</span>
                </div>
              </div>
            );
          })()}

          {/* ── POMPE ── */}
          {type === 'pump' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-semibold text-white tracking-wide">
                Pompe Principale
              </div>
              <div className="text-[11px] font-medium text-slate-300">
                750W · Débit : {pumpData.pump === 'ON' ? '30 L/min' : '0 L/min'}
              </div>
              <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                État <span className={`font-bold ml-1 ${pumpData.pump === 'ON' ? 'text-emerald-400' : 'text-slate-400'}`}>{pumpData.pump === 'ON' ? 'ACTIVE' : 'EN VEILLE'}</span>
              </div>
            </div>
          )}

          {/* ── RÉSERVOIR ── */}
          {type === 'tank' && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-semibold text-white tracking-wide">
                Réservoir d'eau
              </div>
              <div className="text-[11px] font-mono text-cyan-400 font-bold">
                Niveau : {Number(tankData.water_level).toFixed(0)} %
              </div>
              <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                Volume : {tankData.volume_liters} L / {tankData.capacity_liters} L
              </div>
            </div>
          )}

          {/* ── VANNE ── */}
          {type === 'valve' && (() => {
            const vId = Number(id);
            const z = zonesData[vId] || { plant: 'Zone', valve: 'OFF' };
            const isOpen = z.valve === 'ON';
            return (
              <div className="flex flex-col items-center">
                <div className="text-xs font-semibold text-white tracking-wide">
                  Vanne Zone {vId}
                </div>
                <div className="text-[11px] font-medium text-slate-300">
                  {z.plant || `Zone ${vId}`}
                </div>
                <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                  État <span className={`font-bold ml-1 ${isOpen ? 'text-emerald-400' : 'text-rose-400'}`}>{isOpen ? 'OUVERTE' : 'FERMÉE'}</span>
                </div>
              </div>
            );
          })()}

          {/* ── SONDE IOT ── */}
          {type === 'sensor' && (() => {
            const sId = Number(id);
            const z = zonesData[sId] || { plant: 'Zone', soil_humidity: 45 };
            return (
              <div className="flex flex-col items-center">
                <div className="text-xs font-semibold text-white tracking-wide">
                  Sonde IoT Zone {sId}
                </div>
                <div className="text-[11px] font-medium text-slate-300">
                  {z.plant || `Zone ${sId}`}
                </div>
                <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                  Humidité du sol <span className="text-emerald-400 font-bold ml-1">{Number(z.soil_humidity).toFixed(0)} %</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Protocole : ESP32 MQTTS
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-hydra-darkest rounded-2xl border border-hydra-border/60">
      {/* Conteneur WebGL Three.js */}
      <div
        id="farm-3d-canvas-container"
        ref={containerRef}
        className={`w-full h-full ${hoveredObject ? 'cursor-pointer' : 'cursor-grab'}`}
      />

      {/* Barre de contrôles Caméra supérieure */}
      <div className="absolute top-4 left-6 flex items-center gap-2 z-10">
        <button
          id="btn-cam-free"
          onClick={() => {
            setCameraPreset('free');
            applyCameraPreset('free');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all shadow-lg cursor-pointer ${
            cameraPreset === 'free'
              ? 'bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/50 shadow-[0_0_12px_rgba(0,255,136,0.25)]'
              : 'bg-hydra-dark/80 text-hydra-textMuted border border-hydra-border hover:bg-hydra-card hover:text-hydra-textMain'
          }`}
        >
          <span>🌱</span>
          <span>Vue libre</span>
        </button>

        <button
          id="btn-cam-top"
          onClick={() => {
            setCameraPreset('top');
            applyCameraPreset('top');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all shadow-lg cursor-pointer ${
            cameraPreset === 'top'
              ? 'bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/50 shadow-[0_0_12px_rgba(0,255,136,0.25)]'
              : 'bg-hydra-dark/80 text-hydra-textMuted border border-hydra-border hover:bg-hydra-card hover:text-hydra-textMain'
          }`}
        >
          <span>🧭</span>
          <span>Vue aérienne</span>
        </button>

        <button
          id="btn-cam-water-path"
          onClick={() => {
            setCameraPreset('water_path');
            applyCameraPreset('water_path');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all shadow-lg cursor-pointer ${
            cameraPreset === 'water_path'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-hydra-dark/80 text-hydra-textMuted border border-hydra-border hover:bg-hydra-card hover:text-hydra-textMain'
          }`}
        >
          <span>🚰</span>
          <span>Circuit d'eau</span>
        </button>
      </div>

      {/* Widget Zoom & Réinitialisation */}
      <div className="absolute top-4 right-6 flex flex-col items-center gap-2 z-10">
        <div className="w-8 h-8 rounded-xl bg-hydra-dark/80 border border-hydra-border backdrop-blur-md flex items-center justify-center text-xs font-bold text-hydra-textMuted shadow-lg">
          <span className="text-hydra-neon font-mono text-[10px]">3D</span>
        </div>

        <div className="flex flex-col bg-hydra-dark/80 border border-hydra-border rounded-xl backdrop-blur-md p-1 gap-1 shadow-lg">
          <button
            id="btn-zoom-in"
            onClick={() => {
              const s = controlsState.current;
              s.spherical.radius = Math.max(8, s.spherical.radius * 0.85);
              s.desiredPosition.setFromSpherical(s.spherical).add(s.desiredTarget);
            }}
            className="w-7 h-7 flex items-center justify-center text-hydra-textMuted hover:text-hydra-textMain hover:bg-hydra-border/60 rounded-lg transition-colors text-sm font-bold cursor-pointer"
            title="Zoomer"
          >
            +
          </button>
          <button
            id="btn-zoom-out"
            onClick={() => {
              const s = controlsState.current;
              s.spherical.radius = Math.min(50, s.spherical.radius * 1.15);
              s.desiredPosition.setFromSpherical(s.spherical).add(s.desiredTarget);
            }}
            className="w-7 h-7 flex items-center justify-center text-hydra-textMuted hover:text-hydra-textMain hover:bg-hydra-border/60 rounded-lg transition-colors text-sm font-bold cursor-pointer"
            title="Dézoomer"
          >
            −
          </button>
          <button
            id="btn-reset-view"
            onClick={() => {
              setCameraPreset('free');
              applyCameraPreset('free');
              setSelectedElement(null);
              setSelectedZoneId(null);
            }}
            className="w-7 h-7 flex items-center justify-center text-hydra-textMuted hover:text-hydra-neon hover:bg-hydra-border/60 rounded-lg transition-colors text-xs cursor-pointer"
            title="Réinitialiser la vue et la sélection"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Annotation 3D purement transparente reliée par ligne directe */}
      {renderFloating3DAnnotation()}
    </div>
  );
}
