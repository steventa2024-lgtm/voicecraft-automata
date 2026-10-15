import React from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { GlowCard, ScreenHero } from "./chrome";
import type { CloudHealth, CloudSession, ConsolePlatform } from "./lib/cloud";
import { theme as c } from "./theme";
import { Button, Field, Note } from "./ui";

export function ConsoleScreen({
  platform,
  onPlatform,
  health,
  busy,
  onCheck,
  pairCode,
  onCode,
  onPair,
  cloud,
  onUnpair,
  onBell,
}: {
  platform: ConsolePlatform;
  onPlatform: (platform: ConsolePlatform) => void;
  health: CloudHealth | null;
  busy: boolean;
  onCheck: () => void;
  pairCode: string;
  onCode: (value: string) => void;
  onPair: () => void;
  cloud: CloudSession | null;
  onUnpair: () => void;
  onBell: () => void;
}) {
  const bedrock = health?.bedrock || null;
  const apiReady = health?.api === "ok";
  const hostReady = health?.minecraft === "tcp-open";
  const allReady = Boolean(apiReady && hostReady && bedrock);
  const address = bedrock ? `${bedrock.host}` : "Not published";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHero compact subtitle={"Connect. Speak. Build together.\nVoice-powered Minecraft, everywhere."} onBell={onBell} />
      <View style={styles.body}>
        <Text style={styles.title}>Console Connection</Text>
        <Text style={styles.meta}>Connect your console to start voice building</Text>
        <View style={styles.row}>
          <Pressable onPress={() => onPlatform("ps5")} style={[styles.platform, platform === "ps5" && styles.platformOn]}>
            <View style={styles.rowBetween}>
              <Text style={styles.platformTitle} numberOfLines={1}>PlayStation 5</Text>
              <View style={[styles.radio, platform === "ps5" && styles.radioOn]} />
            </View>
            <Text style={platform === "ps5" ? styles.good : styles.meta}>{platform === "ps5" ? "Selected" : "Not selected"}</Text>
          </Pressable>
          <Pressable onPress={() => onPlatform("xbox")} style={[styles.platform, platform === "xbox" && styles.platformOn]}>
            <View style={styles.rowBetween}>
              <Text style={styles.platformTitle} numberOfLines={1}>Xbox</Text>
              <View style={[styles.radio, platform === "xbox" && styles.radioOn]} />
            </View>
            <Text style={platform === "xbox" ? styles.good : styles.meta}>{platform === "xbox" ? "Selected" : "Not selected"}</Text>
          </Pressable>
        </View>

        <GlowCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.section}>Cloud & Server Status</Text>
              <Text style={styles.meta}>Values come from the last health check.</Text>
            </View>
            <Text style={allReady ? styles.good : styles.warn}>{allReady ? "Reported ready" : "Not fully ready"}</Text>
          </View>
          <View style={styles.row}>
            <Mini title="Cloud API" value={health ? (apiReady ? "Reachable" : health.api) : "Not checked"} detail="API health" good={apiReady} />
            <Mini title="Minecraft Host" value={health ? health.minecraft : "Not checked"} detail={hostReady ? "TCP open" : "Not confirmed"} good={hostReady} />
            <Mini title="Bedrock Gateway" value={bedrock ? "Published" : "Not published"} detail={bedrock ? bedrock.probe : "No address yet"} good={Boolean(bedrock)} />
          </View>
          <Button title={busy ? "Checking" : "Check cloud"} secondary disabled={busy} onPress={onCheck} />
        </GlowCard>

        <GlowCard>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.section}>Your Bedrock Server Address</Text>
              <Text style={styles.meta}>Use this on {platform === "ps5" ? "PS5" : "Xbox"} only when an address is published.</Text>
            </View>
            <Pressable
              disabled={!bedrock}
              onPress={() => bedrock && void Share.share({ message: `${bedrock.host}:${bedrock.port}` })}
            >
              <Text style={[styles.link, !bedrock && { opacity: 0.4 }]}>Copy</Text>
            </Pressable>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.address}>{address}</Text>
            <Text style={styles.port}>Port {bedrock ? bedrock.port : "—"}</Text>
          </View>
        </GlowCard>

        <GlowCard>
          <Text style={styles.section}>Pair your {platform === "ps5" ? "PlayStation 5" : "Xbox"} account</Text>
          <Text style={styles.meta}>Link your player to enable VoiceCraft on this console.</Text>
          <Text style={styles.step}>1. Join the published server from the console. VoiceCraft does not join a Realm for you.</Text>
          <Text style={styles.step}>2. In that world, type vc pair and read the code in chat.</Text>
          <Text style={styles.step}>3. Enter the 8-character code here. The code does not approve a build.</Text>
          <Field value={pairCode} onChangeText={onCode} autoCapitalize="characters" placeholder="8-character code" accessibilityLabel="Pairing code" />
          <Button title="Link this player" disabled={busy} onPress={onPair} />
        </GlowCard>

        {cloud?.link ? (
          <GlowCard>
            <Text style={styles.section}>Linked</Text>
            <Note>{cloud.link.playerName} on {cloud.link.platform} · {cloud.link.worldName}</Note>
            <Note>{cloud.link.bedrock ? "The server reported a Bedrock player id. PlayStation or Xbox is the choice you made here." : "The server did not report a Bedrock player id."}</Note>
            <Button title="Unpair" danger onPress={onUnpair} />
          </GlowCard>
        ) : null}

        <View style={styles.warning}>
          <Text style={styles.warnTitle}>Important note</Text>
          <Text style={styles.warnBody}>VoiceCraft does not connect to an existing single-player world or Realm. You must join the VoiceCraft server shown above to use voice building.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Mini({ title, value, detail, good }: { title: string; value: string; detail: string; good: boolean }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.meta}>{title}</Text>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={good ? styles.good : styles.meta}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 24 },
  body: { gap: 12, padding: 16 },
  title: { color: c.text, fontSize: 26, fontWeight: "800" },
  section: { color: c.text, fontSize: 16, fontWeight: "800" },
  meta: { color: c.muted, fontSize: 12, lineHeight: 17 },
  good: { color: c.success, fontSize: 12, fontWeight: "700" },
  warn: { color: c.warning, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  platform: { borderColor: "#24558F", borderRadius: 16, borderWidth: 1, flex: 1, gap: 4, padding: 14 },
  platformOn: { borderColor: c.blue, backgroundColor: "#10284A" },
  platformTitle: { color: c.text, flex: 1, fontSize: 15, fontWeight: "800" },
  radio: { borderColor: "#6E86A8", borderRadius: 9, borderWidth: 2, height: 18, width: 18 },
  radioOn: { backgroundColor: c.blue, borderColor: "#D7E9FF" },
  mini: { backgroundColor: "#0A162C", borderRadius: 14, flex: 1, gap: 4, padding: 8 },
  miniValue: { color: c.text, fontSize: 12, fontWeight: "800" },
  addressRow: { alignItems: "center", backgroundColor: "#081426", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", padding: 12 },
  address: { color: c.text, flex: 1, fontSize: 16, fontWeight: "700" },
  port: { color: c.muted, fontWeight: "700" },
  link: { color: c.blue, fontWeight: "800" },
  step: { color: c.text, fontSize: 13, lineHeight: 18 },
  warning: { backgroundColor: "#2A220C", borderColor: "#8A6A22", borderRadius: 16, borderWidth: 1, gap: 4, padding: 14 },
  warnTitle: { color: c.warning, fontWeight: "800" },
  warnBody: { color: "#F3E2B0", fontSize: 13, lineHeight: 18 },
});
