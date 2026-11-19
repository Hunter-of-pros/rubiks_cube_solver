import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS } from '../utils/cube';

// Coordinate mapping to 54-sticker layout
function getStickerIndex(x, y, z, faceCode) {
  switch (faceCode) {
    case 'U': // y = 1
      return 0 + (z + 1) * 3 + (x + 1);
    case 'D': // y = -1
      return 27 + (1 - z) * 3 + (x + 1);
    case 'F': // z = 1
      return 18 + (1 - y) * 3 + (x + 1);
    case 'B': // z = -1
      return 45 + (1 - y) * 3 + (1 - x);
    case 'R': // x = 1
      return 9 + (1 - y) * 3 + (1 - z);
    case 'L': // x = -1
      return 36 + (1 - y) * 3 + (z + 1);
    default:
      return -1;
  }
}

// Generate rounded-rectangle canvas texture for stickers
function createStickerTexture(isCenter = false, label = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fill transparent
  ctx.clearRect(0, 0, 256, 256);

  // Rounded rectangle sticker body
  const r = 24;
  const pad = 8;
  const w = 256 - pad * 2;
  const h = 256 - pad * 2;

  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.lineTo(pad + w - r, pad);
  ctx.quadraticCurveTo(pad + w, pad, pad + w, pad + r);
  ctx.lineTo(pad + w, pad + h - r);
  ctx.quadraticCurveTo(pad + w, pad + h, pad + w - r, pad + h);
  ctx.lineTo(pad + r, pad + h);
  ctx.quadraticCurveTo(pad, pad + h, pad, pad + h - r);
  ctx.lineTo(pad, pad + r);
  ctx.quadraticCurveTo(pad, pad, pad + r, pad);
  ctx.closePath();

  // White base that will be tinted by material color
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Subtle inner border for tactile bevel
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.stroke();

  // Subtle gloss gradient
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Minimal speedcube center emblem
  if (isCenter && label === 'U') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(128, 128, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Contact shadow texture
function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
  grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export default function Cube3DWebGL({ facelets, activeMove = '' }) {
  const containerRef = useRef(null);
  const stickerMeshesRef = useRef([]);
  const controlsRef = useRef(null);
  const activeMoveRef = useRef(activeMove);
  activeMoveRef.current = activeMove;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(4.2, 3.4, 5.0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.85;
    controls.minDistance = 4.2;
    controls.maxDistance = 8.5;
    controls.enablePan = false;
    controlsRef.current = controls;

    // 4. Lighting (Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.45);
    fillLight.position.set(-6, -2, -5);
    scene.add(fillLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
    topLight.position.set(0, 7, 0);
    scene.add(topLight);

    // 5. Contact Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.05;
    scene.add(shadowMesh);

    // 6. Rubik's Cube Geometry & Materials
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const cubieGeo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const blackPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x101116,
      roughness: 0.45,
      metalness: 0.1,
    });

    const stickerPlaneGeo = new THREE.PlaneGeometry(0.84, 0.84);
    const stickerMeshes = new Array(54);

    const normalTexture = createStickerTexture(false);
    const centerUTexture = createStickerTexture(true, 'U');

    // Create 27 cubies
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          if (x === 0 && y === 0 && z === 0) continue; // skip core

          const cubie = new THREE.Mesh(cubieGeo, blackPlasticMat);
          cubie.position.set(x, y, z);
          cubeGroup.add(cubie);

          // Check exposed faces
          const exposed = [];
          if (y === 1) exposed.push({ face: 'U', norm: [0, 1, 0], rot: [-Math.PI / 2, 0, 0] });
          if (y === -1) exposed.push({ face: 'D', norm: [0, -1, 0], rot: [Math.PI / 2, 0, 0] });
          if (z === 1) exposed.push({ face: 'F', norm: [0, 0, 1], rot: [0, 0, 0] });
          if (z === -1) exposed.push({ face: 'B', norm: [0, 0, -1], rot: [0, Math.PI, 0] });
          if (x === 1) exposed.push({ face: 'R', norm: [1, 0, 0], rot: [0, Math.PI / 2, 0] });
          if (x === -1) exposed.push({ face: 'L', norm: [-1, 0, 0], rot: [0, -Math.PI / 2, 0] });

          for (const { face, norm, rot } of exposed) {
            const idx = getStickerIndex(x, y, z, face);
            if (idx >= 0 && idx < 54) {
              const isCenterU = face === 'U' && x === 0 && z === 0;
              const mat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: isCenterU ? centerUTexture : normalTexture,
                roughness: 0.16,
                metalness: 0.04,
              });

              const sticker = new THREE.Mesh(stickerPlaneGeo, mat);
              sticker.position.set(
                x + norm[0] * 0.472,
                y + norm[1] * 0.472,
                z + norm[2] * 0.472
              );
              sticker.rotation.set(rot[0], rot[1], rot[2]);
              sticker.userData = { faceCode: face, stickerIndex: idx };
              cubeGroup.add(sticker);
              stickerMeshes[idx] = sticker;
            }
          }
        }
      }
    }

    stickerMeshesRef.current = stickerMeshes;

    // 7. Initial color setup
    for (let i = 0; i < 54; i += 1) {
      if (stickerMeshes[i]) {
        const cCode = facelets[i] || 'W';
        const hex = COLORS[cCode]?.hex || '#FFFFFF';
        stickerMeshes[i].material.color.set(hex);
      }
    }

    // 8. Render loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Subtle breath rotation when idle
      if (!controls.state || controls.state === -1) {
        cubeGroup.rotation.y = Math.sin(Date.now() * 0.0006) * 0.04;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 10. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      cubieGeo.dispose();
      stickerPlaneGeo.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      blackPlasticMat.dispose();
      normalTexture.dispose();
      centerUTexture.dispose();
    };
  }, []);

  // Update sticker colors when facelets prop changes
  useEffect(() => {
    const meshes = stickerMeshesRef.current;
    if (!meshes || meshes.length < 54) return;

    for (let i = 0; i < 54; i += 1) {
      if (meshes[i]) {
        const cCode = facelets[i] || 'W';
        const hex = COLORS[cCode]?.hex || '#FFFFFF';
        meshes[i].material.color.set(hex);
      }
    }
  }, [facelets]);

  // View reset helper
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const isPrime = activeMove?.endsWith("'");
  const isDouble = activeMove?.endsWith('2');

  return (
    <div className="three-viewport-wrap">
      <div ref={containerRef} className="three-canvas-container" />

      {activeMove && (
        <div className="three-move-hud" role="status">
          <span className="hud-move-badge">{activeMove}</span>
          <span className="hud-move-sub">
            {isDouble ? '180° Turn' : isPrime ? '90° Counter-Clockwise' : '90° Clockwise'}
          </span>
        </div>
      )}

      <div className="three-hud-controls">
        <button
          type="button"
          className="three-hud-btn"
          onClick={handleResetCamera}
          title="Reset 3D camera angle"
        >
          Reset View
        </button>
      </div>

      <div className="three-gesture-hint">
        <span>Drag to orbit &bull; Pinch to zoom</span>
      </div>
    </div>
  );
}
