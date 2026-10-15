import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import "expo-sqlite/localStorage/install";
import { listTemplates } from "../../packages/protocol/src/templates.js";
import { Glyph, HeartIcon, IconButton, ScreenHero, useContentWidth } from "./chrome";
import { readFavorites, subscribeLocal, toggleFavorite } from "./lib/local-blueprints.js";
import { TemplateThumbnail } from "./preview";
import { Button, Field } from "./ui";
import { theme as c } from "./theme";
export { BlueprintScreen } from "./blueprint";
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  useEffect(() => subscribeLocal(() => setFavorites(readFavorites())), []);
  return { favorites, toggle: (id: string) => toggleFavorite(id) };
}
const GROUPS = [
  { id: "All", icon: "house", categories: [] },
  { id: "Houses", icon: "castle", categories: ["Homes & Cabins", "Modern & Luxury"] },
  { id: "Castles", icon: "castle", categories: ["Medieval & Fortified"] },
  { id: "Nature", icon: "tree", categories: ["Farms & Nature", "Fantasy & Magic"] },
  { id: "Farms", icon: "farm", categories: ["Farms & Nature"] },
];
export function CatalogScreen({
  onOpen,
  onBell,
}: {
  onOpen: (id: string) => void;
  onBell: () => void;
}) {
  const width = useContentWidth(),
    tile = (width - 34) / 2;
  const templates = useMemo(() => listTemplates(), []);
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("All"),
    [category, setCategory] = useState<string | null>(null),
    [filters, setFilters] = useState(false),
    [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favorites, toggle } = useFavorites();
  const visible = templates.filter(
    (t: { id: string; name: string; category: string; tags: string[] }) => {
      const selected = GROUPS.find((g) => g.id === group)!;
      return (
        (!category || t.category === category) &&
        (!onlyFavorites || favorites.includes(t.id)) &&
        (category || !selected.categories.length || selected.categories.includes(t.category)) &&
        (t.name + " " + t.category + " " + t.tags.join(" "))
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    },
  );
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        initialNumToRender={8}
        windowSize={5}
        columnWrapperStyle={s.columns}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ScreenHero compact subtitle="Browse 50 ready-to-build structures" onBell={onBell} />
            <View style={s.filters}>
              <View style={s.searchRow}>
                <View style={s.search}>
                  <Glyph name="search" size={19} color={c.muted} />
                  <Field
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search structures, e.g. castle, house, farm…"
                    accessibilityLabel="Search structures"
                    style={s.searchInput}
                  />
                </View>
                <IconButton
                  icon="filter"
                  label="Filter categories"
                  onPress={() => setFilters(true)}
                  active={Boolean(category || onlyFavorites)}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7 }}
              >
                {GROUPS.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    aria-selected={group === item.id && !category}
                    accessibilityState={{ selected: group === item.id && !category }}
                    onPress={() => {
                      setGroup(item.id);
                      setCategory(null);
                    }}
                    style={[s.pill, group === item.id && !category && s.pillOn]}
                  >
                    <Glyph
                      name={item.icon}
                      size={16}
                      color={group === item.id ? c.blue : c.muted}
                    />
                    <Text style={s.pillText}>{item.id}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {query || category || onlyFavorites ? (
                <Text style={s.caption}>
                  {visible.length} results{category ? " · " + category : ""}
                  {onlyFavorites ? " · Favorites" : ""}
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.tile, { width: tile }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Open " + item.name}
              onPress={() => onOpen(item.id)}
            >
              <TemplateThumbnail id={item.id} width={tile - 2} height={tile * 0.72} />
              <View style={s.tileBody}>
                <Text style={s.title} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={s.metaRow}>
                  <Glyph name="cube" color={c.muted} size={12} />
                  <Text style={s.caption}>{item.estimatedBlocks.toLocaleString()} operations</Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Favorite " + item.name}
              aria-selected={favorites.includes(item.id)}
              accessibilityState={{ selected: favorites.includes(item.id) }}
              onPress={() => toggle(item.id)}
              style={s.heart}
            >
              <HeartIcon on={favorites.includes(item.id)} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 28, gap: 16 }}>
            <Text style={s.title}>No matching structures</Text>
            <Text style={s.caption}>Try another search or clear your filters.</Text>
            <Button
              title="Clear filters"
              secondary
              onPress={() => {
                setQuery("");
                setCategory(null);
                setOnlyFavorites(false);
                setGroup("All");
              }}
            />
          </View>
        }
      />
      <Modal
        visible={filters}
        transparent
        animationType="slide"
        onRequestClose={() => setFilters(false)}
      >
        <View style={s.backdrop}>
          <Pressable
            accessibilityLabel="Close filters"
            style={StyleSheet.absoluteFill}
            onPress={() => setFilters(false)}
          />
          <View style={s.sheet}>
            <View style={s.searchRow}>
              <Text style={[s.title, { flex: 1 }]}>Filter structures</Text>
              <IconButton icon="close" label="Close filters" onPress={() => setFilters(false)} />
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <Button
                title={onlyFavorites ? "✓ Favorites only" : "Favorites only"}
                secondary={!onlyFavorites}
                onPress={() => setOnlyFavorites(!onlyFavorites)}
              />
              {[...new Set(templates.map((t: { category: string }) => t.category))].map((item) => (
                <Pressable
                  key={String(item)}
                  onPress={() => {
                    setCategory(String(item));
                    setFilters(false);
                  }}
                  style={s.category}
                >
                  <Text style={s.pillText}>{String(item)}</Text>
                  {category === item ? <Glyph name="check" size={17} /> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Button
              title="Show all structures"
              secondary
              onPress={() => {
                setCategory(null);
                setOnlyFavorites(false);
                setGroup("All");
                setFilters(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  list: { paddingBottom: 20, gap: 10 },
  columns: { paddingHorizontal: 12, gap: 10 },
  filters: { paddingHorizontal: 12, gap: 11, paddingBottom: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 11,
    backgroundColor: "#061527",
  },
  searchInput: {
    borderWidth: 0,
    flex: 1,
    fontSize: 11,
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    borderColor: c.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  pillOn: { borderColor: c.blue, backgroundColor: "#0A3970", boxShadow: "0 0 8px #029BFF33" },
  pillText: { color: c.muted, fontSize: 11 },
  tile: {
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#061629",
  },
  tileBody: { padding: 9, paddingRight: 28, gap: 5, minHeight: 58 },
  title: { color: c.text, fontSize: 12, fontWeight: "600" },
  caption: { color: c.muted, fontSize: 10, lineHeight: 15 },
  metaRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  heart: { position: "absolute", right: 7, bottom: 10, padding: 2 },
  backdrop: { flex: 1, backgroundColor: "#0009", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    gap: 14,
  },
  category: { paddingVertical: 13, flexDirection: "row", justifyContent: "space-between" },
});
