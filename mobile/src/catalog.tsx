import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import "expo-sqlite/localStorage/install";
import { generateTemplate, listTemplates } from "../../packages/protocol/src/templates.js";
import { approveOnPc, pcPaired, previewOnPc, savedPcHost } from "./lib/companion";
import { GlowCard, HeartIcon, ModeMenu, ScreenHero } from "./chrome";
import { defaultBlocks, StructureArt } from "./preview";
import { theme as c } from "./theme";
import { Button, Field, Note } from "./ui";

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

type Block = { x: number; y: number; z: number; block: string };

const FAVORITES_KEY = "voicecraft.catalog.favorites";
const SAVED_KEY = "voicecraft.local.blueprints";

const GROUPS = [
  { id: "All", label: "All", categories: null as string[] | null },
  { id: "Houses", label: "Houses", categories: ["Homes & Cabins", "Modern & Luxury"] },
  { id: "Castles", label: "Castles", categories: ["Medieval & Fortified"] },
  { id: "Nature", label: "Nature", categories: ["Fantasy & Magic", "Temples & Monuments"] },
  { id: "Farms", label: "Farms", categories: ["Farms & Nature"] },
];

const STYLES = [
  { id: "default", label: "Default", material: "" },
  { id: "medieval", label: "Medieval", material: "stone_bricks" },
  { id: "modern", label: "Modern", material: "quartz_block" },
  { id: "fantasy", label: "Fantasy", material: "deepslate_tiles" },
];

function readList(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => readList(FAVORITES_KEY));
  function toggle(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }
  return { favorites, toggle };
}

function blockLabel(id: string) {
  return id.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const span = Math.max(1, max - min);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <TrackFill value={value} min={min} span={span} onChange={onChange} />
    </View>
  );
}

function TrackFill({ value, min, span, onChange }: { value: number; min: number; span: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(1);
  const ratio = Math.max(0, Math.min(1, (value - min) / span));
  function commit(location: number) {
    const next = Math.round(min + Math.max(0, Math.min(1, location / Math.max(1, width))) * span);
    onChange(next);
  }
  return (
    <View
      style={styles.trackHit}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => commit(event.nativeEvent.locationX)}
      onResponderMove={(event) => commit(event.nativeEvent.locationX)}
    >
      <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
      <View style={[styles.knob, { left: `${ratio * 100}%` }]} />
    </View>
  );
}

