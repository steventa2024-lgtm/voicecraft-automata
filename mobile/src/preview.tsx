import React, { useId, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { generateTemplate, isometricPreview } from "../../packages/protocol/src/templates.js";

type Block = { x: number; y: number; z: number; block: string };
type Face = { points: Array<{ x: number; y: number }>; color: string; depth: number };

const thumbCache = new Map<string, Block[]>();

export function defaultBlocks(id: string) {
  const cached = thumbCache.get(id);
  if (cached) return cached;
  const blocks = generateTemplate(id).blocks as Block[];
  thumbCache.set(id, blocks);
  return blocks;
}

const STARS = [
  [0.14, 0.16],
  [0.28, 0.08],
  [0.46, 0.18],
  [0.63, 0.07],
  [0.82, 0.2],
  [0.9, 0.1],
];

function batches(faces: Face[]) {
  const groups: Array<{ color: string; d: string }> = [];
  for (const face of faces) {
    const command = face.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") + " Z";
    const last = groups[groups.length - 1];
    if (last && last.color === face.color) last.d += ` ${command}`;
    else groups.push({ color: face.color, d: command });
  }
  return groups;
}

export const StructureArt = React.memo(function StructureArt({
  blocks,
  width,
  height,
  rounded = 18,
}: {
  blocks: Block[];
  width: number;
  height: number;
  rounded?: number;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const preview = useMemo(() => isometricPreview(blocks, Math.max(1, width), Math.max(1, height)) as { width: number; height: number; faces: Face[] }, [blocks, width, height]);
  const drawn = useMemo(() => batches(preview.faces), [preview]);
  return (
    <View style={{ width, height, borderRadius: rounded, overflow: "hidden", backgroundColor: "#07111f" }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#07111f" />
            <Stop offset="0.42" stopColor="#12315f" />
            <Stop offset="0.78" stopColor="#1c4d62" />
            <Stop offset="1" stopColor="#10281c" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${gradientId})`} />
        {STARS.map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={width * x} cy={height * y} r={1.2} fill="#d5e6ff" opacity={0.8} />
        ))}
        <Circle cx={width * 0.78} cy={height * 0.16} r={Math.max(6, Math.min(width, height) * 0.055)} fill="#e7f1ff" />
        <Ellipse cx={width / 2} cy={height * 0.9} rx={width * 0.36} ry={Math.max(6, height * 0.07)} fill="#07140e" opacity={0.72} />
        {drawn.map((group, index) => (
          <Path key={`${group.color}-${index}`} d={group.d} fill={group.color} stroke="rgba(5,10,18,0.35)" strokeWidth={0.45} />
        ))}
      </Svg>
    </View>
  );
});
