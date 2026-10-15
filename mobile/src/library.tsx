import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlowCard, Glyph, HeartIcon, IconButton, ScreenHero, SectionTitle } from "./chrome";
import {
  manageLocalBlueprint,
  readLocalBlueprints,
  subscribeLocal,
} from "./lib/local-blueprints.js";
import type { BlueprintDraft } from "./blueprint";
import type { CloudBlueprint } from "./lib/cloud";
import { generateTemplate } from "../../packages/protocol/src/templates.js";
import { StructureArt } from "./preview";
import { Button, Field, Note } from "./ui";
import { theme as c } from "./theme";
type Props = {
  blueprints: CloudBlueprint[];
  cloudError: string;
  onRefresh: () => void;
  onPreview: (item: CloudBlueprint) => void;
  onFavorite: (item: CloudBlueprint) => void;
  onDuplicate: (item: CloudBlueprint) => void;
  onRename: (item: CloudBlueprint, name: string) => void;
  onDelete: (item: CloudBlueprint) => void;
  onOpenLocal: (item: BlueprintDraft) => void;
  onBell: () => void;
  onCatalog: () => void;
};
export function LibraryScreen(p: Props) {
  const [local, setLocal] = useState(() => readLocalBlueprints()),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"local" | "cloud">("local");
  const [dialog, setDialog] = useState<{
      type: "rename" | "delete";
      id: string;
      cloud?: CloudBlueprint;
    } | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  useEffect(() => subscribeLocal(() => setLocal(readLocalBlueprints())), []);
  function manage(id: string, action: string, value?: string) {
    try {
      manageLocalBlueprint(id, action, value);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    }
  }
  function commit() {
    if (!dialog) return;
    if (dialog.cloud) {
      if (dialog.type === "rename") p.onRename(dialog.cloud, name);
      else p.onDelete(dialog.cloud);
    } else manage(dialog.id, dialog.type, name);
    setDialog(null);
  }
  const localVisible = local.filter((item: { name: string }) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );
  const cloudVisible = p.blueprints.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
      <ScreenHero
        compact
        title="Blueprint Library"
        subtitle="Your ideas, ready when you are."
        onBell={p.onBell}
      />
      <View style={s.body}>
        <View style={s.row}>
          {(["local", "cloud"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              aria-selected={tab === value}
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[s.tab, tab === value && s.active]}
            >
              <Glyph name={value === "local" ? "doc" : "cloud"} size={17} />
              <Text style={s.title}>{value === "local" ? "On this device" : "Cloud library"}</Text>
            </Pressable>
          ))}
        </View>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search saved blueprints"
          accessibilityLabel="Search saved blueprints"
        />
        {tab === "local" ? (
          <>
            <Note>Stored on this device. Local blueprints are not synced to the cloud.</Note>
            {localVisible.map((item: ReturnType<typeof readLocalBlueprints>[number]) => (
              <GlowCard key={item.id}>
                <View style={s.row}>
                  <StructureArt
                    blocks={generateTemplate(item.templateId, item.options).blocks}
                    width={93}
                    height={78}
                  />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.heading}>{item.name}</Text>
                    <Text style={s.caption}>ON THIS DEVICE</Text>
                    <Text style={s.small}>
                      {generateTemplate(item.templateId, item.options).count} operations
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Favorite " + item.name}
                    onPress={() => manage(item.id, "favorite")}
                  >
                    <HeartIcon on={item.favorite} />
                  </Pressable>
                </View>
                <Button
                  title="Open in Blueprint Studio"
                  icon="cube"
                  onPress={() => p.onOpenLocal(item as BlueprintDraft)}
                />
                <View style={s.row}>
                  <SmallAction
                    title="Rename"
                    onPress={() => {
                      setName(item.name);
                      setDialog({ type: "rename", id: item.id });
                    }}
                  />
                  <SmallAction title="Duplicate" onPress={() => manage(item.id, "duplicate")} />
                  <SmallAction
                    title="Delete"
                    onPress={() => setDialog({ type: "delete", id: item.id })}
                  />
                </View>
              </GlowCard>
            ))}
            {!localVisible.length ? (
              <GlowCard>
                <SectionTitle
                  icon="library"
                  title={query ? "No matching blueprints" : "Make room for your next idea"}
                  detail="Open a structure, customize it, and save your blueprint here."
                />
                <Button title="Explore Catalog" icon="grid" onPress={p.onCatalog} />
              </GlowCard>
            ) : null}
          </>
        ) : (
          <>
            <Button title="Refresh cloud library" icon="refresh" secondary onPress={p.onRefresh} />
            {p.cloudError ? <Text style={s.error}>{p.cloudError}</Text> : null}
            {cloudVisible.map((item) => (
              <GlowCard key={item.id}>
                <SectionTitle icon="cloud" title={item.name} detail={item.summary} />
                <Text style={s.caption}>CLOUD · {item.estimatedBlocks} operations</Text>
                <Button title="Prepare cloud preview" onPress={() => p.onPreview(item)} />
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <SmallAction
                    title={item.favorite ? "Unfavorite" : "Favorite"}
                    onPress={() => p.onFavorite(item)}
                  />
                  <SmallAction
                    title="Rename"
                    onPress={() => {
                      setName(item.name);
                      setDialog({ type: "rename", id: item.id, cloud: item });
                    }}
                  />
                  <SmallAction title="Duplicate" onPress={() => p.onDuplicate(item)} />
                  <SmallAction
                    title="Delete"
                    onPress={() => setDialog({ type: "delete", id: item.id, cloud: item })}
                  />
                </View>
              </GlowCard>
            ))}
            {!cloudVisible.length && !p.cloudError ? (
              <Note>No saved cloud blueprints. Save one from a cloud preview in Voice & Text.</Note>
            ) : null}
          </>
        )}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={s.backdrop}>
          <GlowCard style={{ width: "90%", maxWidth: 440 }}>
            <View style={s.row}>
              <Text style={[s.heading, { flex: 1 }]}>
                {dialog?.type === "rename" ? "Rename blueprint" : "Delete this blueprint?"}
              </Text>
              <IconButton icon="close" label="Close dialog" onPress={() => setDialog(null)} />
            </View>
            {dialog?.type === "rename" ? (
              <Field
                value={name}
                onChangeText={setName}
                maxLength={80}
                accessibilityLabel="Saved blueprint name"
              />
            ) : (
              <Note>This removes the saved blueprint. It does not change a Minecraft world.</Note>
            )}
            <Button
              title={dialog?.type === "rename" ? "Save name" : "Delete blueprint"}
              disabled={dialog?.type === "rename" && !name.trim()}
              danger={dialog?.type === "delete"}
              onPress={commit}
            />
            <Button title="Cancel" secondary onPress={() => setDialog(null)} />
          </GlowCard>
        </View>
      </Modal>
    </ScrollView>
  );
}
function SmallAction({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.smallAction}>
      <Text style={s.link}>{title}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  body: { paddingHorizontal: 12, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: { fontSize: 12, fontWeight: "600", color: c.text },
  heading: { fontSize: 16, fontWeight: "700", color: c.text },
  caption: { fontSize: 8, letterSpacing: 1, color: c.blue },
  small: { fontSize: 11, color: c.muted },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  active: { backgroundColor: "#0B3258", borderColor: c.blue },
  smallAction: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 7,
  },
  link: { fontSize: 10, color: c.muted },
  error: { color: c.danger, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "#000A", alignItems: "center", justifyContent: "center" },
});
