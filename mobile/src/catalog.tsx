import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import "expo-sqlite/localStorage/install";
import { generateTemplate, isometricPreview, listTemplates } from "../../packages/protocol/src/templates.js";
import { approveOnPc, pcPaired, previewOnPc, savedPcHost } from "./lib/companion";
import { theme as c } from "./theme";
import { Button, Card, Field, Note } from "./ui";

type TemplateRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  complexity: string;
  estimatedBlocks: number;
  warnings: string[];
  permissions: string;
  minecraft: string;
  defaults: { width: number; depth: number; floors: number; material: string; accent: string };
  ranges: { width: number[]; depth: number[]; floors: number[] };
  supports: { floors: boolean; resize: boolean; rotate: boolean; mirror: boolean };
};

type Options = {
  width: number;
  depth: number;
  floors: number;
  material: string;
  accent: string;
  rotation: number;
  mirror: "x" | "z" | null;
};

const FAVORITES_KEY = "voicecraft.catalog.favorites";
const SAVED_KEY = "voicecraft.local.blueprints";

function readList(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function faceStyle(face: { points: Array<{ x: number; y: number }>; color: string }, scale = 1) {
  const xs = face.points.map((point) => point.x);
  const ys = face.points.map((point) => point.y);
  const left = Math.min(...xs) * scale;
  const top = Math.min(...ys) * scale;
  return {
    position: "absolute" as const,
    left,
    top,
    width: Math.max(3, (Math.max(...xs) - Math.min(...xs)) * scale),
    height: Math.max(3, (Math.max(...ys) - Math.min(...ys)) * scale),
    backgroundColor: face.color,
  };
}

function PlanView({ blocks, width, height, scale = 1 }: { blocks: Array<{ x: number; y: number; z: number; block: string }>; width: number; height: number; scale?: number }) {
  const preview = useMemo(() => isometricPreview(blocks, width, height), [blocks, width, height]);
  return (
    <View style={{ width: preview.width * scale, height: preview.height * scale, backgroundColor: "#10233f", borderRadius: 16, overflow: "hidden", alignSelf: "center" }}>
      {preview.faces.map((face: { points: Array<{ x: number; y: number }>; color: string }, index: number) => (
        <View key={index} style={faceStyle(face, scale)} />
      ))}
    </View>
  );
}

function Thumb({ id }: { id: string }) {
  const blocks = useMemo(() => generateTemplate(id).blocks, [id]);
  return <PlanView blocks={blocks} width={180} height={120} />;
}

export function CatalogScreen() {
  const templates = useMemo(() => listTemplates() as TemplateRecord[], []);
  const categories = useMemo(() => ["All", ...new Set(templates.map((template) => template.category))], [templates]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>(() => readList(FAVORITES_KEY));
  const [selected, setSelected] = useState<TemplateRecord | null>(null);
  const visible = templates.filter((template) => {
    const haystack = `${template.name} ${template.category} ${template.tags.join(" ")}`.toLowerCase();
    if (category !== "All" && template.category !== category) return false;
    return haystack.includes(query.trim().toLowerCase());
  });

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [id, ...favorites];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }

  if (selected) {
    return <Editor template={selected} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected.id)} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.kicker}>CATALOG</Text>
      <Note>Thumbnails come from the shared voxel plan. This is an isometric preview on the phone, not a live 3D view and not an in-world hologram.</Note>
      <Field value={query} onChangeText={setQuery} placeholder="Search structures" accessibilityLabel="Search structures" />
      <View style={styles.chips}>
        {categories.map((item) => (
          <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipOn]}>
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {visible.map((template) => (
          <Pressable key={template.id} style={styles.tile} onPress={() => setSelected(template)}>
            <Thumb id={template.id} />
            <Text style={styles.tileTitle}>{template.name}</Text>
            <Text style={styles.tileMeta}>{template.estimatedBlocks} blocks</Text>
            <Pressable onPress={() => toggleFavorite(template.id)}><Text style={styles.link}>{favorites.includes(template.id) ? "Favorited" : "Favorite"}</Text></Pressable>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Editor({ template, favorite, onFavorite, onBack }: { template: TemplateRecord; favorite: boolean; onFavorite: () => void; onBack: () => void }) {
  const initial: Options = {
    width: template.defaults.width,
    depth: template.defaults.depth,
    floors: template.defaults.floors,
    material: template.defaults.material,
    accent: template.defaults.accent,
    rotation: 0,
    mirror: null,
  };
  const [history, setHistory] = useState<Options[]>([initial]);
  const [cursor, setCursor] = useState(0);
  const [fingerprint, setFingerprint] = useState("");
  const [note, setNote] = useState("");
  const options = history[cursor];
  const plan = useMemo(() => generateTemplate(template.id, options), [template.id, options]);

  function apply(next: Options) {
    const stack = history.slice(0, cursor + 1).concat(next);
    setHistory(stack);
    setCursor(stack.length - 1);
    setFingerprint("");
  }

  async function sendPreview() {
    const host = savedPcHost();
    if (!pcPaired() || !host) throw new Error("Pair this phone from My PC before sending a blueprint.");
    const result = await previewOnPc(host, template.id, options);
    if (result.fingerprint !== plan.fingerprint || result.count !== plan.count) {
      throw new Error("The PC plan does not match this preview. It was not approved.");
    }
    setFingerprint(result.fingerprint);
    setNote(`PC prepared ${result.count} operations. Approve sends that same plan.`);
  }

  function saveLocal() {
    const saved = readList(SAVED_KEY).filter((item) => item?.templateId !== template.id);
    saved.unshift({ templateId: template.id, name: template.name, options: plan.settings, fingerprint: plan.fingerprint, savedAt: new Date().toISOString() });
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved.slice(0, 50)));
    setNote("Saved on this phone. It is not uploaded to the cloud library.");
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.kicker}>{template.category.toUpperCase()}</Text>
      <Text style={styles.title}>{template.name}</Text>
      <Note>{template.description}</Note>
      <PlanView blocks={plan.blocks} width={320} height={220} />
      <Note>{plan.count} operations · {plan.blocks.filter((block: { block: string }) => block.block === "air").length} removals · {plan.bounds.width}×{plan.bounds.height}×{plan.bounds.depth} · {plan.fingerprint}</Note>
      <Note>Minecraft {template.minecraft}. {template.permissions}</Note>
      {(Array.isArray(plan.warnings) ? plan.warnings : []).map((warning: string) => <Note key={warning}>{warning}</Note>)}
      <Card>
        <Text style={styles.cardTitle}>Customize</Text>
        {template.supports.resize ? (
          <>
            <Field value={String(options.width)} onChangeText={(value) => apply({ ...options, width: Number(value) })} keyboardType="number-pad" accessibilityLabel="Width" />
            <Field value={String(options.depth)} onChangeText={(value) => apply({ ...options, depth: Number(value) })} keyboardType="number-pad" accessibilityLabel="Depth" />
          </>
        ) : <Note>Resize is not available for this template.</Note>}
        {template.supports.floors ? (
          <Field value={String(options.floors)} onChangeText={(value) => apply({ ...options, floors: Number(value) })} keyboardType="number-pad" accessibilityLabel="Floors" />
        ) : <Note>This template does not add floors.</Note>}
        <Button title="Rotate 90°" secondary onPress={() => apply({ ...options, rotation: (options.rotation + 1) % 4 })} />
        <Button title={options.mirror === "x" ? "Clear mirror" : "Mirror X"} secondary onPress={() => apply({ ...options, mirror: options.mirror === "x" ? null : "x" })} />
        <Button title="Undo edit" secondary disabled={cursor === 0} onPress={() => { setCursor((current) => current - 1); setFingerprint(""); }} />
        <Button title="Redo edit" secondary disabled={cursor === history.length - 1} onPress={() => { setCursor((current) => current + 1); setFingerprint(""); }} />
        <Button title="Restore default" secondary onPress={() => apply(initial)} />
        <Note>The build anchor is the desktop bot's position. This phone does not show an in-world hologram.</Note>
      </Card>
      <Button title={favorite ? "Unfavorite" : "Favorite"} secondary onPress={onFavorite} />
      <Button title="Save on this phone" secondary onPress={saveLocal} />
      <Button title="Prepare on my PC" onPress={() => void sendPreview().catch((error) => Alert.alert("PC preview failed", error instanceof Error ? error.message : "Preview failed."))} />
      <Button title="Approve on my PC" disabled={!fingerprint} onPress={() => {
        const host = savedPcHost();
        void approveOnPc(host, template.id, options, fingerprint)
          .then(() => setNote("The PC accepted the approval and will place blocks only through its own bridge."))
          .catch((error) => Alert.alert("Not approved", error instanceof Error ? error.message : "Approval failed."));
      }} />
      <Button title="Back to catalog" secondary onPress={onBack} />
      {note ? <Note>{note}</Note> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  kicker: { color: c.blue, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  title: { color: c.text, fontSize: 28, fontWeight: "800" },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: c.blueDeep, borderColor: c.blue },
  chipText: { color: c.text, fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47%", gap: 6 },
  tileTitle: { color: c.text, fontWeight: "700" },
  tileMeta: { color: c.muted, fontSize: 12 },
  link: { color: c.blue, fontSize: 12, fontWeight: "700" },
});
