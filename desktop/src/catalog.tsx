import { useEffect, useMemo, useState } from "react";
import { generateTemplate, isometricPreview, listTemplates, MATERIALS } from "./structures";
import { VoxelPreview } from "./preview";

type TemplateOptions = {
  width: number;
  depth: number;
  floors: number;
  material: string;
  accent: string;
  rotation: number;
  mirror: "x" | "z" | null;
};

type CatalogTemplate = ReturnType<typeof listTemplates>[number];

const FAVORITES_KEY = "voicecraft.catalog.favorites";
const RECENT_KEY = "voicecraft.catalog.recent";

function readIds(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function Thumb({ id }: { id: string }) {
  const preview = useMemo(() => isometricPreview(generateTemplate(id).blocks, 280, 180), [id]);
  return (
    <svg viewBox={`0 0 ${preview.width} ${preview.height}`} className="h-36 w-full rounded-xl bg-[#10233f]" role="img" aria-label="Structure preview from the block plan">
      {preview.faces.map((face, index) => (
        <polygon key={index} points={face.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={face.color} />
      ))}
    </svg>
  );
}

export function Catalog({
  bridgeRunning,
  jobId,
  planWarnings,
  onPrepare,
  onApprove,
  onPause,
  onResume,
  onCancel,
}: {
  bridgeRunning: boolean;
  jobId: string;
  planWarnings: string[];
  onPrepare: (instruction: Record<string, unknown>, description: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const templates = useMemo(() => listTemplates(), []);
  const categories = useMemo(() => ["All", ...new Set(templates.map((template) => template.category))], [templates]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(readIds(FAVORITES_KEY));
    setRecent(readIds(RECENT_KEY));
  }, []);

  const visible = templates.filter((template) => {
    const haystack = `${template.name} ${template.category} ${template.tags.join(" ")}`.toLowerCase();
    if (category !== "All" && template.category !== category) return false;
    if (favoritesOnly && !favorites.includes(template.id)) return false;
    return haystack.includes(query.trim().toLowerCase());
  });
  const selected = templates.find((template) => template.id === selectedId) || null;

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [id, ...favorites];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }

  function openTemplate(template: CatalogTemplate) {
    setSelectedId(template.id);
    const next = [template.id, ...recent.filter((item) => item !== template.id)].slice(0, 6);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Structure catalog</h2>
      <p className="mt-1 max-w-3xl text-sm text-[#93a0b8]">
        Fifty shared presets. Thumbnails are drawn from the same voxel plan the builder uses. This view is a local preview, not an in-world hologram.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search structures"
          className="min-w-52 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
        />
        <button className={`rounded-xl px-3 py-2 text-sm ${favoritesOnly ? "bg-[#2f7bff]" : "bg-white/10"}`} onClick={() => setFavoritesOnly((current) => !current)}>
          Favorites
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-auto pb-1">
        {categories.map((item) => (
          <button key={item} className={`shrink-0 rounded-full px-3 py-1 text-xs ${category === item ? "bg-[#2f7bff]" : "bg-white/10 text-[#c5d2ea]"}`} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      {recent.length > 0 ? <p className="mt-3 text-xs text-[#93a0b8]">Recent: {recent.map((id) => templates.find((template) => template.id === id)?.name || id).join(" · ")}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((template) => (
          <article key={template.id} className="rounded-2xl border border-white/10 bg-[#0b1730] p-3 transition hover:border-[#2f7bff]">
            <Thumb id={template.id} />
            <div className="mt-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{template.name}</h3>
                <p className="text-xs text-[#93a0b8]">{template.category}</p>
              </div>
              <button className="text-xs text-[#7eb6ff]" onClick={() => toggleFavorite(template.id)}>{favorites.includes(template.id) ? "Saved" : "Save"}</button>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-[#c5d2ea]">{template.description}</p>
            <p className="mt-2 text-xs text-[#93a0b8]">{template.estimatedBlocks} blocks · {template.complexity}</p>
            <button className="mt-3 w-full rounded-xl bg-[#2f7bff] px-3 py-2 text-sm" onClick={() => openTemplate(template)}>Open blueprint</button>
          </article>
        ))}
      </div>
      {selected ? (
        <BlueprintEditor
          template={selected}
          bridgeRunning={bridgeRunning}
          jobId={jobId}
          planWarnings={planWarnings}
          onPrepare={onPrepare}
          onApprove={onApprove}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </section>
  );
}

function BlueprintEditor({
  template,
  bridgeRunning,
  jobId,
  planWarnings,
  onPrepare,
  onApprove,
  onPause,
  onResume,
  onCancel,
  onClose,
}: {
  template: CatalogTemplate;
  bridgeRunning: boolean;
  jobId: string;
  planWarnings: string[];
  onPrepare: (instruction: Record<string, unknown>, description: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const initial: TemplateOptions = {
    width: template.defaults.width,
    depth: template.defaults.depth,
    floors: template.defaults.floors,
    material: template.defaults.material,
    accent: template.defaults.accent,
    rotation: 0,
    mirror: null,
  };
  const [history, setHistory] = useState<TemplateOptions[]>([initial]);
  const [cursor, setCursor] = useState(0);
  const [note, setNote] = useState("");
  const [preparedFingerprint, setPreparedFingerprint] = useState("");
  const options = history[cursor];
  const plan = useMemo(() => generateTemplate(template.id, options), [template.id, options]);
  const airCount = plan.blocks.filter((block) => block.block === "air").length;
  const materials = useMemo(() => {
    const known = MATERIALS as readonly string[];
    const baseline = generateTemplate(template.id, { ...options, material: template.defaults.material }).fingerprint;
    const choices = known.filter((material) => generateTemplate(template.id, { ...options, material }).fingerprint !== baseline);
    return [...new Set([options.material, ...choices])];
  }, [template.id, template.defaults.material, options]);
  const accentChanges = useMemo(() => {
    const current = generateTemplate(template.id, options).fingerprint;
    return generateTemplate(template.id, { ...options, accent: options.accent === "quartz_block" ? "stone_bricks" : "quartz_block" }).fingerprint !== current;
  }, [template.id, options]);

  function apply(next: TemplateOptions) {
    const stack = history.slice(0, cursor + 1).concat(next);
    setHistory(stack);
    setCursor(stack.length - 1);
    setPreparedFingerprint("");
  }

  async function prepare() {
    const known = MATERIALS as readonly string[];
    const legacyMaterial = known.includes(options.material) ? options.material : "stone_bricks";
    const instruction = {
      valid: true,
      action: "build",
      structure: "house",
      templateId: template.id,
      templateOptions: options,
      material: legacyMaterial,
      floors: plan.settings.floors,
      dimensions: { width: plan.settings.width, depth: plan.settings.depth, height: plan.bounds.height },
      raw: template.name,
      warnings: plan.warnings,
    };
    await onPrepare(instruction, `${template.name}: ${plan.count} block operations. Local preview only until the bridge assigns a job.`);
    setPreparedFingerprint(plan.fingerprint);
    setNote(bridgeRunning ? "The desktop bridge is preparing this plan. Approve only after the job id appears." : "The Minecraft bridge is not running. The preview stays on this PC.");
  }

  async function save() {
    const known = MATERIALS as readonly string[];
    const legacyMaterial = known.includes(options.material) ? options.material : "stone_bricks";
    await callSave({
      name: template.name,
      category: template.category,
      structure: "house",
      material: legacyMaterial,
      size: plan.count > 800 ? "large" : plan.count > 300 ? "medium" : "small",
      floors: plan.settings.floors,
      dimensions: {
        width: Math.min(64, plan.bounds.width),
        depth: Math.min(64, plan.bounds.depth),
        height: Math.min(384, plan.bounds.height),
      },
      notes: template.description,
      templateId: template.id,
      templateOptions: plan.settings,
    });
    setNote("Blueprint saved on this PC.");
  }

  return (
    <div className="mt-6 rounded-3xl border border-[#2f7bff]/40 bg-[#07111f] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{template.name}</h3>
          <p className="mt-1 text-sm text-[#93a0b8]">{template.description}</p>
        </div>
        <button className="rounded-xl bg-white/10 px-3 py-2 text-sm" onClick={onClose}>Close</button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-2 text-sm">
          <label className="grid gap-1">Width
            <input type="number" min={template.ranges.width[0]} max={template.ranges.width[1]} value={options.width} onChange={(event) => apply({ ...options, width: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
          </label>
          <label className="grid gap-1">Depth
            <input type="number" min={template.ranges.depth[0]} max={template.ranges.depth[1]} value={options.depth} onChange={(event) => apply({ ...options, depth: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
          </label>
          <label className="grid gap-1">Floors
            <input type="number" disabled={!template.supports.floors} min={template.ranges.floors[0]} max={template.ranges.floors[1]} value={options.floors} onChange={(event) => apply({ ...options, floors: Number(event.target.value) })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 disabled:opacity-40" />
          </label>
          {!template.supports.floors ? <p className="text-xs text-[#93a0b8]">This template does not add floors.</p> : null}
          <label className="grid gap-1">Primary material
            <select disabled={materials.length < 2} value={options.material} onChange={(event) => apply({ ...options, material: event.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 disabled:opacity-40">
              {materials.map((material) => <option key={material}>{material}</option>)}
            </select>
          </label>
          {materials.length < 2 ? <p className="text-xs text-[#93a0b8]">This template uses fixed materials, so the material control is off.</p> : null}
          <label className="grid gap-1">Accent
            <select disabled={!accentChanges} value={options.accent} onChange={(event) => apply({ ...options, accent: event.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 disabled:opacity-40">
              {["stone_bricks", "quartz_block", "deepslate_tiles"].map((material) => <option key={material}>{material}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-white/10 px-3 py-2" onClick={() => apply({ ...options, rotation: (options.rotation + 1) % 4 })}>Rotate 90°</button>
            <button className="rounded-xl bg-white/10 px-3 py-2" onClick={() => apply({ ...options, mirror: options.mirror === "x" ? null : "x" })}>Mirror X</button>
            <button className="rounded-xl bg-white/10 px-3 py-2" onClick={() => apply({ ...options, mirror: options.mirror === "z" ? null : "z" })}>Mirror Z</button>
            <button className="rounded-xl bg-white/10 px-3 py-2" disabled={cursor === 0} onClick={() => { setCursor((current) => current - 1); setPreparedFingerprint(""); }}>Undo edit</button>
            <button className="rounded-xl bg-white/10 px-3 py-2" disabled={cursor === history.length - 1} onClick={() => { setCursor((current) => current + 1); setPreparedFingerprint(""); }}>Redo edit</button>
            <button className="rounded-xl bg-white/10 px-3 py-2" onClick={() => apply(initial)}>Restore default</button>
          </div>
          <p className="text-xs text-[#93a0b8]">Placement offset is chosen by the bridge from the bot position when you approve. There is no in-world hologram.</p>
        </div>
        <div>
          <VoxelPreview blocks={plan.blocks.slice(0, 15000)} limited={plan.blocks.length > 15000} />
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Operations</dt><dd>{plan.count}{airCount ? ` · ${airCount} removals` : ""}</dd></div>
            <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Bounds</dt><dd>{plan.bounds.width}×{plan.bounds.height}×{plan.bounds.depth}</dd></div>
            <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Fingerprint</dt><dd className="font-mono text-xs">{plan.fingerprint}</dd></div>
            <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Version</dt><dd>Minecraft {template.minecraft} · generator {template.generatorVersion}</dd></div>
          </dl>
        </div>
      </div>
      {plan.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-[#ffd0a8]">{warning}</p>)}
      {planWarnings.map((warning) => <p key={warning} className="mt-1 text-xs text-[#ffd0a8]">{warning}</p>)}
      <p className="mt-2 text-xs text-[#93a0b8]">{template.permissions} Changing size, material, or orientation clears the previous approval.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-xl bg-[#2f7bff] px-4 py-2" onClick={() => void prepare().catch((error) => setNote(error instanceof Error ? error.message : "Preview failed."))}>Prepare build</button>
        <button className="rounded-xl bg-[#3dd6a5] px-4 py-2 text-[#06281d]" disabled={!jobId || preparedFingerprint !== plan.fingerprint} onClick={() => void onApprove()}>Approve build</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={onPause}>Pause</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={onResume}>Resume</button>
        <button className="rounded-xl bg-[#ff5d73]/20 px-4 py-2" onClick={onCancel}>Cancel</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void save().catch((error) => setNote(error instanceof Error ? error.message : "Could not save."))}>Save blueprint</button>
      </div>
      {note ? <p className="mt-3 text-sm text-[#c5d2ea]">{note}</p> : null}
      {jobId && preparedFingerprint === plan.fingerprint ? <p className="mt-1 text-xs text-[#93a0b8]">Bridge job {jobId}</p> : null}
    </div>
  );
}

async function callSave(blueprint: Record<string, unknown>) {
  if (!window.zeropulse) throw new Error("Open this screen inside the ZeroPulse desktop app to save a blueprint.");
  await window.zeropulse.invoke("library.save", { blueprint });
}
