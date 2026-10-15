import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { theme as c, MAX_CONTENT_WIDTH } from "./theme";

export type MainTab = "home" | "build" | "console" | "library" | "catalog" | "pc";
export const HERO = require("../assets/night-landscape.png");
export const useContentWidth = () => Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
const NAV: Array<{ id: MainTab; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "house" },
  { id: "build", label: "Build", icon: "cube" },
  { id: "console", label: "Console", icon: "terminal" },
  { id: "library", label: "Library", icon: "library" },
  { id: "catalog", label: "Catalog", icon: "grid" },
  { id: "pc", label: "My PC", icon: "monitor" },
];
const ICONS: Record<string, string> = {
  layers: "m12 2 10 5-10 5L2 7Zm-10 10 10 5 10-5M2 17l10 5 10-5",
  house: "M3 10 12 3 21 10M5 9v12h5v-7h4v7h5V9",
  cube: "m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10",
  terminal: "M4 4h16v16H4zM7 8l4 4-4 4m7 0h3",
  library: "M3 4h4v17H3zM10 3h4v18h-4zm7 2 3-1 3 16-3 1z",
  grid: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  monitor: "M3 3h18v13H3zM8 21h8m-4-5v5",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Zm-3 6v1a6 6 0 0 0 12 0v-1m-6 7v4m-3 0h6",
  doc: "M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h6",
  prompt: "M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h6",
  cloud: "M7 19h10a5 5 0 0 0 1-10 6 6 0 0 0-11-1 5.5 5.5 0 0 0 0 11Z",
  player: "M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 22v-2c0-7 16-7 16 0v2",
  world: "m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z",
  bolt: "m13 2-9 12h7l-1 8 10-13h-8Z",
  castle: "M3 21V5h3v4h3V3h6v6h3V5h3v16Zm7 0v-6h4v6",
  tree: "m12 2 7 9h-4l5 6h-6v5h-4v-5H4l5-6H5Z",
  farm: "M8 21V9h8v12ZM12 9V2m0 7 7-5m-7 5 7 5m-7-5-7 5m7-5L5 4",
  search: "M17 10a7 7 0 1 0-14 0 7 7 0 1 0 14 0Zm-2 5 6 6",
  filter: "M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-6 0v6",
  chevron: "m9 5 7 7-7 7",
  back: "m15 5-7 7 7 7",
  down: "m6 9 6 6 6-6",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Zm-1 9a4 4 0 1 0 8 0 4 4 0 1 0-8 0",
  bell: "M5 17h14l-2-3V9A5 5 0 0 0 7 9v5Zm5 3h4",
  heart: "M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5Z",
  check: "m5 12 4 4L19 6",
  close: "m5 5 14 14M5 19 19 5",
  refresh: "M20 8A9 9 0 0 0 4 6L2 9m0-6v6h6m-4 7a9 9 0 0 0 16 2l2-3m0 6v-6h-6",
  rotate: "M20 8A9 9 0 1 0 21 15M15 8h6V2",
  undo: "M8 4 2 10l6 6M2 10h12a7 7 0 0 1 7 7",
  redo: "m16 4 6 6-6 6m6-6H10a7 7 0 0 0-7 7",
  zoom: "M17 10a7 7 0 1 0-14 0 7 7 0 1 0 14 0Zm-2 5 6 6M7 10h6m-3-3v6",
  fit: "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6",
  sun: "M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  pin: "M12 22S4 13 4 9a8 8 0 0 1 16 0c0 4-8 13-8 13ZM9 9a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  shield: "m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Zm-5 10 3 3 6-6",
  lock: "M5 10h14v12H5Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v3",
  link: "m9 15 6-6M9 7l3-3a5 5 0 0 1 8 8l-3 3M7 9l-3 3a5 5 0 0 0 8 8l3-3",
  copy: "M8 8h13v13H8ZM16 8V3H3v13h5",
  controller:
    "M7 7h10c3 0 4 5 5 10 1 5-5 0-6-1H8c-1 1-7 6-6 1 1-5 2-10 5-10ZM5 11h6m-3-3v6m8-3h.1m2 2h.1",
  wifi: "M2 7c6-6 14-6 20 0M5 11c4-4 10-4 14 0m-11 4c2-2 6-2 8 0m-5 4h2",
  pause: "M7 4v16m10-16v16",
  play: "m6 3 15 9-15 9Z",
  warning: "m12 2 11 19H1Zm0 6v6m0 3v1",
  banned: "M3 3l18 18M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0",
  edit: "m4 15 11-11 5 5L9 20l-6 1Zm8-8 5 5",
  fingerprint: "M3 13c-1-13 19-13 18 0M6 18V11c0-8 12-8 12 0v5m-9 6V11c0-4 6-4 6 0v10m-3-9v8",
  water: "M2 9c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 16c3-4 5 4 8 0s5 4 8 0 4 0 4 0",
};
export function Glyph({
  name,
  color = c.blue,
  size = 20,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={ICONS[name] || ICONS.cube}
        fill="none"
        stroke={color}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 38 40">
      {[14, 25, 36, 27, 16, 8].map((h, i) => (
        <Rect
          key={i}
          x={i * 6 + 1}
          y={(40 - h) / 2}
          width={3.5}
          height={h}
          rx={1.75}
          fill={i === 2 ? "#74D5FF" : c.blue}
        />
      ))}
    </Svg>
  );
}
export function HeartIcon({ on }: { on: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d={ICONS.heart}
        fill={on ? c.blue : "none"}
        stroke={on ? c.blue : c.muted}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={active}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.active,
        disabled && { opacity: 0.35 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Glyph name={icon} color={active ? c.blue : c.muted} />
    </Pressable>
  );
}
export function BottomNav({ tab, onChange }: { tab: MainTab; onChange: (tab: MainTab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 9) }]}>
      {NAV.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          aria-selected={tab === item.id}
          accessibilityState={{ selected: tab === item.id }}
          onPress={() => onChange(item.id)}
          style={[styles.navItem, tab === item.id && styles.navActive]}
        >
          <Glyph name={item.icon} size={23} color={tab === item.id ? c.blue : c.muted} />
          <Text style={[styles.navLabel, tab === item.id && { color: c.blue }]}>{item.label}</Text>
          <View style={[styles.navDot, { opacity: tab === item.id ? 1 : 0 }]} />
        </Pressable>
      ))}
    </View>
  );
}
export function ScreenHero({
  subtitle,
  right,
  onBell,
  compact = false,
  title,
  studio = false,
}: {
  subtitle: string;
  right?: React.ReactNode;
  onBell?: () => void;
  compact?: boolean;
  title?: string;
  studio?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { height: insets.top + (studio ? 92 : compact ? 126 : 150) }]}>
      <Image
        source={HERO}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={["rgba(3,13,27,0)", "rgba(3,13,27,.1)", c.background]}
        locations={[0, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.heroContent, { paddingTop: insets.top + 14 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <LogoMark size={studio ? 30 : 42} />
            <View>
              <Text style={[styles.brandName, studio && { fontSize: 22 }]}>
                Zero<Text style={{ color: c.blue }}>Pulse</Text>
              </Text>
              <Text style={[styles.brandSub, studio && { fontSize: 8 }]}>VOICECRAFT</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            {right}
            {onBell && !studio ? (
              <IconButton icon="settings" label="Settings" onPress={onBell} />
            ) : null}
          </View>
        </View>
        <View style={{ gap: 3 }}>
          {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
          <Text style={[styles.subtitle, studio && { fontSize: 11, maxWidth: 500 }]}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}
export function GlowCard({
  children,
  style,
  glow = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
}) {
  return (
    <LinearGradient
      colors={["#10233B", "#071525"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.card, glow && styles.glow, style]}
    >
      {children}
    </LinearGradient>
  );
}
export function SectionTitle({
  icon,
  title,
  detail,
  action,
  onPress,
  compact = false,
}: {
  icon: string;
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionRow, compact && { gap: 6 }]}>
      <Glyph name={icon} size={compact ? 16 : 25} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.sectionTitle, compact && { fontSize: 11 }]}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.sectionAction}>
          <Text style={styles.link}>{action}</Text>
          <Glyph name="chevron" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
