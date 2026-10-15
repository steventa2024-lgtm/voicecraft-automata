import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { listTemplates } from "../../packages/protocol/src/templates.js";
import { GlowCard, Glyph, HeartIcon, ScreenHero } from "./chrome";
import { useFavorites } from "./catalog";
import type { CloudHealth, CloudJob, CloudSession } from "./lib/cloud";
import { defaultBlocks, StructureArt } from "./preview";
import { theme as c } from "./theme";

const SHOWCASE = ["lakeside-cottage", "forest-treehouse", "stone-keep", "windmill"];

export function HomeScreen({
  cloud,
  health,
  configured,
  job,
  onBell,
  onBuild,
  onVoice,
  onText,
  onCatalog,
  onPc,
  onOpen,
}: {
  cloud: CloudSession | null;
  health: CloudHealth | null;
  configured: boolean;
  job: CloudJob | null;
  onBell: () => void;
  onBuild: () => void;
  onVoice: () => void;
  onText: () => void;
  onCatalog: () => void;
  onPc: () => void;
  onOpen: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  const column = (width - 32 - 10) / 2;
  const { favorites, toggle } = useFavorites();
  const templates = useMemo(() => listTemplates(), []);
  const featured = SHOWCASE.map((id) => templates.find((template: { id: string }) => template.id === id)).filter((template) => template != null);
  const recent = job || cloud?.recent?.[0] || null;
  const apiGood = configured && health?.api === "ok";
  const worldName = cloud?.link?.worldName || "No world";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHero subtitle="Turn your ideas into incredible Minecraft builds with AI." onBell={onBell} />
      <View style={styles.body}>
        <View style={styles.grid}>
          <StatusCard width={column} icon="player" title="Minecraft Player" value={cloud?.link?.playerName || "Not linked"} detail={cloud?.link ? `Linked on ${cloud.link.platform}` : "No player linked"} good={Boolean(cloud?.link)} />
          <StatusCard width={column} icon="cloud" title="Cloud API" value={apiGood ? "Reachable" : configured ? (health ? "Checked" : "Not checked") : "Not configured"} detail={health ? `Minecraft ${health.minecraft}` : "Open Settings to choose a server"} good={apiGood} />
          <StatusCard width={column} icon="world" title="Current World" value={worldName} detail={cloud?.link ? "Linked" : "Pair a player to load a world"} good={Boolean(cloud?.link)} />
          <StatusCard width={column} icon="doc" title="Recent Build" value={recent ? recent.status : "None"} detail={recent ? `${recent.confirmed} confirmed of ${recent.total}` : "No build has been approved"} good={recent?.status === "completed"} />
        </View>
        {cloud?.entitlement?.message ? <Text style={styles.meta}>{cloud.entitlement.message}</Text> : null}
        {cloud?.entitlement?.tasksRemaining != null ? <Text style={styles.meta}>{cloud.entitlement.tasksRemaining} tasks remaining today.</Text> : null}

        <Pressable accessibilityRole="button" onPress={onBuild} style={styles.cta}>
          <View style={styles.ctaArt} pointerEvents="none">
            <StructureArt blocks={defaultBlocks("stone-keep")} width={width - 32} height={124} rounded={20} />
          </View>
          <View style={styles.ctaShade} pointerEvents="none" />
          <View style={styles.ctaCopy}>
            <Glyph name="spark" color="#7CC0FF" size={16} />
            <Text style={styles.kicker}>START BUILDING</Text>
            <Text style={styles.ctaTitle}>Open Build Studio</Text>
            <Text style={styles.meta}>Describe your idea with voice or text</Text>
          </View>
          <View style={styles.arrow}><Text style={styles.arrowText}>›</Text></View>
        </Pressable>

        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.section}>Explore Structures</Text>
            <Text style={styles.meta}>Ready-to-build designs from the catalog</Text>
          </View>
          <Pressable onPress={onCatalog}><Text style={styles.link}>View All ›</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {featured.map((template) => (
            <Pressable key={template.id} style={styles.feature} onPress={() => onOpen(template.id)}>
              <StructureArt blocks={defaultBlocks(template.id)} width={168} height={112} rounded={14} />
              <View style={styles.featureBody}>
                <View style={styles.rowBetween}>
                  <Text style={styles.featureTitle} numberOfLines={2}>{template.name}</Text>
                  <Pressable onPress={() => toggle(template.id)} hitSlop={8}><HeartIcon on={favorites.includes(template.id)} /></Pressable>
                </View>
                <Text style={styles.meta}>{template.estimatedBlocks} blocks</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.rowBetween}>
          <Text style={styles.section}>Quick Actions</Text>
        </View>
        <View style={styles.actions}>
          <Action icon="mic" label="Voice Build" onPress={onVoice} primary />
          <Action icon="prompt" label="Text Prompt" onPress={onText} />
          <Action icon="grid" label="Browse Catalog" onPress={onCatalog} />
          <Action icon="monitor" label="PC Status" onPress={onPc} />
        </View>
      </View>
      <View style={{ height: 8, width }} />
    </ScrollView>
  );
}

function StatusCard({ width, icon, title, value, detail, good }: { width: number; icon: string; title: string; value: string; detail: string; good: boolean }) {
  return (
    <GlowCard style={{ width }}>
      <View style={styles.cardTop}>
        <View style={styles.iconWell}><Glyph name={icon} size={16} /></View>
        <Text style={[styles.meta, styles.cardLabel]} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={styles.statusValue} numberOfLines={2}>{value}</Text>
      <Text style={[styles.meta, good ? styles.good : undefined]} numberOfLines={2}>{good ? "● " : "○ "}{detail}</Text>
    </GlowCard>
  );
}

function Action({ icon, label, onPress, primary = false }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, primary && styles.actionOn]}>
      <Glyph name={icon} size={18} color={primary ? "#7CC0FF" : "#9BB0CC"} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 20 },
  body: { gap: 14, padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardLabel: { flex: 1 },
  iconWell: { alignItems: "center", backgroundColor: "#102844", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  statusValue: { color: c.text, fontSize: 16, fontWeight: "800" },
  good: { color: c.success },
  meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  cta: {
    alignItems: "center",
    backgroundColor: "#0E2244",
    borderColor: "#3B8CFF",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    height: 124,
    overflow: "hidden",
    padding: 16,
  },
  ctaArt: { ...StyleSheet.absoluteFill },
  ctaShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(6,16,32,0.72)" },
  ctaCopy: { flex: 1, gap: 2, zIndex: 1 },
  kicker: { color: c.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  ctaTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  arrow: { alignItems: "center", backgroundColor: c.blueDeep, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  arrowText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  rowBetween: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  section: { color: c.text, fontSize: 18, fontWeight: "800" },
  link: { color: c.blue, fontWeight: "700" },
  feature: { backgroundColor: c.surface, borderColor: "#1B4F8C", borderRadius: 16, borderWidth: 1, overflow: "hidden", width: 168 },
  featureBody: { gap: 4, padding: 10 },
  featureTitle: { color: c.text, flex: 1, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  action: { alignItems: "center", backgroundColor: c.surface, borderColor: "#1B4F8C", borderRadius: 16, borderWidth: 1, flex: 1, gap: 6, justifyContent: "center", minHeight: 78, padding: 8 },
  actionOn: { borderColor: c.blue, backgroundColor: "#12315F" },
  actionText: { color: c.text, fontSize: 11, fontWeight: "800", textAlign: "center" },
});
