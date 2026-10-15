import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PreviewBlock } from "./types";
// @ts-expect-error Shared canonical block geometry is JavaScript.
import { blockCuboids, isOpaqueCube } from "../../packages/protocol/src/block-shapes.js";
// @ts-expect-error Shared original procedural palette is JavaScript.
import { materialColor } from "../../packages/protocol/src/material-colors.js";
// @ts-expect-error Shared plan bounds are JavaScript.
import { boundsOf } from "../../packages/protocol/src/blueprint-edit.js";

export function VoxelPreview({ blocks, limited }: { blocks: PreviewBlock[]; limited?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [cutaway, setCutaway] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b1730");
    const camera = new THREE.PerspectiveCamera(
      45,
      element.clientWidth / Math.max(element.clientHeight, 1),
      0.1,
      2000,
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(element.clientWidth, element.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xd7e6ff, 1.1);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, far: 200 });
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const bounds = boundsOf(blocks);
    const visible = blocks.filter(
      (block) =>
        block.block !== "air" && (!cutaway || block.y < bounds.min.y + bounds.height * 0.45),
    );
    const occupied = new Map(visible.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    const groups = new Map<string, number[][]>();
    for (const block of visible) {
      if (
        isOpaqueCube(block) &&
        [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ].every(([x, y, z]) =>
          isOpaqueCube(occupied.get(`${block.x + x},${block.y + y},${block.z + z}`)),
        )
      )
        continue;
      const list = groups.get(block.block) || [];
      for (const [x, y, z, X, Y, Z] of blockCuboids(block))
        list.push([block.x + x, block.y + y, block.z + z, X - x, Y - y, Z - z]);
      groups.set(block.block, list);
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const disposables: Array<{ dispose: () => void }> = [geometry];
    for (const [name, list] of groups) {
      // Original 16px procedural surfaces, with no copyrighted game resource pack.
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = materialColor(name);
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4)
        for (let x = 0; x < 16; x += 4) {
          ctx.fillStyle = `rgba(0,0,0,${((x * 3 + y * 7) % 11) / 100})`;
          ctx.fillRect(x, y, 4, 4);
        }
      ctx.strokeStyle = "rgba(0,0,0,.16)";
      if (/planks|bricks|tiles/.test(name))
        for (let y = 4; y < 16; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(16, y);
          ctx.stroke();
        }
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.88,
        emissive: /lantern|glowstone/.test(name) ? materialColor(name) : "#000000",
        emissiveIntensity: 0.65,
        transparent: name.includes("glass") || name === "water",
        opacity: name === "water" ? 0.55 : name.includes("glass") ? 0.45 : 1,
      });
      disposables.push(material, texture);
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const dummy = new THREE.Object3D();
      list.forEach(([x, y, z, w, h, d], index) => {
        dummy.position.set(x + w / 2, y + h / 2, z + d / 2);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      scene.add(mesh);
    }
    const cx = (bounds.min.x + bounds.max.x + 1) / 2,
      cz = (bounds.min.z + bounds.max.z + 1) / 2;
    const span = Math.max(bounds.width, bounds.depth, bounds.height, 5);
    camera.position.set(cx - span * 1.15, bounds.min.y + span, cz - span * 1.35);
    controls.target.set(cx, bounds.min.y + bounds.height * 0.35, cz);
    const groundGeometry = new THREE.PlaneGeometry(span * 2, span * 2),
      groundMaterial = new THREE.MeshStandardMaterial({ color: 0x142c37, roughness: 1 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, bounds.min.y - 0.1, cz);
    ground.receiveShadow = true;
    scene.add(ground);
    disposables.push(groundGeometry, groundMaterial);
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
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      element.replaceChildren();
    };
  }, [blocks, cutaway]);

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1730]">
      <div ref={host} className="h-full min-h-[320px]" />
      <button
        className="absolute top-3 right-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white"
        onClick={() => setCutaway((v) => !v)}
      >
        {cutaway ? "Show full structure" : "Inspect interior"}
      </button>
      {blocks.length === 0 ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#93a0b8]">
          Generate a plan to preview its blocks. This view stays empty until a valid instruction
          exists.
        </p>
      ) : null}
      {limited ? (
        <p className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-[#d5e4ff]">
          Showing the first 15,000 blocks of a larger plan. Approval still uses the full validated
          plan.
        </p>
      ) : null}
    </div>
  );
}
