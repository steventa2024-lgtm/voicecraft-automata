import React, { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { listTemplates } from "../../packages/protocol/src/templates.js";
import {
  GlowCard,
  Glyph,
  HeartIcon,
  HERO,
  ScreenHero,
  SectionTitle,
  useContentWidth,
} from "./chrome";
import { useFavorites } from "./catalog";
import type { CloudHealth, CloudJob, CloudSession } from "./lib/cloud";
import { MaterialCube, TemplateThumbnail } from "./preview";
import { theme as c } from "./theme";
const SHOWCASE = ["lakeside-cottage", "forest-treehouse", "stone-keep", "windmill"];
type Props = {
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
  onConsole: () => void;
  onOpen: (id: string) => void;
};
export function HomeScreen(p: Props) {
  const width = useContentWidth();
  const { favorites, toggle } = useFavorites();
  const templates = useMemo(() => listTemplates(), []);
  const recent = p.job || p.cloud?.recent?.[0];
  const apiGood = p.configured && p.health?.api === "ok";
  return (
    <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
      <ScreenHero
        subtitle={"Turn your ideas into incredible\nMinecraft builds with AI."}
        onBell={p.onBell}
      />
      <View style={s.body}>
        <View style={s.grid}>
          <StatusCard
            width={(width - 34) / 2}
            icon="player"
            title="Minecraft Player"
            value={p.cloud?.link?.playerName || "Not linked"}
            detail={p.cloud?.link ? "Player paired" : "Link your player"}
            good={Boolean(p.cloud?.link)}
            onPress={p.onConsole}
          />
          <StatusCard
            width={(width - 34) / 2}
            icon="cloud"
            title="Cloud API"
            value={apiGood ? "Connected" : p.configured ? "Unavailable" : "Not configured"}
            detail={apiGood ? "API responding" : "Check connection"}
            good={apiGood}
            onPress={p.onConsole}
          />
          <StatusCard
            width={(width - 34) / 2}
            icon="world"
            title="Current World"
            value={p.cloud?.link?.worldName || "No world linked"}
            detail={p.cloud?.link ? "Paired world" : "Pair from Console"}
            good={Boolean(p.cloud?.link)}
            onPress={p.onConsole}
          />
          <StatusCard
            width={(width - 34) / 2}
            icon="doc"
            title="Recent Build"
            value={recent ? recent.status.replaceAll("_", " ") : "Your first build"}
            detail={
              recent
                ? recent.confirmed + " / " + recent.total + " confirmed"
                : "Start in Build Studio"
            }
            good={recent?.status === "completed"}
            onPress={p.onBuild}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Build Studio"
          onPress={p.onBuild}
          style={s.cta}
        >
          <Image
            source={HERO}
            style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["#0A376CF0", "#05234377"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.ctaIcon}>
            <Glyph name="spark" color="#CDEFFF" size={31} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.kicker}>START BUILDING</Text>
            <Text style={s.ctaTitle}>Open Build Studio</Text>
            <Text style={s.meta}>Describe your idea with voice or text</Text>
          </View>
          <View style={s.arrow}>
            <Glyph name="chevron" color="#FFF" size={23} />
          </View>
        </Pressable>
        <SectionTitle
          icon="cube"
          title="Explore Structures"
          detail="Ready-to-build designs from the catalog"
          action="View All"
          onPress={p.onCatalog}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {SHOWCASE.map((id) => {
            const template = templates.find((t: { id: string }) => t.id === id)!;
            return (
              <View key={id} style={s.feature}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Open " + template.name}
                  onPress={() => p.onOpen(id)}
                >
                  <TemplateThumbnail id={id} width={119} height={105} />
                  <Text style={s.featureTitle} numberOfLines={1}>
                    {template.name}
                  </Text>
                </Pressable>
                <View style={s.featureFoot}>
                  <Text style={s.tiny}>{template.estimatedBlocks} ops</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Favorite " + template.name}
                    aria-selected={favorites.includes(id)}
                    accessibilityState={{ selected: favorites.includes(id) }}
                    onPress={() => toggle(id)}
                    hitSlop={7}
                  >
                    <HeartIcon on={favorites.includes(id)} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <GlowCard>
          <SectionTitle icon="bolt" title="Quick Actions" />
          <View style={s.actions}>
            <Action icon="mic" label="Voice Build" onPress={p.onVoice} primary />
            <Action icon="doc" label="Text Prompt" onPress={p.onText} />
            <Action icon="grid" label="Browse Catalog" onPress={p.onCatalog} />
            <Action icon="monitor" label="PC Status" onPress={p.onPc} />
          </View>
        </GlowCard>
        {p.cloud?.entitlement?.message ? (
          <Text style={s.meta}>{p.cloud.entitlement.message}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
function StatusCard({
  width,
  icon,
  title,
  value,
  detail,
  good,
  onPress,
}: {
  width: number;
  icon: string;
  title: string;
  value: string;
  detail: string;
  good: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title + ": " + value}
      onPress={onPress}
      style={{ width }}
    >
      <GlowCard style={s.status}>
        <View style={s.iconWell}>
          {icon === "world" ? (
            <MaterialCube material="grass_block" size={34} />
          ) : (
            <Glyph name={icon} size={29} />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.cardLabel}>{title}</Text>
          <Text style={s.value} numberOfLines={1}>
            {value}
          </Text>
          <Text style={[s.tiny, good && { color: c.success }]} numberOfLines={1}>
            {good ? "● " : ""}
            {detail}
          </Text>
        </View>
        <Glyph name="chevron" size={12} color={c.muted} />
      </GlowCard>
    </Pressable>
  );
}
function Action({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.action, primary && s.actionOn]}
    >
      <Glyph name={icon} size={22} color={primary ? c.blue : c.muted} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  page: { paddingBottom: 18 },
  body: { paddingHorizontal: 12, gap: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, minHeight: 78 },
  iconWell: {
    backgroundColor: "#102B47",
    borderColor: "#3A6087",
    borderWidth: 1,
    borderRadius: 10,
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { color: c.muted, fontSize: 10 },
  value: { color: c.text, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  tiny: { color: c.muted, fontSize: 9, lineHeight: 13 },
  meta: { color: "#A7BFDE", fontSize: 10, lineHeight: 15 },
  cta: {
    borderRadius: 14,
    borderColor: c.blue,
    borderWidth: 1.5,
    overflow: "hidden",
    height: 108,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    boxShadow: "0 0 12px #129BFF26",
  },
  ctaIcon: {
    backgroundColor: "#0757A6",
    borderColor: "#38B6FF",
    borderWidth: 1,
    borderRadius: 12,
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { color: "#93C6FC", fontSize: 8, letterSpacing: 1.6, fontWeight: "700" },
  ctaTitle: { color: c.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  arrow: {
    backgroundColor: "#098BEB",
    borderRadius: 22,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  feature: {
    backgroundColor: "#08172A",
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    width: 121,
  },
  featureTitle: {
    color: c.text,
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  featureFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 6,
  },
  actions: { flexDirection: "row", gap: 6 },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 55,
    borderRadius: 9,
    borderColor: c.border,
    borderWidth: 1,
    padding: 5,
  },
  actionOn: { backgroundColor: "#0A3563", borderColor: c.blue },
  actionText: { fontSize: 9, color: c.text, textAlign: "center" },
});
