import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme as c } from "./theme";
import { LinearGradient } from "expo-linear-gradient";
import { Glyph } from "./chrome";

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        disabled && styles.disabled,
        pressed && { opacity: 0.75 },
      ]}
    >
      <LinearGradient
        colors={
          secondary
            ? ["#10243C", "#081629"]
            : danger
              ? ["#512738", "#321C2D"]
              : ["#109EFF", "#0560DB"]
        }
        style={styles.buttonInner}
      >
        {icon ? <Glyph name={icon} color={secondary ? c.muted : "#EAF7FF"} size={19} /> : null}
        <Text style={styles.buttonText}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      autoCorrect={false}
      placeholderTextColor={c.muted}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
    />
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function Status({ label, good = false }: { label: string; good?: boolean }) {
  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: good ? c.success : c.warning }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

export function Footprint({ width, depth }: { width: number; depth: number }) {
  const columns = Math.max(1, Math.min(width, 16));
  const rows = Math.max(1, Math.min(depth, 16));
  return (
    <View accessibilityLabel={`Footprint ${width} by ${depth}`}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.footRow}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} style={styles.cell} />
          ))}
        </View>
      ))}
      <Text style={styles.note}>
        Footprint of the validated plan. This is not a photograph of the world.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  button: {
    backgroundColor: c.blueDeep,
    borderColor: "#32B9FF",
    borderRadius: 9,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 44,
  },
  buttonInner: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flex: 1,
  },
  secondary: { borderColor: c.border, backgroundColor: c.surfaceAlt },
  danger: { borderColor: "#78384A" },
  disabled: { opacity: 0.45 },
  buttonText: {
    color: "#F3F6FC",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  input: {
    backgroundColor: "#061323",
    borderColor: c.border,
    borderRadius: 9,
    borderWidth: 1,
    color: c.text,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  multiline: { height: 110, textAlignVertical: "top" },
  note: { color: c.muted, fontSize: 11, lineHeight: 17 },
  status: { alignItems: "center", flexDirection: "row", gap: 8 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  statusText: { color: c.text, fontSize: 14 },
  footRow: { flexDirection: "row", gap: 3, marginBottom: 3 },
  cell: { backgroundColor: c.blue, borderRadius: 2, height: 10, width: 10 },
});