export function CatalogScreen({ onOpen, onBell }: { onOpen: (id: string) => void; onBell: () => void }) {
  const { width } = useWindowDimensions();
  const templates = useMemo(() => listTemplates() as TemplateRecord[], []);
  const categories = useMemo(() => [...new Set(templates.map((template) => template.category))], [templates]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [category, setCategory] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { favorites, toggle } = useFavorites();
  const tile = (width - 44) / 2;
  const visible = templates.filter((template) => {
    const selected = GROUPS.find((item) => item.id === group);
    if (category && template.category !== category) return false;
    if (!category && selected?.categories && !selected.categories.includes(template.category)) return false;
    const haystack = `${template.name} ${template.category} ${template.tags.join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <ScreenHero compact subtitle="Browse 50 ready-to-build structures" onBell={onBell} />
            <View style={styles.headerBody}>
              <View style={styles.searchRow}>
                <View style={{ flex: 1 }}>
                  <Field value={query} onChangeText={setQuery} placeholder="Search structures, e.g. castle, house, farm..." accessibilityLabel="Search structures" />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Filter categories" onPress={() => setFiltersOpen(true)} style={styles.filter}>
                  <Text style={styles.filterText}>≡</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                {GROUPS.map((item) => {
                  const active = group === item.id && !category;
                  return (
                    <Pressable key={item.id} onPress={() => { setGroup(item.id); setCategory(null); }} style={[styles.pill, active && styles.pillOn]}>
                      <Text style={[styles.pillText, active && styles.pillTextOn]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {category ? <Note>Showing {category}. Clear it from the filter.</Note> : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.tile, { width: tile }]} onPress={() => onOpen(item.id)}>
            <StructureArt blocks={defaultBlocks(item.id)} width={tile} height={118} rounded={16} />
            <View style={styles.tileBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.tileTitle} numberOfLines={2}>{item.name}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={favorites.includes(item.id) ? "Remove favorite" : "Favorite"} onPress={() => toggle(item.id)} hitSlop={8}>
                  <HeartIcon on={favorites.includes(item.id)} />
                </Pressable>
              </View>
              <Text style={styles.tileMeta}>{item.estimatedBlocks} blocks</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No structures match that search.</Text>}
      />
      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.section}>Categories</Text>
            {categories.map((item) => (
              <Pressable key={item} onPress={() => { setCategory(item); setGroup("All"); setFiltersOpen(false); }} style={styles.modalRow}>
                <Text style={styles.modalText}>{item}</Text>
              </Pressable>
            ))}
            <Button title="Show all" secondary onPress={() => { setCategory(null); setGroup("All"); setFiltersOpen(false); }} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export function BlueprintScreen({
  templateId,
  mode,
  onMode,
  onBell,
  onBack,
}: {
  templateId: string;
  mode: "blueprint" | "voice";
  onMode: (mode: "blueprint" | "voice") => void;
  onBell: () => void;
  onBack: () => void;
}) {
  const templates = useMemo(() => listTemplates() as TemplateRecord[], []);
  const template = templates.find((item) => item.id === templateId) || templates[0];
  const { width } = useWindowDimensions();
  const artWidth = Math.min(width - 32, 420);
  const { favorites, toggle } = useFavorites();
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
  const [placement, setPlacement] = useState<"ground" | "water" | "floating">("ground");
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const options = history[cursor];
  useEffect(() => {
    const next: Options = {
      width: template.defaults.width,
      depth: template.defaults.depth,
      floors: template.defaults.floors,
      material: template.defaults.material,
      accent: template.defaults.accent,
      rotation: 0,
      mirror: null,
    };
    setHistory([next]);
    setCursor(0);
    setFingerprint("");
    setNote("");
  }, [template.id]);
  const plan = useMemo(() => generateTemplate(template.id, options), [template.id, options]);
  const angles = useMemo(() => [0, 1, 2].map((rotation) => generateTemplate(template.id, { ...options, rotation }).blocks as Block[]), [template.id, options]);
  const materials = useMemo(() => {
    const counts = new Map<string, number>();
    for (const block of plan.blocks as Block[]) {
      if (block.block === "air") continue;
      counts.set(block.block, (counts.get(block.block) || 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [plan]);

  function apply(next: Options) {
    const stack = history.slice(0, cursor + 1).concat(next);
    setHistory(stack);
    setCursor(stack.length - 1);
    setFingerprint("");
    setNote("");
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
    setNote("Saved on this phone. The world was not changed.");
  }

  const styleId = STYLES.find((item) => item.material && item.material === options.material)?.id || "default";

  return (
    <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled">
      <ScreenHero
        compact
        subtitle="Design, customize, and prepare your build for your world."
        onBell={onBell}
        right={<ModeMenu mode={mode} onChange={onMode} />}
      />
      <View style={styles.pad}>
        <GlowCard>
          <View style={styles.rowBetween}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to catalog" onPress={onBack}><Text style={styles.link}>‹</Text></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{template.name}</Text>
              <Text style={styles.tileMeta}>Blueprint · Customizable</Text>
            </View>
            <Pressable onPress={() => toggle(template.id)}><HeartIcon on={favorites.includes(template.id)} /></Pressable>
          </View>
          <View>
            <StructureArt blocks={plan.blocks} width={artWidth - 28} height={210} />
            <View style={styles.sideTools}>
              <Tool label="Undo" disabled={cursor === 0} onPress={() => { setCursor((current) => current - 1); setFingerprint(""); }} />
              <Tool label="Redo" disabled={cursor === history.length - 1} onPress={() => { setCursor((current) => current + 1); setFingerprint(""); }} />
              <Tool label="Turn" onPress={() => apply({ ...options, rotation: (options.rotation + 1) % 4 })} />
              <Tool label="Reset" onPress={() => apply(initial)} />
            </View>
          </View>
          <Pressable onPress={() => Alert.alert("No in-world view", "This is the block plan. The phone cannot place a hologram in the Minecraft world.")}>
            <Text style={styles.link}>View in World</Text>
          </Pressable>
          <Text style={styles.tileMeta}>Plan preview. Not a live view of the world.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {angles.map((blocks, index) => (
              <Pressable key={index} onPress={() => apply({ ...options, rotation: index })} style={[styles.angle, options.rotation === index && styles.angleOn]}>
                <StructureArt blocks={blocks} width={92} height={64} rounded={10} />
              </Pressable>
            ))}
          </ScrollView>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Dimensions</Text>
          {template.supports.resize ? (
            <>
              <Slider label="Width (X)" value={options.width} min={template.ranges.width[0]} max={template.ranges.width[1]} onChange={(value) => apply({ ...options, width: value })} />
              <Slider label="Length (Z)" value={options.depth} min={template.ranges.depth[0]} max={template.ranges.depth[1]} onChange={(value) => apply({ ...options, depth: value })} />
            </>
          ) : <Note>This template does not resize.</Note>}
          {template.supports.floors ? (
            <Slider label="Floors" value={options.floors} min={template.ranges.floors[0]} max={template.ranges.floors[1]} onChange={(value) => apply({ ...options, floors: value })} />
          ) : <Note>Height is {plan.bounds.height} blocks for this plan. This template does not add floors.</Note>}
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Transform</Text>
          <Text style={styles.label}>Rotation</Text>
          <View style={styles.choiceRow}>
            {[0, 1, 2, 3].map((rotation) => (
              <Pressable key={rotation} onPress={() => apply({ ...options, rotation })} style={[styles.choice, options.rotation === rotation && styles.choiceOn]}>
                <Text style={styles.choiceText}>{rotation * 90}°</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Mirror</Text>
          <View style={styles.choiceRow}>
            <Pressable onPress={() => apply({ ...options, mirror: null })} style={[styles.choice, options.mirror === null && styles.choiceOn]}><Text style={styles.choiceText}>None</Text></Pressable>
            <Pressable onPress={() => apply({ ...options, mirror: "x" })} style={[styles.choice, options.mirror === "x" && styles.choiceOn]}><Text style={styles.choiceText}>Flip X</Text></Pressable>
            <Pressable onPress={() => apply({ ...options, mirror: "z" })} style={[styles.choice, options.mirror === "z" && styles.choiceOn]}><Text style={styles.choiceText}>Flip Z</Text></Pressable>
          </View>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Build Style</Text>
          <View style={styles.choiceRow}>
            {STYLES.map((item) => (
              <Pressable key={item.id} onPress={() => apply({ ...options, material: item.material || template.defaults.material })} style={[styles.styleCard, styleId === item.id && styles.choiceOn]}>
                <Text style={styles.choiceText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Note>Style changes the template material when this structure uses it. The picture updates from the plan.</Note>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Placement</Text>
          <View style={styles.choiceRow}>
            {([
              ["ground", "On Ground"],
              ["water", "On Water"],
              ["floating", "Floating"],
            ] as const).map(([id, label]) => (
              <Pressable key={id} onPress={() => setPlacement(id)} style={[styles.styleCard, placement === id && styles.choiceOn]}>
                <Text style={styles.choiceText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Note>The desktop bridge places this at the bot. On Water and Floating are not sent as a world offset.</Note>
        </GlowCard>

        <View style={styles.infoRow}>
          <GlowCard style={styles.infoCard}>
            <Text style={styles.section}>Build Info</Text>
            <Text style={styles.tileMeta}>Operations {plan.count}</Text>
            <Text style={styles.tileMeta}>Bounds {plan.bounds.width}×{plan.bounds.height}×{plan.bounds.depth}</Text>
            <Text style={styles.tileMeta}>Air cells {plan.blocks.filter((block: Block) => block.block === "air").length}</Text>
          </GlowCard>
          <GlowCard style={styles.infoCard}>
            <Text style={styles.section}>Materials</Text>
            <Text style={styles.tileMeta}>Total: {materials.length} types</Text>
            {materials.slice(0, 4).map(([id, count]) => <Text key={id} style={styles.tileMeta}>{blockLabel(id)} {count}</Text>)}
            {materials.length > 4 ? <Pressable onPress={() => setMaterialsOpen(true)}><Text style={styles.link}>View all materials</Text></Pressable> : null}
          </GlowCard>
        </View>

        <GlowCard>
          <Text style={styles.section}>Validation</Text>
          <Text style={styles.good}>Structure plan is valid</Text>
          <Text style={styles.warn}>World terrain is checked when the PC bridge runs</Text>
          <Text style={styles.warn}>Inventory is not checked from the phone</Text>
          {(Array.isArray(plan.warnings) ? plan.warnings : []).map((warning: string) => <Text key={warning} style={styles.warn}>{warning}</Text>)}
          <Text style={styles.tileMeta}>{template.permissions}</Text>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Preview & Approval</Text>
          <Text style={styles.tileMeta}>{fingerprint ? "Preview ready. The PC plan matches this screen." : "No preview generated. Prepare one before approving."}</Text>
          <Button title="Prepare Preview" onPress={() => void sendPreview().catch((error) => Alert.alert("PC preview failed", error instanceof Error ? error.message : "Preview failed."))} />
          {note ? <Note>{note}</Note> : null}
        </GlowCard>

        <Button title="Save Blueprint" secondary onPress={saveLocal} />
        <Button title="Approve Build" disabled={!fingerprint} onPress={() => {
          const host = savedPcHost();
          void approveOnPc(host, template.id, options, fingerprint)
            .then(() => setNote("The PC accepted the approval and will place blocks only through its own bridge."))
            .catch((error) => Alert.alert("Not approved", error instanceof Error ? error.message : "Approval failed."));
        }} />
      </View>
      <Modal visible={materialsOpen} transparent animationType="fade" onRequestClose={() => setMaterialsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMaterialsOpen(false)}>
          <View style={styles.modalCard}>
            {materials.map(([id, count]) => <Text key={id} style={styles.modalText}>{blockLabel(id)} · {count}</Text>)}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Tool({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.tool, disabled && { opacity: 0.4 }]}>
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 12 },
  columns: { gap: 12, paddingHorizontal: 16 },
  headerBody: { gap: 12, padding: 16 },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  filter: { alignItems: "center", borderColor: c.border, borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  filterText: { color: c.text, fontSize: 18 },
  pills: { gap: 8 },
  pill: { borderColor: "#24558F", borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  pillOn: { backgroundColor: c.blueDeep, borderColor: c.blue },
  pillText: { color: c.muted, fontWeight: "700" },
  pillTextOn: { color: c.text },
  tile: { backgroundColor: c.surface, borderColor: "#1B4F8C", borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  tileBody: { gap: 4, padding: 10 },
  tileTitle: { color: c.text, flex: 1, fontWeight: "800" },
  tileMeta: { color: c.muted, fontSize: 12, lineHeight: 18 },
  empty: { color: c.muted, padding: 16 },
  editor: { paddingBottom: 28 },
  pad: { gap: 12, padding: 16 },
  rowBetween: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  section: { color: c.text, fontSize: 15, fontWeight: "800" },
  label: { color: c.muted, fontSize: 12, fontWeight: "700" },
  value: { color: c.text, fontWeight: "800" },
  link: { color: c.blue, fontSize: 18, fontWeight: "800" },
  sideTools: { gap: 6, position: "absolute", right: 8, top: 8 },
  tool: { backgroundColor: "rgba(7,16,32,0.82)", borderColor: "#24558F", borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  toolText: { color: c.text, fontSize: 10, fontWeight: "800" },
  angle: { borderColor: "transparent", borderRadius: 12, borderWidth: 2 },
  angleOn: { borderColor: c.blue },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderColor: "#24558F", borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  choiceOn: { borderColor: c.blue, backgroundColor: "#12315F" },
  choiceText: { color: c.text, fontSize: 12, fontWeight: "700" },
  styleCard: { borderColor: "#24558F", borderRadius: 14, borderWidth: 1, minWidth: 72, padding: 10 },
  infoRow: { flexDirection: "row", gap: 10 },
  infoCard: { flex: 1 },
  good: { color: c.success, fontSize: 13 },
  warn: { color: c.warning, fontSize: 13 },
  track: { height: 28, justifyContent: "center" },
  trackHit: { backgroundColor: "#10233F", borderRadius: 8, height: 8, justifyContent: "center" },
  trackFill: { backgroundColor: c.blue, borderRadius: 8, height: 8 },
  knob: { backgroundColor: "#EAF3FF", borderRadius: 8, height: 16, marginLeft: -8, position: "absolute", width: 16 },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.55)", flex: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#0C1830", borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 8, padding: 16 },
  modalRow: { paddingVertical: 8 },
  modalText: { color: c.text, fontSize: 15 },
});
