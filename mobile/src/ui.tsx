import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme as c } from "./theme";

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  title, onPress, disabled = false, secondary = false, danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
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
      <Text style={[styles.buttonText, secondary && { color: c.text }]}>{title}</Text>
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
      <Text style={styles.note}>Footprint of the validated plan. This is not a photograph of the world.</Text>
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
  button: { backgroundColor: c.blueDeep, borderColor: "#6AABFF", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  secondary: { backgroundColor: c.surfaceAlt },
  danger: { backgroundColor: "#6d2430" },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  input: {
    backgroundColor: "#0c1422",
    borderColor: c.border,
    borderRadius: 12,
    borderWidth: 1,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  multiline: { height: 110, textAlignVertical: "top" },
  note: { color: c.muted, fontSize: 13, lineHeight: 19 },
  status: { alignItems: "center", flexDirection: "row", gap: 8 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  statusText: { color: c.text, fontSize: 14 },
  footRow: { flexDirection: "row", gap: 3, marginBottom: 3 },
  cell: { backgroundColor: c.blue, borderRadius: 2, height: 10, width: 10 },
});
