"use client";

import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { BadgeTier } from "@/lib/badges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "appear" | "anticipate" | "crack" | "reveal" | "collect";

interface CapsuleSphere3DProps {
  tier: BadgeTier;
  phase: Phase;
  onTap: () => void;
}

// ---------------------------------------------------------------------------
// Tier colour mapping (BadgeTier -> preview tier names)
// ---------------------------------------------------------------------------

const TIER_MAP: Record<
  BadgeTier,
  { shell: number; glow: number; accent: number; seam: number; iridescence: number }
> = {
  blue:   { shell: 0x2a2a30, glow: 0x555560, accent: 0x70707a, seam: 0x444450, iridescence: 0.1 },
  silver: { shell: 0x1a1a22, glow: 0xC0D0E0, accent: 0xD8E8F8, seam: 0x8899aa, iridescence: 0.25 },
  gold:   { shell: 0x1a1508, glow: 0xFFD700, accent: 0xFFE878, seam: 0xCCA800, iridescence: 0.35 },
  cosmic: { shell: 0x12081e, glow: 0xB366FF, accent: 0xDD88FF, seam: 0x8833CC, iridescence: 0.6 },
};

// ---------------------------------------------------------------------------
// Easing helpers (matching preview)
// ---------------------------------------------------------------------------

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeInCubic(x: number): number {
  return x * x * x;
}

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------

function makeEnvMap(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const x = c.getContext("2d")!;

  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "#3a1060");
  g.addColorStop(0.2, "#1a042d");
  g.addColorStop(0.45, "#0d0018");
  g.addColorStop(0.55, "#0d0018");
  g.addColorStop(0.8, "#1a042d");
  g.addColorStop(1, "#3a1060");
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);

  const h1 = x.createRadialGradient(S * 0.22, S * 0.18, 0, S * 0.22, S * 0.18, S * 0.25);
  h1.addColorStop(0, "rgba(255,255,255,0.7)");
  h1.addColorStop(0.3, "rgba(255,255,255,0.3)");
  h1.addColorStop(0.7, "rgba(255,255,255,0.08)");
  h1.addColorStop(1, "transparent");
  x.fillStyle = h1;
  x.fillRect(0, 0, S, S);

  const h2 = x.createRadialGradient(S * 0.82, S * 0.5, 0, S * 0.82, S * 0.5, S * 0.15);
  h2.addColorStop(0, "rgba(255,255,255,0.25)");
  h2.addColorStop(1, "transparent");
  x.fillStyle = h2;
  x.fillRect(0, 0, S, S);

  const h3 = x.createRadialGradient(S * 0.4, S * 0.88, 0, S * 0.4, S * 0.88, S * 0.18);
  h3.addColorStop(0, "rgba(200,180,255,0.2)");
  h3.addColorStop(1, "transparent");
  x.fillStyle = h3;
  x.fillRect(0, 0, S, S);

  const h4 = x.createLinearGradient(0, S * 0.35, S, S * 0.65);
  h4.addColorStop(0, "rgba(255,100,180,0.08)");
  h4.addColorStop(0.3, "rgba(100,200,255,0.06)");
  h4.addColorStop(0.6, "rgba(255,224,72,0.08)");
  h4.addColorStop(1, "rgba(179,102,255,0.06)");
  x.fillStyle = h4;
  x.fillRect(0, 0, S, S);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

function makeSparkleTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(255,255,255,0.8)");
  g.addColorStop(0.4, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function makeGlowTexture(color: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const col = new THREE.Color(color);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.5)`);
  g.addColorStop(0.4, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.15)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// Sparkle user data
// ---------------------------------------------------------------------------

interface SparkleData {
  baseScale: number;
  phase: number;
  speed: number;
  pulseAmp: number;
  baseY: number;
  driftSpeed: number;
  driftAmp: number;
}

// ---------------------------------------------------------------------------
// Particle data
// ---------------------------------------------------------------------------

interface ParticleData {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  tx: number;
  ty: number;
  tz: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CapsuleSphere3D({ tier, phase, onTap }: CapsuleSphere3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    group: THREE.Group;
    topMesh: THREE.Mesh;
    topMat: THREE.MeshPhysicalMaterial;
    botMesh: THREE.Mesh;
    botMat: THREE.MeshPhysicalMaterial;
    seamMesh: THREE.Mesh;
    seamMat: THREE.MeshStandardMaterial;
    badge: THREE.Mesh;
    sparkles: THREE.Sprite[];
    coreLight: THREE.PointLight;
    particles: ParticleData[];
    shockwave: THREE.Mesh;
    swMat: THREE.MeshBasicMaterial;
    shockwave2: THREE.Mesh;
    sw2Mat: THREE.MeshBasicMaterial;
    envMap: THREE.CanvasTexture;
    sparkleTexture: THREE.CanvasTexture;
    glowTexture: THREE.CanvasTexture;
    badgeTexture: THREE.Texture;
    glowSprite: THREE.Sprite;
    disposables: THREE.BufferGeometry[];
    materialDisposables: THREE.Material[];
    textureDisposables: THREE.Texture[];
  } | null>(null);

  const phaseRef = useRef<Phase>(phase);
  const phaseTimeRef = useRef(0);
  const tRef = useRef(Math.random() * 100);
  const rafRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock | null>(null);
  const mountedRef = useRef(true);
  // Track whether crack-phase shockwave2 delay has fired
  const sw2DelayFiredRef = useRef(false);

  // Keep phase ref in sync
  useEffect(() => {
    const prev = phaseRef.current;
    phaseRef.current = phase;

    // Reset phase timer on phase change
    if (prev !== phase) {
      phaseTimeRef.current = 0;
      sw2DelayFiredRef.current = false;

      const s = sceneRef.current;
      if (!s) return;

      // Transition into anticipate: reset group transforms
      if (phase === "anticipate") {
        s.group.rotation.set(0, 0, 0);
        s.group.scale.setScalar(1);
        s.group.position.set(0, 0, 0);
        s.coreLight.intensity = 0;
        s.seamMat.emissiveIntensity = 0.3;
      }

      // Transition into crack
      if (phase === "crack") {
        s.topMat.transparent = true;
        s.topMat.needsUpdate = true;
        s.botMat.transparent = true;
        s.botMat.needsUpdate = true;
        s.shockwave.visible = true;
        s.swMat.opacity = 0;
        s.shockwave.scale.setScalar(1);
        s.shockwave2.visible = false; // will show after 80ms delay
        s.sw2Mat.opacity = 0;
        s.shockwave2.scale.setScalar(1);
        s.particles.forEach((p) => {
          p.mesh.visible = true;
          p.mat.opacity = 0;
          p.mesh.position.set(0, 0, 0);
        });
        s.badge.visible = false;
        s.seamMesh.visible = false;
      }

      // Transition into reveal / collect: hide the canvas entirely
      if (phase === "reveal" || phase === "collect") {
        // Hide everything so the canvas is transparent
        s.topMesh.visible = false;
        s.botMesh.visible = false;
        s.seamMesh.visible = false;
        s.badge.visible = false;
        s.shockwave.visible = false;
        s.shockwave2.visible = false;
        s.particles.forEach((p) => {
          p.mesh.visible = false;
        });
        s.sparkles.forEach((sp) => {
          sp.visible = false;
        });
        s.glowSprite.visible = false;
        s.coreLight.intensity = 0;
      }

      // Transition into idle or appear: reset everything visible
      if (phase === "idle" || phase === "appear") {
        s.topMesh.visible = true;
        s.topMesh.position.set(0, 0, 0);
        s.topMesh.rotation.set(0, 0, 0);
        s.topMesh.scale.setScalar(1);
        s.topMat.opacity = 1;
        s.topMat.transparent = false;
        s.topMat.needsUpdate = true;

        s.botMesh.visible = true;
        s.botMesh.position.set(0, 0, 0);
        s.botMesh.rotation.set(0, 0, 0);
        s.botMesh.scale.setScalar(1);
        s.botMat.opacity = 1;
        s.botMat.transparent = false;
        s.botMat.needsUpdate = true;

        s.seamMesh.visible = true;
        s.seamMat.emissiveIntensity = 0.3;

        s.badge.visible = true;

        s.shockwave.visible = false;
        s.shockwave2.visible = false;
        s.particles.forEach((p) => {
          p.mesh.visible = false;
          p.mat.opacity = 0;
          p.mesh.position.set(0, 0, 0);
        });

        s.sparkles.forEach((sp) => {
          sp.visible = true;
        });
        s.glowSprite.visible = true;

        s.group.rotation.set(0, 0, 0);
        s.group.scale.setScalar(1);
        s.group.position.set(0, 0, 0);
        s.coreLight.intensity = 0;
      }
    }
  }, [phase]);

  // Stable tap handler
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const handleClick = useCallback(() => {
    onTapRef.current();
  }, []);

  // ---------------------------------------------------------------------------
  // Scene setup (runs once on mount)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    mountedRef.current = true;

    const W = 700;
    const H = 700;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2× to keep GPU budget sane

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;

    // Scene + Camera — FOV 60 gives ±2.4 units visible so particles fade before the edge
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0.15, 5.0);
    camera.lookAt(0, 0, 0);

    // Tier colours
    const tc = TIER_MAP[tier];
    const shellColor = new THREE.Color(tc.shell);
    const glowColor = new THREE.Color(tc.glow);
    const accentColor = new THREE.Color(tc.accent);

    // Environment map
    const envMap = makeEnvMap();

    // Textures
    const sparkleTexture = makeSparkleTexture();
    const glowTexture = makeGlowTexture(tc.glow);

    // Badge texture
    const textureLoader = new THREE.TextureLoader();
    const badgeTexture = textureLoader.load("/badges/any_gvc_1759173799963.webp");
    badgeTexture.colorSpace = THREE.SRGBColorSpace;

    // Track disposables
    const disposables: THREE.BufferGeometry[] = [];
    const materialDisposables: THREE.Material[] = [];
    const textureDisposables: THREE.Texture[] = [envMap, sparkleTexture, glowTexture, badgeTexture];

    // ---------------------------------------------------------------------------
    // Lighting
    // ---------------------------------------------------------------------------

    const keyLight = new THREE.DirectionalLight(0xffffff, 4.5);
    keyLight.position.set(-2, 3, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xaaaaff, 1.0);
    fillLight.position.set(2, -1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(glowColor, 2.5);
    rimLight.position.set(0, 0, -3);
    scene.add(rimLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 4, 1);
    scene.add(topLight);

    scene.add(new THREE.AmbientLight(0x2a1050, 0.6));

    const pointLight = new THREE.PointLight(glowColor, 3, 6);
    pointLight.position.set(0, 0.5, 2);
    scene.add(pointLight);

    // ---------------------------------------------------------------------------
    // Group (holds capsule halves + seam + badge overlay)
    // ---------------------------------------------------------------------------

    const group = new THREE.Group();
    scene.add(group);

    // Top half
    const topGeo = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    disposables.push(topGeo);
    const topMat = new THREE.MeshPhysicalMaterial({
      color: shellColor,
      metalness: 1.0,
      roughness: 0.01,
      envMap,
      envMapIntensity: 4.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.005,
      iridescence: tc.iridescence,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [200, 600],
      reflectivity: 1.0,
    });
    materialDisposables.push(topMat);
    const topMesh = new THREE.Mesh(topGeo, topMat);
    group.add(topMesh);

    // Bottom half
    const botGeo = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    disposables.push(botGeo);
    const botMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(tc.shell).multiplyScalar(0.65),
      metalness: 1.0,
      roughness: 0.015,
      envMap,
      envMapIntensity: 3.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.008,
      iridescence: tc.iridescence * 0.8,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [250, 700],
      reflectivity: 1.0,
    });
    materialDisposables.push(botMat);
    const botMesh = new THREE.Mesh(botGeo, botMat);
    group.add(botMesh);

    // Seam
    const seamGeo = new THREE.TorusGeometry(1.012, 0.025, 12, 64);
    disposables.push(seamGeo);
    const seamMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tc.seam).multiplyScalar(0.3),
      metalness: 1.0,
      roughness: 0.1,
      emissive: accentColor,
      emissiveIntensity: 0.3,
    });
    materialDisposables.push(seamMat);
    const seamMesh = new THREE.Mesh(seamGeo, seamMat);
    seamMesh.rotation.x = Math.PI / 2;
    seamMesh.renderOrder = 0;
    group.add(seamMesh);

    // Badge overlay on front
    const bGeo = new THREE.PlaneGeometry(0.72, 0.72);
    disposables.push(bGeo);
    const bMat = new THREE.MeshBasicMaterial({
      map: badgeTexture,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materialDisposables.push(bMat);
    const badgeMesh = new THREE.Mesh(bGeo, bMat);
    badgeMesh.position.z = 1.05;
    badgeMesh.renderOrder = 2;
    group.add(badgeMesh);

    // ---------------------------------------------------------------------------
    // Sparkles (20 sprites behind capsule)
    // ---------------------------------------------------------------------------

    const sparkles: THREE.Sprite[] = [];
    const sparkleCount = 20;
    for (let i = 0; i < sparkleCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: sparkleTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        color: i % 3 === 0 ? glowColor : i % 3 === 1 ? accentColor : new THREE.Color(0xffffff),
      });
      materialDisposables.push(mat);
      const sprite = new THREE.Sprite(mat);
      const angle = (i / sparkleCount) * Math.PI * 2;
      const radius = 1.4 + Math.random() * 1.2;
      const yOff = (Math.random() - 0.5) * 2.0;
      sprite.position.set(
        Math.cos(angle) * radius,
        yOff,
        -0.5 + Math.sin(angle) * radius * 0.3,
      );
      const baseScale = 0.06 + Math.random() * 0.12;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.userData = {
        baseScale,
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.5,
        pulseAmp: 0.3 + Math.random() * 0.7,
        baseY: yOff,
        driftSpeed: 0.3 + Math.random() * 0.5,
        driftAmp: 0.05 + Math.random() * 0.08,
      } as SparkleData;
      scene.add(sprite);
      sparkles.push(sprite);
    }

    // ---------------------------------------------------------------------------
    // Glow sprite
    // ---------------------------------------------------------------------------

    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    materialDisposables.push(glowMat);
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(5, 5, 1);
    glowSprite.position.z = -0.5;
    scene.add(glowSprite);

    // ---------------------------------------------------------------------------
    // Core light (used during anticipate/crack)
    // ---------------------------------------------------------------------------

    const coreLight = new THREE.PointLight(glowColor, 0, 8);
    scene.add(coreLight);

    // ---------------------------------------------------------------------------
    // Burst particles
    // ---------------------------------------------------------------------------

    const particles: ParticleData[] = [];
    for (let i = 0; i < 40; i++) {
      const sz = 0.02 + Math.random() * 0.05;
      const pg = new THREE.SphereGeometry(sz, 6, 6);
      disposables.push(pg);
      const pc = i % 3 === 0 ? shellColor : i % 3 === 1 ? glowColor : accentColor;
      const pm = new THREE.MeshBasicMaterial({ color: pc, transparent: true, opacity: 0 });
      materialDisposables.push(pm);
      const pmesh = new THREE.Mesh(pg, pm);
      pmesh.visible = false;
      scene.add(pmesh);
      const a = (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const elev = (Math.random() - 0.5) * Math.PI * 0.8;
      const d = 1.2 + Math.random() * 1.6;
      particles.push({
        mesh: pmesh,
        mat: pm,
        tx: Math.cos(a) * Math.cos(elev) * d,
        ty: Math.sin(elev) * d * 0.7,
        tz: Math.sin(a) * Math.cos(elev) * d,
      });
    }

    // ---------------------------------------------------------------------------
    // Shockwave rings
    // ---------------------------------------------------------------------------

    const swGeo = new THREE.RingGeometry(0.1, 0.2, 64);
    disposables.push(swGeo);
    const swMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    materialDisposables.push(swMat);
    const shockwave = new THREE.Mesh(swGeo, swMat);
    shockwave.visible = false;
    scene.add(shockwave);

    const sw2Geo = new THREE.RingGeometry(0.05, 0.12, 64);
    disposables.push(sw2Geo);
    const sw2Mat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    materialDisposables.push(sw2Mat);
    const shockwave2 = new THREE.Mesh(sw2Geo, sw2Mat);
    shockwave2.visible = false;
    scene.add(shockwave2);

    // ---------------------------------------------------------------------------
    // Store refs
    // ---------------------------------------------------------------------------

    sceneRef.current = {
      renderer,
      scene,
      camera,
      group,
      topMesh,
      topMat,
      botMesh,
      botMat,
      seamMesh,
      seamMat,
      badge: badgeMesh,
      sparkles,
      coreLight,
      particles,
      shockwave,
      swMat,
      shockwave2,
      sw2Mat,
      envMap,
      sparkleTexture,
      glowTexture,
      badgeTexture,
      glowSprite,
      disposables,
      materialDisposables,
      textureDisposables,
    };

    // ---------------------------------------------------------------------------
    // Animation constants
    // ---------------------------------------------------------------------------

    const WOBBLE_DUR = 2.2;
    const CRACK_DUR = 0.9;

    clockRef.current = new THREE.Clock();

    // ---------------------------------------------------------------------------
    // Render loop
    // ---------------------------------------------------------------------------

    function animate() {
      if (!mountedRef.current) return;
      rafRef.current = requestAnimationFrame(animate);

      const dt = clockRef.current!.getDelta();
      tRef.current += 0.012;
      phaseTimeRef.current += dt;

      const t = tRef.current;
      const currentPhase = phaseRef.current;
      const phaseTime = phaseTimeRef.current;

      // Sparkle animation (always runs when sparkles are visible)
      sparkles.forEach((s) => {
        if (!s.visible) return;
        const d = s.userData as SparkleData;
        const pulse = 1 + Math.sin(t * d.speed + d.phase) * d.pulseAmp;
        s.scale.setScalar(d.baseScale * Math.max(0.1, pulse));
        s.material.opacity = Math.max(0, 0.3 + Math.sin(t * d.speed + d.phase) * 0.5);
        s.position.y = d.baseY + Math.sin(t * d.driftSpeed + d.phase) * d.driftAmp;
      });

      // Phase-specific animation
      if (currentPhase === "idle" || currentPhase === "appear") {
        group.position.y = Math.sin(t) * 0.08;
        group.rotation.y = Math.sin(t * 0.5) * 0.12;
        group.rotation.z = Math.sin(t * 0.7) * 0.03;
      } else if (currentPhase === "anticipate") {
        const p = Math.min(phaseTime / WOBBLE_DUR, 1);
        const intensity = easeInCubic(p) * 16;
        const freq = 10 + p * 30;

        group.rotation.z = Math.sin(phaseTime * freq) * intensity * (Math.PI / 180);
        group.rotation.x = Math.cos(phaseTime * freq * 0.7) * intensity * 0.5 * (Math.PI / 180);
        group.rotation.y = 0;

        if (p > 0.7) {
          const jit = (p - 0.7) / 0.3;
          group.position.x = Math.sin(phaseTime * freq * 1.3) * jit * 0.04;
          group.position.z = Math.cos(phaseTime * freq * 0.9) * jit * 0.02;
        }

        group.scale.setScalar(1 + p * 0.18);
        seamMat.emissiveIntensity = 0.3;
        coreLight.intensity = p * 4;
      } else if (currentPhase === "crack") {
        const p = Math.min(phaseTime / CRACK_DUR, 1);
        const ep = easeOutExpo(p);

        // Shockwave2 delayed start
        if (phaseTime > 0.08 && !sw2DelayFiredRef.current) {
          sw2DelayFiredRef.current = true;
          shockwave2.visible = true;
        }

        // Top half flies up-right
        topMesh.position.y = ep * 2.5;
        topMesh.position.x = ep * 1.0;
        topMesh.position.z = ep * 0.6;
        topMesh.rotation.z = ep * 0.7;
        topMesh.rotation.x = -ep * 0.9;
        topMesh.rotation.y = ep * 0.4;
        topMat.opacity = Math.max(0, 1 - ep * 1.3);

        // Bottom half flies down-left
        botMesh.position.y = -ep * 2.3;
        botMesh.position.x = -ep * 0.8;
        botMesh.position.z = ep * 0.4;
        botMesh.rotation.z = -ep * 0.6;
        botMesh.rotation.x = ep * 0.7;
        botMesh.rotation.y = -ep * 0.3;
        botMat.opacity = Math.max(0, 1 - ep * 1.3);

        // Group settles
        group.scale.setScalar(1 + 0.18 * (1 - ep));
        group.rotation.z *= 0.9;
        group.rotation.x *= 0.9;
        group.position.x *= 0.9;
        group.position.z *= 0.9;

        // Shockwave expansion
        shockwave.scale.setScalar(1 + ep * 18);
        swMat.opacity = Math.max(0, (1 - ep) * 0.9);

        if (phaseTime > 0.08) {
          shockwave2.scale.setScalar(1 + Math.max(0, ep - 0.1) * 14);
          sw2Mat.opacity = Math.max(0, (1 - ep) * 0.6);
        }

        coreLight.intensity = 10 * (1 - ep);

        // Burst particles
        particles.forEach((part) => {
          part.mesh.position.x = part.tx * ep;
          part.mesh.position.y = part.ty * ep;
          part.mesh.position.z = part.tz * ep;
          part.mat.opacity = p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.4);
        });

        // When crack finishes, hide everything (reveal/collect handled by parent)
        if (p >= 1) {
          topMesh.visible = false;
          botMesh.visible = false;
          seamMesh.visible = false;
          shockwave.visible = false;
          shockwave2.visible = false;
          particles.forEach((part) => {
            part.mesh.visible = false;
          });
          sparkles.forEach((sp) => {
            sp.visible = false;
          });
          glowSprite.visible = false;
          coreLight.intensity = 0;
        }
      }
      // reveal / collect: canvas is transparent, nothing to animate

      renderer.render(scene, camera);
    }

    animate();

    // ---------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);

      disposables.forEach((g) => g.dispose());
      materialDisposables.forEach((m) => m.dispose());
      textureDisposables.forEach((t) => t.dispose());

      renderer.dispose();
      renderer.forceContextLoss();

      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  // Hide canvas entirely for reveal/collect phases
  const hidden = phase === "reveal" || phase === "collect";

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      width={700}
      height={700}
      style={{
        width: 700,
        height: 700,
        pointerEvents: "auto",
        cursor: "pointer",
        visibility: hidden ? "hidden" : "visible",
      }}
    />
  );
}
