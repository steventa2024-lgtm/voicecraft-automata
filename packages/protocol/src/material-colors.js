// Original procedural material palette: no downloaded Minecraft textures or remote assets.
export const COLORS = {
  oak: "#bb8e51",
  spruce: "#795532",
  dark_oak: "#4d3424",
  birch: "#ddc793",
  stone: "#929ca9",
  cobblestone: "#87939e",
  mossy: "#748568",
  deepslate: "#465161",
  quartz: "#eee6d4",
  glass: "#98d5e9",
  white_concrete: "#dedde0",
  gray_concrete: "#667181",
  sandstone: "#e1ba78",
  bricks: "#b66b51",
  mud: "#9a765b",
  grass: "#79ac42",
  dirt: "#8e6242",
  farmland: "#785137",
  water: "#398dd1",
  sand: "#e9ce92",
  gravel: "#9b9d99",
  leaves: "#4f8f46",
  hay: "#d5ad45",
  calcite: "#e5e4db",
  amethyst: "#ad83db",
  terracotta: "#d9b1a0",
  green: "#5a994e",
  rail: "#a7a6a4",
  chain: "#96a7b5",
  lantern: "#ffd17c",
  glowstone: "#ffce77",
  torch: "#f9c45b",
  red: "#b2444b",
  blue: "#4b76b8",
  yellow: "#e1b53e",
  black: "#343b47",
  blackstone: "#34343d",
  purple: "#8153a4",
  white_wool: "#e7e4db",
  wheat: "#c7ae4b",
  poppy: "#bc4a42",
  dandelion: "#e3c74b",
  snow: "#ecf3f6",
  iron: "#b9c5d0",
  obsidian: "#3a3154",
  crafting: "#aa7b47",
};
export function materialColor(id) {
  if (/^(mossy_)?stone_brick/.test(id)) return id.startsWith("mossy") ? COLORS.mossy : COLORS.stone;
  if (id.startsWith("deepslate")) return COLORS.deepslate;
  const key = Object.keys(COLORS)
    .sort((a, b) => b.length - a.length)
    .find((key) => id.includes(key));
  return COLORS[key] || "#929caa";
}
