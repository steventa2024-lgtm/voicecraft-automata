import { isDestructiveAction } from "./parser.js";

/**
 * Pure dispatcher. Every action has an explicit branch.
 * Preview, inspect, undo, and unknown never select the build executor.
 */
export function decideDispatch(instruction, context = {}) {
  if (!context.authorized) {
    return { branch: "reject", reason: "unauthorized", destructive: false };
  }
  if (!instruction || typeof instruction !== "object") {
    return { branch: "reject", reason: "malformed", destructive: false };
  }
  if (context.chat && context.chat.allowed !== true) {
    return { branch: "reject", reason: "chat_disabled", destructive: isDestructiveAction(instruction.action) };
  }
  if (context.chat?.allowed && isDestructiveAction(instruction.action) && !context.chat.allowDestructive) {
    return {
      branch: "reject",
      reason: "chat_destructive_blocked",
      destructive: true,
    };
  }

  switch (instruction.action) {
    case "preview":
      return { branch: "preview", destructive: false };
    case "inspect":
      return { branch: "inspect", destructive: false };
    case "stop":
      return { branch: "stop", destructive: false };
    case "pause":
      return { branch: "pause", destructive: false };
    case "resume":
      return { branch: "resume", destructive: false };
    case "undo":
      if (!instruction.valid) return { branch: "reject", reason: "invalid", destructive: true };
      if (!instruction.approved) return { branch: "awaiting_approval", destructive: true };
      return { branch: "undo", destructive: true };
    case "redo":
      if (!instruction.valid) return { branch: "reject", reason: "invalid", destructive: true };
      if (!instruction.approved) return { branch: "awaiting_approval", destructive: true };
      return { branch: "redo", destructive: true };
    case "clear":
      if (!instruction.valid) return { branch: "reject", reason: "invalid", destructive: true };
      if (!instruction.approved) return { branch: "awaiting_approval", destructive: true };
      return { branch: "clear", destructive: true };
    case "build":
      if (!instruction.valid || instruction.structure === "unknown") {
        return { branch: "reject", reason: "invalid", destructive: true };
      }
      if (!instruction.approved) return { branch: "awaiting_approval", destructive: true };
      return { branch: "build", destructive: true };
    case "unknown":
    default:
      return { branch: "reject", reason: "unknown_action", destructive: false };
  }
}

export async function executeDispatch(decision, handlers) {
  const branch = decision?.branch;
  const handler = handlers?.[branch];
  if (typeof handler !== "function") {
    if (typeof handlers?.reject === "function") return handlers.reject(decision || { reason: "unhandled" });
    throw new Error(`No handler for ${branch || "empty"} dispatch.`);
  }
  return handler(decision);
}
