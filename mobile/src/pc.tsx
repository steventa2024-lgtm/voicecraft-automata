import React, { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { GlowCard, Glyph, IconButton, ScreenHero, SectionTitle, StatusPill } from "./chrome";
import {
  controlPc,
  disconnectPc,
  pairPc,
  pcPaired,
  pcStatus,
  savedPcHost,
  type PcStatus,
} from "./lib/companion";
import { createStatusMonitor, pcActionEnabled } from "./lib/status-monitor.js";
import { MaterialCube } from "./preview";
import { theme as c } from "./theme";
import { Button, Field, Note } from "./ui";
type ConnectionState = {
  data: PcStatus | null;
  error: string;
  checking: boolean;
  lastSuccess: number | null;
};
export function PcScreen({
  onBell,
  onPrepare,
  onApprove,
}: {
  onBell: () => void;
  onPrepare: () => void;
  onApprove: () => void;
}) {
  const [host, setHost] = useState(savedPcHost()),
    [code, setCode] = useState(""),
    [paired, setPaired] = useState(pcPaired()),
    [pairVersion, setPairVersion] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>({
    data: null,
    error: "",
    checking: false,
    lastSuccess: null,
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [connectionOpen, setConnectionOpen] = useState(!pcPaired());
  const monitor = useMemo(
    () =>
      createStatusMonitor(
        () => pcStatus(savedPcHost()),
        (patch: Partial<ConnectionState>) => setConnection((current) => ({ ...current, ...patch })),
      ),
    [pairVersion],
  );
  useEffect(() => {
    monitor.clear();
    if (!paired) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    function start() {
      void monitor.refresh();
      timer = setInterval(() => void monitor.refresh(), 10000);
    }
    start();
    const sub = AppState.addEventListener("change", (state) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (state === "active") start();
      else monitor.clear();
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
      monitor.dispose();
    };
  }, [paired, monitor]);
  const status = connection.data,
    online = Boolean(paired && status),
    job = status?.activeJob;
  const progress =
    typeof job?.progress === "number" && Number.isFinite(job.progress)
      ? Math.max(0, Math.min(100, Math.round(job.progress)))
      : null;
  async function pair() {
    if (busy) return;
    setBusy(true);
    setError("");
    monitor.clear();
    try {
      await pairPc(host, code.trim().toUpperCase());
      setPaired(true);
      setPairVersion((v) => v + 1);
      setCode("");
      setConnectionOpen(false);
      setMessage("Paired with this PC. The pairing code has been consumed.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function control(action: "pause" | "resume" | "cancel" | "undo") {
    if (busy || !pcActionEnabled(action, status)) return;
    setBusy(true);
    setError("");
    try {
      await controlPc(savedPcHost(), action);
      setMessage(
        action.charAt(0).toUpperCase() +
          action.slice(1) +
          " requested. Status updates from your PC.",
      );
      await monitor.refresh();
    } catch (e) {
      monitor.clear();
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const actions = [
    {
      label: "Prepare",
      hint: "Open blueprint",
      icon: "play",
      color: c.blue,
      disabled: false,
      onPress: onPrepare,
    },
    {
      label: "Approve",
      hint: "Review plan",
      icon: "check",
      color: c.success,
      disabled: false,
      onPress: onApprove,
    },
    ...(["pause", "resume", "cancel", "undo"] as const).map((action) => ({
      label: action.charAt(0).toUpperCase() + action.slice(1),
      hint: { pause: "Hold job", resume: "Continue", cancel: "Stop job", undo: "Revert last" }[
        action
      ],
      icon: { pause: "pause", resume: "play", cancel: "close", undo: "undo" }[action],
      color: { pause: c.warning, resume: c.blue, cancel: c.danger, undo: "#AC85FF" }[action],
      disabled: busy || !pcActionEnabled(action, status),
      onPress: () => void control(action),
    })),
  ];
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHero
        title="My PC"
        subtitle={"Your secure VoiceCraft companion\nfor desktop Minecraft builds."}
        onBell={onBell}
      />
      <View style={s.body}>
        <GlowCard glow>
          <View style={s.row}>
            <View style={s.computer}>
              <Glyph name="monitor" size={76} />
              <View style={s.screenCube}>
                <MaterialCube material="grass_block" size={29} />
              </View>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <View style={s.rowBetween}>
                <Text style={s.title} numberOfLines={1}>
                  {status?.name || (paired ? "Paired desktop" : "Connect your PC")}
                </Text>
                <StatusPill
                  label={online ? "Online" : connection.checking ? "Checking" : "Offline"}
                  good={online}
                />
              </View>
              <Text style={s.small}>
                {paired ? savedPcHost() + " · Local" : "Private network companion"}
              </Text>
              <Text style={[s.small, online && { color: c.success }]}>
                {online
                  ? "● Paired and online"
                  : paired
                    ? "Connection not confirmed"
                    : "No PC paired yet"}
              </Text>
              <View style={s.row}>
                <Glyph name="cube" size={13} color={c.muted} />
                <Text style={s.small}>
                  Bridge {status ? (status.bridgeRunning ? "running" : "stopped") : "not checked"}
                </Text>
              </View>
              <View style={s.row}>
                <Glyph name="monitor" size={13} color={c.muted} />
                <Text style={s.small}>App {status?.version || "—"}</Text>
              </View>
            </View>
          </View>
          <View style={s.rowBetween}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConnectionOpen(!connectionOpen)}
            >
              <Text style={s.link}>
                {connectionOpen ? "Hide connection" : "Manage connection"} ›
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !paired || connection.checking }}
              disabled={!paired || connection.checking}
              onPress={() => void monitor.refresh()}
            >
              <Text style={[s.link, !paired && { opacity: 0.4 }]}>
                {connection.checking ? "Checking…" : "Refresh"}
              </Text>
            </Pressable>
          </View>
        </GlowCard>
        {connection.error ? (
          <Text accessibilityRole="alert" style={s.error}>
            PC unavailable. {connection.error}
            {connection.lastSuccess
              ? " Last response " + new Date(connection.lastSuccess).toLocaleTimeString() + "."
              : ""}
          </Text>
        ) : null}
        {connectionOpen ? (
          <GlowCard>
            <SectionTitle
              icon="link"
              title="Pair with your desktop"
              detail="Open Companion on your PC to create a one-time code."
            />
            <Field
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              placeholder="192.168.1.42"
              accessibilityLabel="PC address"
            />
            <Field
              value={code}
              onChangeText={setCode}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="8-character pairing code"
              accessibilityLabel="PC pairing code"
            />
            <Button
              title={busy ? "Pairing…" : "Pair with code"}
              disabled={busy || !host.trim() || code.trim().length !== 8}
              onPress={() => void pair()}
            />
            <Note>LAN HTTP is not encrypted. Pair only on a trusted private network.</Note>
            {paired ? (
              <Button
                title="Forget this PC"
                secondary
                onPress={() => {
                  monitor.clear();
                  disconnectPc();
                  setPaired(false);
                  setMessage("Pairing forgotten here. Revoke this device on the PC too.");
                }}
              />
            ) : null}
          </GlowCard>
        ) : null}
        <GlowCard>
          <View style={s.row}>
            <Glyph name="cloud" size={36} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.heading}>Remote Builds</Text>
              <Text style={s.small}>Let VoiceCraft prepare and build structures on your PC.</Text>
            </View>
            <Switch
              accessibilityLabel="Remote builds permission set on desktop"
              value={Boolean(status?.permissions.build)}
              disabled
              trackColor={{ false: "#253C57", true: "#087FE8" }}
              thumbColor="#DDEEFF"
            />
          </View>
          <Text style={s.permission}>
            {status?.permissions.build
              ? "Enabled on your PC"
              : "Enable in the desktop Companion panel"}
          </Text>
          <View style={s.row}>
            <Security
              icon="lock"
              title={status?.encrypted ? "Encrypted link" : "Private network"}
              detail={status?.encrypted ? "PC reported" : "HTTP · not encrypted"}
            />
            <Security icon="shield" title="Build-only access" detail="No system control" />
            <Security icon="filter" title="Limited permissions" detail="PC controlled" />
          </View>
        </GlowCard>
        <GlowCard>
          <SectionTitle
            icon="doc"
            title="Current Job"
            detail={
              job?.status
                ? job.status.replaceAll("_", " ")
                : online
                  ? "Ready for your next blueprint"
                  : "Connect to see live build status"
            }
          />
          <View style={s.steps}>
            {["Queued", "Building", "Finishing"].map((step, i) => (
              <View key={step} style={s.jobStep}>
                <View style={s.stepIcon}>
                  <Glyph
                    name={i === 0 ? "doc" : i === 1 ? "cube" : "spark"}
                    size={17}
                    color={job ? c.blue : "#526A89"}
                  />
                </View>
                <Text style={s.small}>{step}</Text>
              </View>
            ))}
          </View>
          <View style={s.row}>
            <View style={s.rail}>
              <View style={[s.fill, { width: ((progress ?? 0) + "%") as `${number}%` }]} />
            </View>
            <Text style={s.small}>{progress === null ? "—" : progress + "%"}</Text>
          </View>
          <Text style={s.micro}>
            {job?.count != null
              ? job.count + " planned operations"
              : "No progress reported by the PC."}
          </Text>
        </GlowCard>
        <GlowCard>
          <View style={s.row}>
            <Glyph name="banned" size={25} color={c.danger} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.title}>Build access. You stay in control.</Text>
              <Text style={s.small}>
                Shell access and screen sharing are unavailable. Your phone can only request
                supported build actions.
              </Text>
            </View>
          </View>
        </GlowCard>
        <GlowCard>
          <SectionTitle
            icon="bolt"
            title="Quick Actions"
            detail="Control the current build job on your PC."
          />
          <View style={s.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label + " on PC"}
                accessibilityState={{ disabled: action.disabled }}
                disabled={action.disabled}
                onPress={action.onPress}
                style={[
                  s.action,
                  { borderColor: action.color + "77" },
                  action.disabled && { opacity: 0.3 },
                ]}
              >
                <Glyph name={action.icon} color={action.color} size={23} />
                <Text style={s.actionTitle}>{action.label}</Text>
                <Text style={s.micro}>{action.hint}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.micro}>
            Prepare and Approve open your blueprint. Execution still requires a matching PC preview.
          </Text>
        </GlowCard>
        {message ? <Note>{message}</Note> : null}
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "The PC did not accept that request.";
function Security({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <View style={s.security}>
      <Glyph name={icon} size={19} />
      <Text style={s.securityTitle}>{title}</Text>
      <Text style={s.micro}>{detail}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { paddingBottom: 18 },
  body: { paddingHorizontal: 12, gap: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
  },
  computer: {
    height: 91,
    width: 91,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#061E38",
    borderRadius: 12,
  },
  screenCube: { position: "absolute", top: 21, left: 32 },
  title: { color: c.text, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  heading: { color: c.text, fontSize: 18, fontWeight: "700" },
  small: { color: c.muted, fontSize: 10, lineHeight: 15 },
  micro: { color: c.muted, fontSize: 8, lineHeight: 13 },
  link: { color: c.blue, fontSize: 11, paddingVertical: 5 },
  permission: { fontSize: 9, color: c.muted, textAlign: "right" },
  security: {
    flex: 1,
    backgroundColor: "#051629",
    borderColor: "#172F48",
    borderWidth: 1,
    borderRadius: 8,
    padding: 7,
    gap: 4,
  },
  securityTitle: { color: c.text, fontSize: 8 },
  steps: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 },
  jobStep: { alignItems: "center", gap: 6 },
  stepIcon: {
    height: 28,
    width: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rail: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: "#152C49" },
  fill: { height: 7, backgroundColor: c.blue },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  action: {
    minWidth: "30%",
    flex: 1,
    alignItems: "center",
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderRadius: 9,
    backgroundColor: "#0A2038",
  },
  actionTitle: { color: c.text, fontSize: 10 },
  error: { color: c.danger, fontSize: 11, lineHeight: 16, padding: 7 },
});
