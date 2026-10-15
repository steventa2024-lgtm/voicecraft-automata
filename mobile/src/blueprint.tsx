import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { generateTemplate, listTemplates } from "../../packages/protocol/src/templates.js";
import { approveOnPc, pcPaired, previewOnPc, savedPcHost } from "./lib/companion";
import { createApprovalGate } from "./lib/approval-gate.js";
import { templateControls } from "./lib/template-controls.js";
import { saveLocalBlueprint } from "./lib/local-blueprints.js";
import {
  GlowCard,
  Glyph,
  IconButton,
  ModeMenu,
  ScreenHero,
  SectionTitle,
  useContentWidth,
} from "./chrome";
import { MaterialCube, StructureArt } from "./preview";
import { Button, Field, Note } from "./ui";
import { theme as c } from "./theme";

export type Options = {
  width: number;
  depth: number;
  floors: number;
  material: string;
  accent: string;
  rotation: number;
  mirror: "x" | "z" | null;
  placement: "ground" | "floating";
  elevation: number;
};
export type BlueprintDraft = { id?: string; templateId: string; name: string; options: Options };
type Props = {
  templateId: string;
  draft?: BlueprintDraft | null;
  onDraft: (draft: BlueprintDraft) => void;
  mode: "blueprint" | "voice";
  onMode: (mode: "blueprint" | "voice") => void;
  onBell: () => void;
  onBack: () => void;
  onPc: () => void;
};
const STYLES = [
  { id: "default", name: "Default", material: "" },
  { id: "medieval", name: "Medieval", material: "stone_bricks" },
  { id: "modern", name: "Modern", material: "quartz_block" },
  { id: "fantasy", name: "Fantasy", material: "deepslate_tiles" },
];
export function BlueprintScreen(p: Props) {
  const template = useMemo(
    () => listTemplates().find((t: { id: string }) => t.id === p.templateId)!,
    [p.templateId],
  );
  const defaults: Options = {
    ...template.defaults,
    rotation: 0,
    mirror: null,
    placement: "ground",
    elevation: 0,
  };
  const editable = useMemo(() => templateControls(template), [template]);
  const [history, setHistory] = useState<Options[]>([p.draft?.options || defaults]),
    [cursor, setCursor] = useState(0);
  const [name, setName] = useState(p.draft?.name || template.name),
    [localId, setLocalId] = useState(p.draft?.id);
  const [camera, setCamera] = useState(2),
    [zoom, setZoom] = useState(1),
    [grid, setGrid] = useState(true),
    [cutaway, setCutaway] = useState(false),
    [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState<"prepare" | "approve" | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [rename, setRename] = useState(false),
    [materialsOpen, setMaterialsOpen] = useState(false);
  const width = useContentWidth(),
    compact = width < 370,
    viewport = width - 50;
  const options = history[cursor];
  const plan = useMemo(() => generateTemplate(template.id, options), [template.id, options]);
  const current = useRef(plan);
  current.current = plan;
  const gate = useRef(createApprovalGate()),
    mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        gate.current.invalidate();
        setReady(false);
      }
    });
    return () => {
      mounted.current = false;
      gate.current.invalidate();
      sub.remove();
    };
  }, []);
  const materials = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of plan.blocks) {
      if (b.block !== "air") counts.set(b.block, (counts.get(b.block) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [plan]);
  const solidCount = plan.blocks.filter((b: { block: string }) => b.block !== "air").length;
  function persistDraft(next: Options, nextName = name, id = localId) {
    p.onDraft({ id, templateId: template.id, name: nextName, options: next });
  }
  function invalidate() {
    gate.current.invalidate();
    setReady(false);
    setMessage("");
    setError("");
  }
  function apply(next: Options) {
    invalidate();
    const normalized = generateTemplate(template.id, next).settings as Options;
    const stack = history
      .slice(0, cursor + 1)
      .concat(normalized)
      .slice(-80);
    setHistory(stack);
    setCursor(stack.length - 1);
    persistDraft(normalized);
  }
  function undo(next: number) {
    invalidate();
    setCursor(next);
    persistDraft(history[next]);
  }
  async function prepare() {
    if (pending.current) return;
    setError("");
    setMessage("");
    setReady(false);
    if (!pcPaired() || !savedPcHost()) {
      setError("Pair a desktop in My PC to prepare this blueprint.");
      return;
    }
    pending.current = true;
    setBusy("prepare");
    const host = savedPcHost(),
      ticket = gate.current.begin(plan, host);
    try {
      const result = await previewOnPc(host, template.id, plan.settings);
      if (!mounted.current) return;
      const accepted = gate.current.accept(ticket, result, current.current, savedPcHost());
      setReady(accepted);
      setMessage(
        accepted
          ? "The PC confirmed this exact plan. Ready for your approval."
          : "The plan changed while preparing. Prepare the current version again.",
      );
    } catch (e) {
      if (mounted.current) {
        gate.current.invalidate();
        setReady(false);
        setError(messageOf(e));
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  async function approve() {
    const host = savedPcHost();
    if (pending.current || !gate.current.consume(plan, host)) return;
    setReady(false);
    pending.current = true;
    setBusy("approve");
    setError("");
    try {
      await approveOnPc(host, template.id, plan.settings, plan.fingerprint);
      if (mounted.current)
        setMessage("Approval sent to your PC. View My PC for reported build progress.");
    } catch (e) {
      if (mounted.current) setError(messageOf(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  function save() {
    try {
      const item = saveLocalBlueprint({
        id: localId,
        templateId: template.id,
        name,
        options: plan.settings,
      });
      setLocalId(item.id);
      persistDraft(options, name, item.id);
      setMessage("Saved on this device. Open it anytime in Library.");
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }
  const styleId = STYLES.find((s) => s.material === options.material)?.id || "default";
  const controls = (
    <View style={s.tools}>
      <IconButton
        icon="zoom"
        label="Zoom preview"
        onPress={() => setZoom((v) => (v >= 1.6 ? 1 : v + 0.2))}
      />
      <IconButton
        icon="rotate"
        label="Orbit camera"
        onPress={() => setCamera((v) => (v + 1) % 4)}
      />
      <IconButton
        icon="grid"
        label="Toggle preview grid"
        active={grid}
        onPress={() => setGrid(!grid)}
      />
      <IconButton
        icon="fit"
        label="Fit preview"
        onPress={() => {
          setZoom(1);
          setCamera(2);
        }}
      />
    </View>
  );
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHero
        studio
        compact
        subtitle="Design, customize, and prepare your build for your world."
        right={<ModeMenu mode={p.mode} onChange={p.onMode} />}
      />
      <View style={s.body}>
        <GlowCard glow style={{ padding: 10, gap: 8 }}>
          <View style={s.row}>
            <IconButton icon="back" label="Back to catalog" onPress={p.onBack} />
            <View style={{ flex: 1, gap: 3 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rename blueprint"
                onPress={() => setRename(true)}
                style={s.row}
              >
                <Text numberOfLines={1} style={s.title}>
                  {name}
                </Text>
                <Glyph name="edit" size={14} color={c.muted} />
              </Pressable>
              <Text style={s.tag}>Blueprint · Customizable</Text>
            </View>
            <IconButton icon="fit" label="Expand preview" onPress={() => setExpanded(true)} />
          </View>
          <View>
            <StructureArt
              blocks={plan.blocks}
              width={viewport}
              height={200}
              camera={camera}
              zoom={zoom}
              grid={grid}
              cutaway={cutaway}
            />
            {controls}
            <View style={{ position: "absolute", left: 7, top: 8 }}>
              <IconButton
                icon="layers"
                label={cutaway ? "Show full structure" : "Inspect interior"}
                active={cutaway}
                onPress={() => setCutaway(!cutaway)}
              />
            </View>
            <View style={s.previewCaption}>
              <Text style={s.previewLabel}>{cutaway ? "INTERIOR CUTAWAY" : "EXECUTABLE PLAN"}</Text>
              <Text style={s.previewLabel}>{solidCount.toLocaleString()} BLOCKS</Text>
            </View>
          </View>
          <View style={s.row}>
            {[2, 3, 0, 1].map((angle, index) => (
              <Pressable
                key={angle}
                accessibilityRole="button"
                accessibilityLabel={"Camera view " + (index + 1)}
                aria-selected={camera === angle}
                accessibilityState={{ selected: camera === angle }}
                onPress={() => {
                  setCamera(angle);
                  setZoom(1);
                }}
                style={[s.angle, camera === angle && s.selected]}
              >
                <StructureArt
                  blocks={plan.blocks}
                  width={(viewport - 24) / 4 - 2}
                  height={40}
                  camera={angle}
                />
              </Pressable>
            ))}
          </View>
          <View style={s.row}>
            <Text style={[s.small, { flex: 1 }]}>Camera views do not alter your build.</Text>
            <IconButton
              icon="undo"
              label="Undo edit"
              disabled={cursor === 0}
              onPress={() => undo(cursor - 1)}
            />
            <IconButton
              icon="redo"
              label="Redo edit"
              disabled={cursor === history.length - 1}
              onPress={() => undo(cursor + 1)}
            />
            <IconButton icon="refresh" label="Reset blueprint" onPress={() => apply(defaults)} />
          </View>
        </GlowCard>
        <View style={s.panelRow}>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="cube" title="Dimensions" />
            {editable.width ? (
              <Dimension
                label="Width (X)"
                value={options.width}
                min={template.ranges.width[0]}
                max={template.ranges.width[1]}
                onChange={(v) => apply({ ...options, width: v })}
              />
            ) : (
              <Metric label="Width (X) · fixed" value={String(template.bounds.width)} />
            )}
            {editable.depth ? (
              <Dimension
                label="Length (Z)"
                value={options.depth}
                min={template.ranges.depth[0]}
                max={template.ranges.depth[1]}
                onChange={(v) => apply({ ...options, depth: v })}
              />
            ) : (
              <Metric label="Length (Z) · fixed" value={String(template.bounds.depth)} />
            )}
            {editable.floors ? (
              <Dimension
                label="Floors"
                value={options.floors}
                min={template.ranges.floors[0]}
                max={template.ranges.floors[1]}
                onChange={(v) => apply({ ...options, floors: v })}
              />
            ) : (
              <View style={s.metric}>
                <Text style={s.small}>Height (Y)</Text>
                <Text style={s.number}>{plan.bounds.height}</Text>
              </View>
            )}
            <Text style={s.micro}>Height follows the generated structure.</Text>
          </GlowCard>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="rotate" title="Transform" />
            <Text style={s.small}>Rotation</Text>
            <View style={s.segments}>
              {[0, 1, 2, 3].map((value) => (
                <Choice
                  key={value}
                  label={value * 90 + "°"}
                  active={options.rotation === value}
                  onPress={() => apply({ ...options, rotation: value })}
                />
              ))}
            </View>
            <Text style={s.small}>Mirror</Text>
            <View style={s.segments}>
              {([null, "x", "z"] as const).map((value) => (
                <Choice
                  key={String(value)}
                  label={value ? "Flip " + value.toUpperCase() : "None"}
                  active={options.mirror === value}
                  onPress={() => apply({ ...options, mirror: value })}
                />
              ))}
            </View>
          </GlowCard>
        </View>
        <View style={compact ? s.panelStack : s.panelRow}>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="spark" title="Build Style" />
            <View style={s.segments}>
              {STYLES.map((style) => (
                <Choice
                  key={style.id}
                  label={style.name}
                  active={styleId === style.id}
                  disabled={!editable.material && style.id !== "default"}
                  onPress={() =>
                    apply({ ...options, material: style.material || template.defaults.material })
                  }
                >
                  <MaterialCube material={style.material || template.defaults.material} size={25} />
                </Choice>
              ))}
            </View>
            <Text style={s.micro}>
              {editable.material
                ? "Changes the primary building material."
                : "This template has a fixed material palette."}
            </Text>
          </GlowCard>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="pin" title="Placement" />
            <View style={s.segments}>
              <Choice
                label="On Ground"
                active={options.placement === "ground"}
                onPress={() => apply({ ...options, placement: "ground", elevation: 0 })}
              >
                <MaterialCube material="grass_block" size={25} />
              </Choice>
              <Choice label="On Water" disabled onPress={() => {}}>
                <MaterialCube material="water" size={25} />
              </Choice>
              <Choice
                label="Floating"
                active={options.placement === "floating"}
                onPress={() => apply({ ...options, placement: "floating", elevation: 4 })}
              >
                <MaterialCube material="grass_block" size={25} />
              </Choice>
            </View>
            {options.placement === "floating" ? (
              <Dimension
                label="Raise (Y)"
                value={options.elevation}
                min={1}
                max={16}
                onChange={(v) => apply({ ...options, elevation: v })}
              />
            ) : null}
            <Text style={s.micro}>
              {options.placement === "floating"
                ? "Raises all plan cells. No supports are added."
                : "Ground uses the bridge origin. Water placement is unavailable."}
            </Text>
          </GlowCard>
        </View>
        <View style={s.panelRow}>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="doc" title="Build Info" />
            <Metric label="Operations" value={plan.count.toLocaleString()} />
            <Metric label="Solid blocks" value={solidCount.toLocaleString()} />
            <Metric
              label="Bounds X × Z × Y"
              value={plan.bounds.width + " × " + plan.bounds.depth + " × " + plan.bounds.height}
            />
            <Metric label="Footprint" value={plan.bounds.width * plan.bounds.depth + " blocks"} />
          </GlowCard>
          <GlowCard style={[s.half, s.compactCard]}>
            <SectionTitle compact icon="cube" title="Materials" />
            {materials.slice(0, 4).map(([id, count]) => (
              <View key={id} style={s.material}>
                <MaterialCube material={id} size={16} />
                <Text style={[s.micro, { flex: 1 }]} numberOfLines={1}>
                  {labelOf(id)}
                </Text>
                <Text style={s.micro}>{count}</Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setMaterialsOpen(true)}>
              <Text style={s.link}>View all {materials.length} materials ›</Text>
            </Pressable>
          </GlowCard>
        </View>
        <GlowCard>
          <SectionTitle compact icon="shield" title="Validation" />
          <Validation good text="Structure generated and fingerprinted" />
          <Validation text="Terrain and protected blocks are checked by the bridge" />
          <Validation text="Inventory availability has not been checked" />
          {plan.warnings.map((warning: string) => (
            <Validation key={warning} text={warning} />
          ))}
        </GlowCard>
        <GlowCard>
          <SectionTitle compact icon="fingerprint" title="Preview & Approval" />
          <Text style={s.small}>
            {ready
              ? "PC confirmed · " + plan.fingerprint
              : "Prepare this version before approving."}
          </Text>
          <Button
            icon="spark"
            title={busy === "prepare" ? "Preparing…" : ready ? "Prepare Again" : "Prepare Preview"}
            disabled={Boolean(busy)}
            onPress={() => void prepare()}
          />
          {!pcPaired() ? (
            <Pressable accessibilityRole="button" onPress={p.onPc}>
              <Text style={s.link}>Connect your desktop in My PC ›</Text>
            </Pressable>
          ) : null}
        </GlowCard>
        {message ? (
          <GlowCard style={ready ? { borderColor: "#1E8A7C" } : {}}>
            <SectionTitle
              compact
              icon={ready ? "check" : "doc"}
              title={ready ? "Preview Ready" : "Blueprint updated"}
              detail={message}
            />
          </GlowCard>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
        <View style={s.panelRow}>
          <View style={s.half}>
            <Button icon="doc" title="Save Blueprint" secondary onPress={save} />
          </View>
          <View style={s.half}>
            <Button
              icon="fingerprint"
              title={busy === "approve" ? "Sending…" : "Approve Build"}
              disabled={!ready || Boolean(busy)}
              onPress={() => void approve()}
            />
          </View>
        </View>
      </View>
      <Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={s.fullscreen}>
          <View style={[s.row, { padding: 16 }]}>
            <Text style={[s.title, { flex: 1 }]}>{name}</Text>
            <IconButton
              icon="close"
              label="Close expanded preview"
              onPress={() => setExpanded(false)}
            />
          </View>
          <StructureArt
            blocks={plan.blocks}
            width={width}
            height={450}
            camera={camera}
            zoom={zoom}
            grid={grid}
            cutaway={cutaway}
          />
          <View style={[s.row, { padding: 18, justifyContent: "center" }]}>
            <IconButton
              icon="layers"
              label="Toggle expanded interior"
              active={cutaway}
              onPress={() => setCutaway(!cutaway)}
            />
            <IconButton
              icon="rotate"
              label="Orbit expanded camera"
              onPress={() => setCamera((v) => (v + 1) % 4)}
            />
            <IconButton
              icon="zoom"
              label="Zoom expanded preview"
              onPress={() => setZoom((v) => (v >= 1.6 ? 1 : v + 0.2))}
            />
            <IconButton icon="fit" label="Fit expanded preview" onPress={() => setZoom(1)} />
          </View>
          <Note>Rendered from the exact block plan. Not a live world view.</Note>
        </View>
      </Modal>
      <Modal
        visible={rename || materialsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setRename(false);
          setMaterialsOpen(false);
        }}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.row}>
              <Text style={[s.title, { flex: 1 }]}>
                {rename ? "Name your blueprint" : "Materials · " + materials.length + " types"}
              </Text>
              <IconButton
                icon="close"
                label="Close panel"
                onPress={() => {
                  setRename(false);
                  setMaterialsOpen(false);
                }}
              />
            </View>
            {rename ? (
              <>
                <Field
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    persistDraft(options, v);
                  }}
                  accessibilityLabel="Blueprint name"
                  maxLength={80}
                />
                <Button title="Done" disabled={!name.trim()} onPress={() => setRename(false)} />
              </>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {materials.map(([id, count]) => (
                  <View key={id} style={[s.material, { paddingVertical: 8 }]}>
                    <MaterialCube material={id} />
                    <Text style={[s.small, { flex: 1 }]}>{labelOf(id)}</Text>
                    <Text style={s.number}>{count}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
const messageOf = (e: unknown) => (e instanceof Error ? e.message : "The PC is unavailable.");
const labelOf = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function Choice({
  label,
  active = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={active}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.choice, active && s.selected, disabled && { opacity: 0.35 }]}
    >
      {children}
      <Text style={s.choiceText}>{label}</Text>
    </Pressable>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.micro}>{label}</Text>
      <Text style={s.number}>{value}</Text>
    </View>
  );
}
function Validation({ text, good = false }: { text: string; good?: boolean }) {
  return (
    <View style={s.row}>
      <Glyph name={good ? "check" : "warning"} size={15} color={good ? c.success : c.warning} />
      <Text style={[s.micro, { flex: 1 }]}>{text}</Text>
    </View>
  );
}
function Dimension({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  function commit(x: number) {
    onChange(Math.max(min, Math.min(max, Math.round(min + (x / trackWidth) * (max - min)))));
  }
  return (
    <View style={{ gap: 2 }}>
      <View style={s.metric}>
        <Text style={s.small}>{label}</Text>
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Decrease " + label}
            disabled={value <= min}
            onPress={() => onChange(value - 1)}
            hitSlop={5}
          >
            <Text style={[s.step, value <= min && { opacity: 0.3 }]}>−</Text>
          </Pressable>
          <Text style={s.number}>{value}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Increase " + label}
            disabled={value >= max}
            onPress={() => onChange(value + 1)}
            hitSlop={5}
          >
            <Text style={[s.step, value >= max && { opacity: 0.3 }]}>+</Text>
          </Pressable>
        </View>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          onChange(
            Math.max(
              min,
              Math.min(max, value + (e.nativeEvent.actionName === "increment" ? 1 : -1)),
            ),
          )
        }
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => commit(e.nativeEvent.locationX)}
        onResponderMove={(e) => commit(e.nativeEvent.locationX)}
        style={s.trackHit}
      >
        <View pointerEvents="none" style={s.track} />
        <View
          pointerEvents="none"
          style={[s.trackFill, { width: ((value - min) / Math.max(1, max - min)) * trackWidth }]}
        />
        <View
          pointerEvents="none"
          style={[s.knob, { left: ((value - min) / Math.max(1, max - min)) * trackWidth }]}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  compactCard: { padding: 8, gap: 6 },
  page: { paddingBottom: 18 },
  body: { paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { color: c.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  tag: { fontSize: 9, color: "#91C9FF" },
  small: { color: c.muted, fontSize: 10, lineHeight: 14 },
  micro: { color: c.muted, fontSize: 9, lineHeight: 14 },
  number: { color: c.text, fontSize: 10, fontWeight: "600" },
  tools: { position: "absolute", right: 7, top: 8, gap: 5 },
  previewCaption: {
    position: "absolute",
    bottom: 6,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewLabel: { color: "#87ACC5", fontSize: 7, letterSpacing: 1 },
  angle: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 6, overflow: "hidden" },
  selected: { borderColor: c.blue, backgroundColor: "#0A3863", boxShadow: "0 0 7px #00B6FF33" },
  panelRow: { flexDirection: "row", gap: 7 },
  panelStack: { gap: 7 },
  half: { flex: 1, minWidth: 0 },
  segments: { flexDirection: "row", gap: 3 },
  choice: {
    flex: 1,
    minHeight: 33,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  choiceText: { fontSize: 8, color: c.text, textAlign: "center" },
  metric: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4 },
  material: { flexDirection: "row", alignItems: "center", gap: 5 },
  step: { fontSize: 15, color: c.blue, paddingHorizontal: 3 },
  trackHit: { height: 17, justifyContent: "center", marginHorizontal: 5 },
  track: { height: 3, backgroundColor: "#15304E", borderRadius: 2 },
  trackFill: { position: "absolute", height: 3, backgroundColor: c.blue, borderRadius: 2 },
  knob: {
    position: "absolute",
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: "#32B7FF",
  },
  link: { color: c.blue, fontSize: 10, paddingVertical: 3 },
  error: { color: c.danger, fontSize: 12, lineHeight: 18, padding: 8 },
  fullscreen: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 35,
    gap: 15,
  },
});
