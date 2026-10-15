import { generateTemplate } from "../../../packages/protocol/src/templates.js";

// Some legacy builders advertise resize/material options but ignore them.
// Offer only edits that change the executable structure, without changing generators.
export function templateControls(template) {
  const dimension = (option, axis) => {
    const [min, max] = template.ranges[option];
    return (
      min !== max &&
      generateTemplate(template.id, { [option]: min }).bounds[axis] !==
        generateTemplate(template.id, { [option]: max }).bounds[axis]
    );
  };
  return {
    width: dimension("width", "width"),
    depth: dimension("depth", "depth"),
    floors: dimension("floors", "height"),
    material:
      generateTemplate(template.id, { material: "stone_bricks" }).fingerprint !==
      generateTemplate(template.id, { material: "oak_planks" }).fingerprint,
  };
}