export function StatusPill({ label, good = false }: { label: string; good?: boolean }) {
  return (
    <View
      style={[styles.statusPill, good && { backgroundColor: "#06352D", borderColor: "#14614D" }]}
    >
      <View style={[styles.statusDot, { backgroundColor: good ? c.success : c.muted }]} />
      <Text style={{ color: good ? c.success : c.muted, fontSize: 10, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}
export function ModeMenu({
  mode,
  onChange,
}: {
  mode: "blueprint" | "voice";
  onChange: (mode: "blueprint" | "voice") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ zIndex: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build mode"
        aria-expanded={open}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.mode}
      >
        <Glyph name="cube" size={20} />
        <Text style={styles.modeText}>
          {mode === "blueprint" ? "Blueprint Mode" : "Voice & Text"}
        </Text>
        <Glyph name="down" size={12} />
      </Pressable>
      {open ? (
        <GlowCard style={styles.modeMenu}>
          {(["blueprint", "voice"] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => {
                onChange(item);
                setOpen(false);
              }}
              style={{ paddingVertical: 8 }}
            >
              <Text style={styles.modeText}>
                {item === "blueprint" ? "Blueprint Mode" : "Voice & Text"}
              </Text>
            </Pressable>
          ))}
        </GlowCard>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { zIndex: 10 },
  heroContent: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 18,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { color: c.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  brandSub: { color: "#8EB8E8", fontSize: 10, fontWeight: "800", letterSpacing: 3.1, marginTop: 1 },
  heroRight: { flexDirection: "row", gap: 6 },
  heroTitle: { color: c.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#AAC0DD", fontSize: 12, lineHeight: 17, maxWidth: 255 },
  nav: {
    backgroundColor: "#061323",
    borderTopColor: "#294765",
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    paddingHorizontal: 5,
    paddingTop: 7,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    paddingTop: 4,
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
  },
  navActive: { backgroundColor: "#092747", borderColor: "#1764A3" },
  navLabel: { color: c.muted, fontSize: 10, fontWeight: "500" },
  navDot: { backgroundColor: c.blue, width: 3, height: 3, borderRadius: 2, marginBottom: 3 },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#091B2FCC",
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 9,
  },
  active: { borderColor: c.blue, backgroundColor: "#0D345C" },
  card: {
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    gap: 9,
    overflow: "hidden",
  },
  glow: { borderColor: "#258FD2", boxShadow: "0 0 10px #078EF522" },
  sectionRow: { flexDirection: "row", gap: 9, alignItems: "center" },
  sectionTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  detail: { color: c.muted, fontSize: 11, lineHeight: 15 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 32 },
  link: { fontSize: 11, color: c.blue, fontWeight: "600" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 20,
  },
  statusDot: { height: 5, width: 5, borderRadius: 3 },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#2168A5",
    borderRadius: 8,
    backgroundColor: "#081D36",
    padding: 9,
  },
  modeText: { color: c.text, fontSize: 10, fontWeight: "600" },
  modeMenu: { position: "absolute", right: 0, top: 44, width: 170, zIndex: 30 },
});
