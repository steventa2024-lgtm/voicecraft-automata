import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { controlPc, disconnectPc, pairPc, pcPaired, pcStatus, savedPcHost, type PcStatus } from "./lib/companion";
import { Button, Card, Field, Note } from "./ui";

export function PcScreen() {
  const [host, setHost] = useState(savedPcHost());
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<PcStatus | null>(null);
  const [paired, setPaired] = useState(pcPaired());
  const [message, setMessage] = useState("");

  async function refresh() {
    const next = await pcStatus(host);
    setStatus(next);
    setPaired(true);
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ color: "#48A6FF", fontSize: 12, fontWeight: "800", letterSpacing: 2 }}>MY PC</Text>
      <Note>This controls the VoiceCraft desktop app on a computer you own. It is separate from the console cloud connection. The link is a private-network request and is not encrypted, so use your own Wi-Fi.</Note>
      <Card>
        <Text style={{ color: "#F5F8FF", fontSize: 18, fontWeight: "700" }}>{status?.name || "No PC paired"}</Text>
        <Note>{paired ? "Paired on this phone" : "Not paired"} · {status?.platform || "platform unknown"} · app {status?.version || "—"}</Note>
        <Note>Account on the PC: {status?.account || "not reported"}</Note>
        <Note>Minecraft bridge: {status ? (status.bridgeRunning ? "running" : "not running") : "not checked"}</Note>
        <Note>Build: {status?.activeJob?.status || "idle"}{typeof status?.activeJob?.progress === "number" ? ` · ${Math.round(status.activeJob.progress * 100)}%` : ""}</Note>
        <Note>Remote builds: {status?.permissions.build ? "allowed on the PC" : "blocked until you allow them on the PC"}</Note>
        <Note>{status?.transport || "Pair from the desktop Mobile Companion panel to see a live status."}</Note>
        <Note>{status?.remoteDesktopReason || "Live screen sharing is not available in Expo Go."}</Note>
      </Card>
      <Card>
        <Text style={{ color: "#F5F8FF", fontSize: 18, fontWeight: "700" }}>Connect desktop</Text>
        <Field value={host} onChangeText={setHost} autoCapitalize="none" placeholder="192.168.4.33" accessibilityLabel="PC address" />
        <Field value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Pairing code" accessibilityLabel="Pairing code" />
        <Button title="Pair with code" onPress={() => {
          void pairPc(host, code).then(() => refresh()).then(() => { setCode(""); setMessage("Paired. The code cannot be used again."); }).catch((error) => Alert.alert("Not paired", error instanceof Error ? error.message : "Pairing failed."));
        }} />
        <Button title="Refresh status" secondary disabled={!paired} onPress={() => void refresh().catch((error) => Alert.alert("PC unavailable", error instanceof Error ? error.message : "No status."))} />
        <Button title="Pause" secondary disabled={!paired} onPress={() => void controlPc(host, "pause").catch((error) => Alert.alert("Not paused", error instanceof Error ? error.message : "Pause failed."))} />
        <Button title="Resume" secondary disabled={!paired} onPress={() => void controlPc(host, "resume").catch((error) => Alert.alert("Not resumed", error instanceof Error ? error.message : "Resume failed."))} />
        <Button title="Cancel build" danger disabled={!paired} onPress={() => void controlPc(host, "cancel").catch((error) => Alert.alert("Not cancelled", error instanceof Error ? error.message : "Cancel failed."))} />
        <Button title="Request undo" secondary disabled={!paired} onPress={() => void controlPc(host, "undo").catch((error) => Alert.alert("Undo not sent", error instanceof Error ? error.message : "Undo failed."))} />
        <Button title="Disconnect" danger onPress={() => { disconnectPc(); setPaired(false); setStatus(null); setMessage("This phone forgot the pairing token. Revoke it on the PC as well."); }} />
      </Card>
      {message ? <Note>{message}</Note> : null}
    </View>
  );
}
