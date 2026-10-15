import React, { useId, useMemo } from "react";
import { Image, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { generateTemplate } from "../../packages/protocol/src/templates.js";
import { voxelScene, materialColor } from "./lib/voxel-scene.js";
import { thumbnails } from "./thumbnails";
export type Block = { x: number; y: number; z: number; block: string };
const cache = new Map<string, Block[]>();
export function defaultBlocks(id: string) {
  if (!cache.has(id)) cache.set(id, generateTemplate(id).blocks);
  return cache.get(id)!;
}
export function TemplateThumbnail({
  id,
  width,
  height,
}: {
  id: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      accessibilityLabel="Preview of the executable block plan"
      source={thumbnails[id]}
      resizeMode="cover"
      style={{ width, height }}
    />
  );
}
export const StructureArt = React.memo(function StructureArt({
  blocks,
  width,
  height,
  rounded = 10,
  camera = 2,
  zoom = 1,
  grid = true,
}: {
  blocks: Block[];
  width: number;
  height: number;
  rounded?: number;
  camera?: number;
  zoom?: number;
  grid?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scene = useMemo(
    () => voxelScene(blocks, width, height, camera, zoom),
    [blocks, width, height, camera, zoom],
  );
  return (
    <View
      accessibilityLabel={"Plan preview: " + scene.visibleBlocks + " solid blocks"}
      style={{
        width,
        height,
        borderRadius: rounded,
        overflow: "hidden",
        backgroundColor: "#071426",
      }}
    >
      <Svg width={width} height={height} viewBox={"0 0 " + width + " " + height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="55%" rx="75%" ry="65%">
            <Stop offset="0" stopColor="#214c69" />
            <Stop offset="1" stopColor="#071426" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill={"url(#" + id + ")"} />
        <Path d={scene.ground} fill="#102d36" stroke="#285169" strokeWidth={0.7} />
        {grid ? <Path d={scene.grid} fill="none" stroke="#315061" strokeWidth={0.5} /> : null}
        {scene.paths.map((p: { d: string; color: string }, i: number) => (
          <Path key={i} d={p.d} fill={p.color} />
        ))}
      </Svg>
    </View>
  );
});
export function MaterialCube({ material, size = 28 }: { material: string; size?: number }) {
  const color = materialColor(material);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 36">
      <Path d="M16 1 30 9 16 17 2 9Z" fill={color} />
      <Path d="M2 9 16 17v17L2 26Z" fill={color} />
      <Path d="m16 17 14-8v17l-14 8Z" fill={color} />
      <Path d="m16 17 14-8v17l-14 8Z" fill="#000" opacity={0.25} />
      <Path d="M16 1 30 9 16 17 2 9Z" fill="#fff" opacity={0.15} />
      <Path
        d="m2 14 14 8 14-8M2 20l14 8 14-8M9 13v6m14-6v6M9 25v5m14-5v5M9 5l14 8M9 13l14-8"
        fill="none"
        stroke="#000"
        strokeWidth={0.5}
        opacity={0.28}
      />
    </Svg>
  );
}
