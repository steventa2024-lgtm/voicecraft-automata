import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { GlowCard, ScreenHero } from "./chrome";
import { controlPc, disconnectPc, pairPc, pcPaired, pcStatus, savedPcHost, type PcStatus } from "./lib/companion";
import { theme as c } from "./theme";
import { Button, Field, Note } from "./ui";

export function PcScreen({ onBell }: { onBell: () => void }) {
  const [host, setHost] = useState(savedPcHost());
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<PcStatus | null>(null);
  const [paired, setPaired] = useState(pcPaired());
  const [message, setMessage] = useState("");
  const job = status?.activeJob || null;
  const progress = typeof job?.progress === "number" ? Math.round(job.progress * 100) : null;
  const online = Boolean(paired && status);

  async function refresh() {
    const next = await pcStatus(host);
    setStatus(next);
    setPaired(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <ScreenHero compact subtitle="Your secure VoiceCraft companion for desktop Minecraft builds." onBell={onBell} />
      <View style={styles.body}>
        <Text style={styles.title}>My PC</Text>
        <GlowCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.section}>{status?.name || "No PC paired"}</Text>
              <Text style={styles.meta}>{host ? `${host} (Local)` : "Enter the PC address below"}</Text>
              <Text style={online ? styles.good : styles.meta}>{online ? "Paired and online" : paired ? "Paired, status not loaded" : "Not paired"}</Text>
              <Text style={styles.meta}>Bridge {status ? (status.bridgeRunning ? "running" : "not running") : "not checked"}</Text>
              <Text style={styles.meta}>App {status?.version || "—"}</Text>
            </View>
            <Text style={online ? styles.badgeOn : styles.badge}>{online ? "Online" : "Offline"}</Text>
          </View>
          <Note>{status?.transport || "Pair from the desktop Companion panel. This link is private-network HTTP and is not encrypted."}</Note>
        </GlowCard>

        <GlowCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.section}>Remote Builds</Text>
              <Text style={styles.meta}>The phone cannot turn this on. Enable it in the desktop Companion panel.</Text>
            </View>
            <Switch
              value={Boolean(status?.permissions.build)}
              onValueChange={() => Alert.alert("Desktop setting", "Remote builds stay off until you enable them on the VoiceCraft desktop. This phone cannot change that permission.")}
              trackColor={{ false: "#1C304C", true: "#1C6FE3" }}
              thumbColor="#F4F8FF"
            />
          </View>
          <Text style={styles.meta}>{status?.permissions.build ? "Allowed on the PC" : "Off until enabled on the PC"}</Text>
          <View style={styles.badges}>
            <Badge title="Private network" detail={status?.encrypted ? "The PC reported encryption" : "Not encrypted"} />
            <Badge title="Build-only access" detail="No system control" />
            <Badge title="Limited permissions" detail="Screen sharing is off" />
          </View>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Current Job</Text>
          <Text style={styles.meta}>{job?.status || "No build is running"}</Text>
          <View style={styles.rail}>
            <View style={[styles.railFill, { width: `${progress ?? 0}%` }]} />
          </View>
          <Text style={styles.meta}>{progress == null ? "Progress appears when the PC reports it." : `${progress}% reported by the PC`}</Text>
          {typeof job?.count === "number" ? <Text style={styles.meta}>{job.count} planned operations</Text> : null}
        </GlowCard>

        <GlowCard>
          <Text style={styles.warnTitle}>Shell access and screen sharing are not available.</Text>
          <Text style={styles.meta}>{status?.remoteDesktopReason || "VoiceCraft can prepare and build structures. It does not control the desktop, the terminal, or a live screen."}</Text>
        </GlowCard>

        <Text style={styles.section}>Quick Actions</Text>
        <View style={styles.actions}>
          <Action label="Prepare" hint="Use Catalog" onPress={() => Alert.alert("Prepare in Blueprint", "Open a structure from the catalog, then tap Prepare Preview. This screen does not invent a build.")} />
          <Action label="Approve" hint="Needs a preview" onPress={() => Alert.alert("Approve in Blueprint", "Approval happens on the blueprint after the PC preview matches. It is not sent from this button.")} />
          <Action label="Pause" disabled={!paired} onPress={() => void controlPc(host, "pause").then(() => setMessage("Pause sent.")).catch((error) => Alert.alert("Not paused", messageOf(error)))} />
          <Action label="Resume" disabled={!paired} onPress={() => void controlPc(host, "resume").then(() => setMessage("Resume sent.")).catch((error) => Alert.alert("Not resumed", messageOf(error)))} />
          <Action label="Cancel" disabled={!paired} onPress={() => void controlPc(host, "cancel").then(() => setMessage("Cancel sent.")).catch((error) => Alert.alert("Not cancelled", messageOf(error)))} />
          <Action label="Undo" disabled={!paired} onPress={() => void controlPc(host, "undo").then(() => setMessage("Undo sent.")).catch((error) => Alert.alert("Undo not sent", messageOf(error)))} />
        </View>

        <GlowCard>
          <Text style={styles.section}>Connect desktop</Text>
          <Field value={host} onChangeText={setHost} autoCapitalize="none" placeholder="192.168.4.33" accessibilityLabel="PC address" />
          <Field value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Pairing code" accessibilityLabel="Pairing code" />
          <Button title="Pair with code" onPress={() => {
            void pairPc(host, code).then(() => refresh()).then(() => { setCode(""); setMessage("Paired. The code cannot be used again."); }).catch((error) => Alert.alert("Not paired", messageOf(error)));
          }} />
          <Button title="Refresh status" secondary disabled={!paired} onPress={() => void refresh().catch((error) => Alert.alert("PC unavailable", messageOf(error)))} />
          <Button title="Disconnect" danger onPress={() => { disconnectPc(); setPaired(false); setStatus(null); setMessage("This phone forgot the pairing token. Revoke it on the PC as well."); }} />
        </GlowCard>
        {message ? <Note>{message}</Note> : null}
      </View>
    </ScrollView>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The PC did not accept that.";
}

function Badge({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.badgeCard}>
      <Text style={styles.badgeTitle}>{title}</Text>
      <Text style={styles.meta}>{detail}</Text>
    </View>
  );
}

function Action({ label, hint, onPress, disabled = false }: { label: string; hint?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.action, disabled && { opacity: 0.45 }]}>
      <Text style={styles.actionLabel}>{label}</Text>
      {hint ? <Text style={styles.meta}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 28 },
  body: { gap: 12, padding: 16 },
  title: { color: c.text, fontSize: 28, fontWeight: "800" },
  section: { color: c.text, fontSize: 16, fontWeight: "800" },
  meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  good: { color: c.success, fontSize: 12, fontWeight: "700" },
  rowBetween: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  badge: { color: c.muted, fontWeight: "800" },
  badgeOn: { color: c.success, fontWeight: "800" },
  badges: { gap: 8 },
  badgeCard: { backgroundColor: "#0A162C", borderRadius: 12, gap: 2, padding: 10 },
  badgeTitle: { color: c.text, fontWeight: "700" },
  rail: { backgroundColor: "#10233F", borderRadius: 6, height: 8, overflow: "hidden" },
  railFill: { backgroundColor: c.blue, height: 8 },
  warnTitle: { color: c.warning, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { backgroundColor: c.surface, borderColor: "#1B4F8C", borderRadius: 14, borderWidth: 1, minWidth: "30%", padding: 10 },
  actionLabel: { color: c.text, fontWeight: "800" },
});
