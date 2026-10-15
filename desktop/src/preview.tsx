import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PreviewBlock } from "./types";

const COLORS: Record<string, number> = {
  stone_bricks: 0x8e97a3,
  stone: 0x7d7d7d,
  oak_planks: 0xb58954,
  oak_log: 0x6b4f2a,
  quartz_block: 0xe7e4dc,
  deepslate_tiles: 0x3a4150,
  sandstone: 0xd7c392,
  bricks: 0x8d4634,
  glass: 0x9fd6ff,
  glass_pane: 0xb7e3ff,
  water: 0x2f6fbf,
  air: 0x000000,
};

export function VoxelPreview({ blocks, limited }: { blocks: PreviewBlock[]; limited?: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1730");
    const camera = new THREE.PerspectiveCamera(45, element.clientWidth / Math.max(element.clientHeight, 1), 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(element.clientWidth, element.clientHeight);
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xd7e6ff, 1.1);
    sun.position.set(30, 50, 20);
    scene.add(sun);

    const visible = blocks.filter((block) => block.block !== "air");
    const groups = new Map<string, PreviewBlock[]>();
    for (const block of visible) {
      const list = groups.get(block.block) || [];
      list.push(block);
      groups.set(block.block, list);
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    let maxX = 1;
    let maxY = 1;
    let maxZ = 1;
    for (const [name, list] of groups) {
      const material = new THREE.MeshStandardMaterial({
        color: COLORS[name] || 0x6d8cff,
        transparent: name.includes("glass") || name === "water",
        opacity: name === "water" ? 0.55 : name.includes("glass") ? 0.45 : 1,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      const dummy = new THREE.Object3D();
      list.forEach((block, index) => {
        dummy.position.set(block.x, block.y, block.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        maxX = Math.max(maxX, block.x);
        maxY = Math.max(maxY, block.y);
        maxZ = Math.max(maxZ, block.z);
      });
      scene.add(mesh);
    }
    camera.position.set(maxX * 1.4 + 12, maxY + 14, maxZ * 1.4 + 16);
    controls.target.set(maxX / 2, maxY / 3, maxZ / 2);
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
    const resize = () => {
      camera.aspect = element.clientWidth / Math.max(element.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(element.clientWidth, element.clientHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      controls.dispose();
      geometry.dispose();
      renderer.dispose();
      element.replaceChildren();
    };
  }, [blocks]);

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1730]">
      <div ref={host} className="h-full min-h-[320px]" />
      {blocks.length === 0 ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#93a0b8]">
          Generate a plan to preview its blocks. This view stays empty until a valid instruction exists.
        </p>
      ) : null}
      {limited ? (
        <p className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-[#d5e4ff]">
          Showing the first 15,000 blocks of a larger plan. Approval still uses the full validated plan.
        </p>
      ) : null}
    </div>
  );
}
