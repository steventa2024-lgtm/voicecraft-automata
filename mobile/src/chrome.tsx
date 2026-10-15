import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { StructureArt, defaultBlocks } from "./preview";
import { theme as c } from "./theme";

export type MainTab = "home" | "build" | "console" | "library" | "catalog" | "pc";

const NAV: Array<{ id: MainTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "build", label: "Build" },
  { id: "console", label: "Console" },
  { id: "library", label: "Library" },
  { id: "catalog", label: "Catalog" },
  { id: "pc", label: "My PC" },
];

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="2" y="14" width="3" height="8" rx="1" fill={c.blue} />
      <Rect x="7" y="8" width="3" height="16" rx="1" fill={c.blue} />
      <Rect x="12" y="4" width="3" height="24" rx="1" fill="#7CC0FF" />
      <Rect x="17" y="9" width="3" height="14" rx="1" fill={c.blue} />
      <Rect x="22" y="12" width="3" height="10" rx="1" fill={c.blue} />
      <Rect x="27" y="15" width="3" height="6" rx="1" fill="#7CC0FF" />
    </Svg>
  );
}

function NavIcon({ name, active }: { name: MainTab; active: boolean }) {
  const color = active ? c.blue : "#7E93B0";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24" };
  if (name === "home") return <Svg {...common}><Path d="M4 11 L12 4 L20 11 V20 H4 Z" fill="none" stroke={color} strokeWidth={1.8} /></Svg>;
  if (name === "build") return <Svg {...common}><Path d="M4 8 H14 V20 H4 Z M14 12 H20 V20 H14 Z" fill="none" stroke={color} strokeWidth={1.8} /></Svg>;
  if (name === "console") return <Svg {...common}><Rect x="3" y="7" width="18" height="11" rx="3" fill="none" stroke={color} strokeWidth={1.8} /><Circle cx="8" cy="12.5" r="1.2" fill={color} /><Circle cx="16" cy="12.5" r="1.2" fill={color} /></Svg>;
  if (name === "library") return <Svg {...common}><Path d="M6 4 H16 V20 H6 Z M16 7 H19 V20 H16" fill="none" stroke={color} strokeWidth={1.8} /></Svg>;
  if (name === "catalog") return <Svg {...common}><Rect x="4" y="4" width="6" height="6" rx="1" fill="none" stroke={color} strokeWidth={1.7} /><Rect x="14" y="4" width="6" height="6" rx="1" fill="none" stroke={color} strokeWidth={1.7} /><Rect x="4" y="14" width="6" height="6" rx="1" fill="none" stroke={color} strokeWidth={1.7} /><Rect x="14" y="14" width="6" height="6" rx="1" fill="none" stroke={color} strokeWidth={1.7} /></Svg>;
  return <Svg {...common}><Rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke={color} strokeWidth={1.8} /><Path d="M8 20 H16 M12 16 V20" stroke={color} strokeWidth={1.8} /></Svg>;
}

export function BellIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M6 16 V11 A6 6 0 0 1 18 11 V16 L20 18 H4 Z" fill="none" stroke={c.text} strokeWidth={1.7} />
      <Circle cx="12" cy="20" r="1.3" fill={c.text} />
    </Svg>
  );
}

export function HeartIcon({ on }: { on: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M12 20 L5 13 C2 10 4 5 8 5 C10 5 11 6 12 8 C13 6 14 5 16 5 C20 5 22 10 19 13 Z" fill={on ? c.danger : "none"} stroke={on ? c.danger : c.muted} strokeWidth={1.6} />
    </Svg>
  );
}

export function BottomNav({ tab, onChange }: { tab: MainTab; onChange: (tab: MainTab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {NAV.map((item) => {
        const active = tab === item.id;
        return (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={styles.navItem}>
            <NavIcon name={item.id} active={active} />
            <Text style={[styles.navLabel, active && styles.navOn]}>{item.label}</Text>
            {active ? <View style={styles.navDot} /> : <View style={styles.navDotSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScreenHero({
  subtitle,
  right,
  onBell,
  compact = false,
}: {
  subtitle: string;
  right?: React.ReactNode;
  onBell?: () => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const height = compact ? 156 : 196;
  const blocks = useMemo(() => defaultBlocks("lakeside-cottage"), []);
  return (
    <View style={{ height, width }}>
      <StructureArt blocks={blocks} width={width} height={height} rounded={0} />
      <View style={styles.heroShade} />
      <View style={styles.heroCopy}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <LogoMark />
            <View>
              <Text style={styles.brandName}>Zero<Text style={{ color: c.blue }}>Pulse</Text></Text>
              <Text style={styles.brandSub}>VOICECRAFT</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            {right}
            {onBell ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={onBell} style={styles.bell}>
                <BellIcon />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function GlowCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ModeMenu({ mode, onChange }: { mode: "blueprint" | "voice"; onChange: (mode: "blueprint" | "voice") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.mode}>
        <Text style={styles.modeText}>{mode === "blueprint" ? "Blueprint Mode" : "Voice & Text"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.modeMenu}>
          <Pressable onPress={() => { onChange("blueprint"); setOpen(false); }}><Text style={styles.modeItem}>Blueprint Mode</Text></Pressable>
          <Pressable onPress={() => { onChange("voice"); setOpen(false); }}><Text style={styles.modeItem}>Voice & Text</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: "#07101D",
    borderTopColor: "#16345C",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 8,
  },
  navItem: { alignItems: "center", flex: 1, gap: 3 },
  navLabel: { color: "#7E93B0", fontSize: 10, fontWeight: "700" },
  navOn: { color: c.blue },
  navDot: { backgroundColor: c.blue, borderRadius: 2, height: 3, width: 3 },
  navDotSpacer: { height: 3 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(6,16,28,0.28)" },
  heroCopy: { ...StyleSheet.absoluteFill, justifyContent: "space-between", padding: 16, paddingTop: 12 },
  brandRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  brand: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandName: { color: c.text, fontSize: 22, fontWeight: "800" },
  brandSub: { color: "#B7C7DE", fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  heroRight: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  bell: {
    alignItems: "center",
    backgroundColor: "rgba(8,18,36,0.72)",
    borderColor: "#24558F",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  heroSubtitle: { color: "#D5E2F5", fontSize: 14, lineHeight: 20, maxWidth: 280 },
  card: {
    backgroundColor: c.surface,
    borderColor: "#1B4F8C",
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  mode: {
    backgroundColor: "rgba(8,20,40,0.8)",
    borderColor: c.blue,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeText: { color: c.text, fontSize: 12, fontWeight: "700" },
  modeMenu: {
    backgroundColor: "#0D1B33",
    borderColor: c.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    padding: 8,
    position: "absolute",
    right: 0,
    top: 36,
    width: 150,
    zIndex: 4,
  },
  modeItem: { color: c.text, fontSize: 13, paddingVertical: 6 },
});
