import React, { useEffect, useRef, useState, useCallback } from 'react';
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

  ctx.clearRect(0, 0, 256, 256);

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

  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = grad;
  ctx.fill();

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

  return new THREE.CanvasTexture(canvas);
}

const PRESET_ANGLES = {
  iso: { x: 4.2, y: 3.4, z: 5.0 },
  front: { x: 0.0, y: 0.8, z: 6.8 },
  top: { x: 0.01, y: 6.8, z: 0.01 },
  right: { x: 6.8, y: 0.8, z: 0.0 },
  back: { x: 0.0, y: 0.8, z: -6.8 },
  left: { x: -6.8, y: 0.8, z: 0.0 },
  bottom: { x: 0.01, y: -6.8, z: 0.01 },
};

export default function Cube3DWebGL({
  facelets,
  activeMove = '',
  onApplyMove = null,
}) {
  const containerRef = useRef(null);
  const stickerMeshesRef = useRef([]);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const targetCamPosRef = useRef(null);

  const [activePreset, setActivePreset] = useState('iso');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 380;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(4.2, 3.4, 5.0);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.85;
    controls.minDistance = 4.2;
    controls.maxDistance = 9.0;
    controls.enablePan = false;
    controlsRef.current = controls;

    // 4. Lighting
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
    const shadowTexture = createShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
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

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          if (x === 0 && y === 0 && z === 0) continue;

          const cubie = new THREE.Mesh(cubieGeo, blackPlasticMat);
          cubie.position.set(x, y, z);
          cubeGroup.add(cubie);

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
              cubeGroup.add(sticker);
              stickerMeshes[idx] = sticker;
            }
          }
        }
      }
    }

    stickerMeshesRef.current = stickerMeshes;

    // Initial color setup
    for (let i = 0; i < 54; i += 1) {
      if (stickerMeshes[i]) {
        const cCode = facelets[i] || 'W';
        const hex = COLORS[cCode]?.hex || '#FFFFFF';
        stickerMeshes[i].material.color.set(hex);
      }
    }

    // Render loop with smooth camera transition when targetCamPos is set
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (targetCamPosRef.current && camera) {
        camera.position.lerp(targetCamPosRef.current, 0.12);
        camera.lookAt(0, 0, 0);
        if (camera.position.distanceTo(targetCamPosRef.current) < 0.03) {
          camera.position.copy(targetCamPosRef.current);
          targetCamPosRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 380;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

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
      shadowTexture.dispose();
    };
  }, []);

  // Update sticker colors whenever facelets changes
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

  // Smooth camera glide to spherical orientation
  const glideCameraTo = useCallback((pos, presetKey = '') => {
    targetCamPosRef.current = new THREE.Vector3(pos.x, pos.y, pos.z);
    if (presetKey) setActivePreset(presetKey);
  }, []);

  // 90° Incremental Horizontal Orbit
  const handleRotateLeft = useCallback(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const radius = Math.sqrt(cam.position.x ** 2 + cam.position.z ** 2);
    const currAngle = Math.atan2(cam.position.z, cam.position.x);
    const nextAngle = currAngle - Math.PI / 2;
    glideCameraTo({
      x: radius * Math.cos(nextAngle),
      y: cam.position.y,
      z: radius * Math.sin(nextAngle),
    });
  }, [glideCameraTo]);

  const handleRotateRight = useCallback(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const radius = Math.sqrt(cam.position.x ** 2 + cam.position.z ** 2);
    const currAngle = Math.atan2(cam.position.z, cam.position.x);
    const nextAngle = currAngle + Math.PI / 2;
    glideCameraTo({
      x: radius * Math.cos(nextAngle),
      y: cam.position.y,
      z: radius * Math.sin(nextAngle),
    });
  }, [glideCameraTo]);

  // Tilt Up & Down
  const handleTiltUp = useCallback(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    glideCameraTo({
      x: cam.position.x * 0.9,
      y: Math.min(6.5, cam.position.y + 2.2),
      z: cam.position.z * 0.9,
    });
  }, [glideCameraTo]);

  const handleTiltDown = useCallback(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    glideCameraTo({
      x: cam.position.x * 0.9,
      y: Math.max(-5.5, cam.position.y - 2.2),
      z: cam.position.z * 0.9,
    });
  }, [glideCameraTo]);

  const isPrime = activeMove?.endsWith("'");
  const isDouble = activeMove?.endsWith('2');

  const FACES_LIST = [
    { code: 'U', name: 'Up', color: '#FFFFFF', desc: 'White' },
    { code: 'L', name: 'Left', color: '#FF5A00', desc: 'Orange' },
    { code: 'F', name: 'Front', color: '#00A859', desc: 'Green' },
    { code: 'R', name: 'Right', color: '#DC2626', desc: 'Red' },
    { code: 'B', name: 'Back', color: '#0055FF', desc: 'Blue' },
    { code: 'D', name: 'Down', color: '#FFD500', desc: 'Yellow' },
  ];

  return (
    <div className="three-stage-card">
      <div className="three-viewport-wrap">
        <div ref={containerRef} className="three-canvas-container" />

        {/* Floating Active Move HUD */}
        {activeMove && (
          <div className="three-move-hud" role="status">
            <span className="hud-move-badge mono">{activeMove}</span>
            <span className="hud-move-sub">
              {isDouble ? '180° Half Turn' : isPrime ? '90° Counter-Clockwise' : '90° Clockwise'}
            </span>
          </div>
        )}

        {/* 3D Orientation Pad (Orbit in 90° increments) */}
        <div className="orbit-controls-dpad" aria-label="Rotate View">
          <button
            type="button"
            className="dpad-btn"
            onClick={handleTiltUp}
            title="Tilt view up"
          >
            ▲
          </button>
          <div className="dpad-mid-row">
            <button
              type="button"
              className="dpad-btn"
              onClick={handleRotateLeft}
              title="Rotate view left 90°"
            >
              ◀
            </button>
            <button
              type="button"
              className="dpad-btn center-btn"
              onClick={() => glideCameraTo(PRESET_ANGLES.iso, 'iso')}
              title="Reset to 3D isometric view"
            >
              ●
            </button>
            <button
              type="button"
              className="dpad-btn"
              onClick={handleRotateRight}
              title="Rotate view right 90°"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            className="dpad-btn"
            onClick={handleTiltDown}
            title="Tilt view down"
          >
            ▼
          </button>
        </div>

        {/* Camera Preset Pills */}
        <div className="view-presets-strip">
          {[
            { key: 'iso', label: 'Iso' },
            { key: 'front', label: 'Front' },
            { key: 'top', label: 'Top' },
            { key: 'right', label: 'Right' },
            { key: 'back', label: 'Back' },
            { key: 'left', label: 'Left' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`preset-pill ${activePreset === key ? 'active' : ''}`}
              onClick={() => glideCameraTo(PRESET_ANGLES[key], key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="three-gesture-hint">
          <span>Click &amp; drag to orbit &bull; Scroll to zoom</span>
        </div>
      </div>

      {/* Interactive Face Rotation Bar (Turn any layer) */}
      {onApplyMove && (
        <div className="face-rotation-deck">
          <span className="deck-title">ROTATE LAYERS</span>
          <div className="face-button-grid">
            {FACES_LIST.map(({ code, name, color }) => (
              <div key={code} className="face-control-cluster">
                <button
                  type="button"
                  className="face-turn-btn primary-cw"
                  onClick={() => onApplyMove(code)}
                  title={`Rotate ${name} face 90° Clockwise [${code}]`}
                >
                  <span className="face-swatch-dot" style={{ backgroundColor: color }} />
                  <span className="face-btn-label mono">{code}</span>
                  <span className="face-turn-arrow">↻</span>
                </button>
                <button
                  type="button"
                  className="face-turn-btn sub-ccw"
                  onClick={() => onApplyMove(`${code}'`)}
                  title={`Rotate ${name} face 90° Counter-Clockwise [Shift+${code}]`}
                >
                  <span className="mono">{code}&apos;</span>
                  <span className="face-turn-arrow">↺</span>
                </button>
                <button
                  type="button"
                  className="face-turn-btn sub-double"
                  onClick={() => onApplyMove(`${code}2`)}
                  title={`Rotate ${name} face 180°`}
                >
                  <span className="mono">{code}2</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
