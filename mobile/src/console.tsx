import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { GlowCard, Glyph, ScreenHero, SectionTitle, StatusPill } from "./chrome";
import type { CloudHealth, CloudSession, ConsolePlatform } from "./lib/cloud";
import { MaterialCube } from "./preview";
import { theme as c } from "./theme";
import { Button, Field } from "./ui";
type Props = {
  platform: ConsolePlatform;
  onPlatform: (p: ConsolePlatform) => void;
  health: CloudHealth | null;
  busy: boolean;
  onCheck: () => void;
  pairCode: string;
  onCode: (s: string) => void;
  onPair: () => void;
  cloud: CloudSession | null;
  onUnpair: () => void;
  onBell: () => void;
  configured: boolean;
};
export function ConsoleScreen(p: Props) {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const bedrock = p.health?.bedrock,
    api = p.health?.api === "ok",
    host = p.health?.minecraft === "tcp-open";
  const selected = p.platform === "ps5" ? "PlayStation 5" : "Xbox";
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHero
        subtitle={"Connect. Speak. Build Together.\nVoice-powered Minecraft, everywhere."}
        onBell={p.onBell}
      />
      <View style={s.body}>
        <SectionTitle
          icon="controller"
          title="Console Connection"
          detail="Connect your console to start voice building"
        />
        <View style={s.row}>
          {(["ps5", "xbox"] as const).map((platform) => (
            <Pressable
              key={platform}
              accessibilityRole="radio"
              accessibilityLabel={platform === "ps5" ? "PlayStation 5" : "Xbox"}
              aria-checked={p.platform === platform}
              accessibilityState={{ checked: p.platform === platform }}
              onPress={() => p.onPlatform(platform)}
              style={[s.platform, p.platform === platform && s.platformOn]}
            >
              <View
                style={[
                  s.consoleIcon,
                  platform === "xbox" && { backgroundColor: "#064B3B", borderColor: "#148263" },
                ]}
              >
                <Text style={s.consoleMark}>{platform === "ps5" ? "PS" : "X"}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.platformTitle}>{platform === "ps5" ? "PlayStation 5" : "Xbox"}</Text>
                <Text style={[s.small, p.platform === platform && { color: c.success }]}>
                  {p.platform === platform ? "● Selected" : "● Not selected"}
                </Text>
              </View>
              <View
                style={[
                  s.radio,
                  p.platform === platform && { borderColor: c.blue, backgroundColor: "#079EFF" },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <GlowCard>
          <View style={s.rowBetween}>
            <SectionTitle icon="cloud" title="Cloud & Server Status" />
            <StatusPill
              label={api && host && bedrock ? "Reported ready" : "Setup required"}
              good={Boolean(api && host && bedrock)}
            />
          </View>
          <Text style={s.small}>Status from your latest connection check</Text>
          <View style={s.row}>
            <Service
              icon="cloud"
              title="Cloud API"
              value={api ? "Connected" : p.configured ? "Unavailable" : "Not configured"}
              detail={api ? "API responding" : "Choose a server"}
              good={api}
            />
            <Service
              icon="world"
              title="Minecraft Host"
              value={
                host
                  ? "Reachable"
                  : p.health?.minecraft === "unreachable"
                    ? "Unreachable"
                    : "Not configured"
              }
              detail={host ? "TCP port open" : "Not confirmed"}
              good={host}
            />
            <Service
              icon="cube"
              title="Bedrock Gateway"
              value={bedrock ? "Published" : "Not published"}
              detail={bedrock ? "Address available" : "No address yet"}
              good={Boolean(bedrock)}
            />
          </View>
          <Button
            icon="refresh"
            title={p.busy ? "Checking…" : "Check connection"}
            secondary
            disabled={p.busy || !p.configured}
            onPress={p.onCheck}
          />
          {!p.configured ? (
            <Pressable accessibilityRole="button" onPress={p.onBell}>
              <Text style={s.link}>Configure your API in Settings ›</Text>
            </Pressable>
          ) : null}
        </GlowCard>
        <GlowCard>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <SectionTitle
                icon="cube"
                title="Your Bedrock Server Address"
                detail={"Use this address on your " + selected + " to join."}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy server address"
              accessibilityState={{ disabled: !bedrock }}
              disabled={!bedrock}
              onPress={() => {
                if (bedrock)
                  void Clipboard.setStringAsync(bedrock.host + ":" + bedrock.port)
                    .then(() => {
                      setCopied(true);
                      setCopyError("");
                    })
                    .catch(() => setCopyError("Copy unavailable. Select the address below."));
              }}
              style={[s.copy, !bedrock && { opacity: 0.35 }]}
            >
              <Glyph name="copy" size={14} />
              <Text style={s.link}>{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>
          <View style={s.address}>
            <Text selectable style={s.addressText}>
              {bedrock?.host || "Not published"}
            </Text>
            <View style={s.port}>
              <Text style={s.small}>Port</Text>
              <Text selectable style={s.addressText}>
                {bedrock?.port ?? "—"}
              </Text>
            </View>
          </View>
          {copyError ? <Text style={s.small}>{copyError}</Text> : null}
        </GlowCard>
        <GlowCard>
          <SectionTitle
            icon="link"
            title={"Pair Your " + selected + " Account"}
            detail="Link your player to enable VoiceCraft on this console."
          />
          <Step n={1} text="Join the published VoiceCraft server from your console." />
          <Step n={2} text="In world chat, type vc pair to receive a one-time code." />
          <Step n={3} text="Enter the 8-character code below to link your player." />
          <View style={s.pairRow}>
            <Field
              value={p.pairCode}
              onChangeText={(value) => p.onCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="8-character code"
              accessibilityLabel="Console pairing code"
              style={{ flex: 1, minWidth: 110, letterSpacing: 2 }}
            />
            <View style={{ flex: 1, minWidth: 130 }}>
              <Button
                icon="link"
                title="Link this player"
                disabled={p.busy || !p.configured || !bedrock || p.pairCode.trim().length !== 8}
                onPress={p.onPair}
              />
            </View>
          </View>
          <View style={s.warning}>
            <Glyph name="warning" color={c.warning} size={22} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.warnTitle}>Important Note</Text>
              <Text style={s.small}>
                VoiceCraft does not connect to an existing single-player world or Realm. Join the
                published VoiceCraft server to use voice building.
              </Text>
            </View>
          </View>
        </GlowCard>
        {p.cloud?.link ? (
          <GlowCard>
            <SectionTitle
              icon="check"
              title="Player linked"
              detail={p.cloud.link.playerName + " · " + p.cloud.link.worldName}
            />
            <Text style={s.small}>
              Selected console: {p.cloud.link.platform}. Pairing does not approve a build.
            </Text>
            <Button title="Unpair player" danger disabled={p.busy} onPress={p.onUnpair} />
          </GlowCard>
        ) : null}
      </View>
    </ScrollView>
  );
}
function Service({
  icon,
  title,
  value,
  detail,
  good,
}: {
  icon: string;
  title: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <View style={[s.service, good && { borderColor: "#146A9B" }]}>
      {icon === "world" ? (
        <MaterialCube material="grass_block" size={30} />
      ) : (
        <Glyph name={icon} size={31} color={good ? c.blue : "#57708D"} />
      )}
      <Text style={s.serviceTitle}>{title}</Text>
      <Text style={[s.serviceValue, { color: good ? c.success : c.muted }]}>
        {good ? "● " : ""}
        {value}
      </Text>
      <Text style={s.micro}>{detail}</Text>
    </View>
  );
}
function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.row}>
      <View style={s.number}>
        <Text style={s.stepNumber}>{n}</Text>
      </View>
      <Text style={[s.small, { flex: 1 }]}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { paddingBottom: 18 },
  body: { paddingHorizontal: 12, gap: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  small: { color: c.muted, fontSize: 10, lineHeight: 15 },
  micro: { color: c.muted, fontSize: 8, lineHeight: 12, textAlign: "center" },
  platform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 11,
    minHeight: 67,
    backgroundColor: "#091B30",
  },
  platformOn: { borderColor: c.blue, backgroundColor: "#073365", boxShadow: "0 0 8px #1DBAFF44" },
  consoleIcon: {
    width: 40,
    height: 45,
    borderRadius: 9,
    backgroundColor: "#0754AD",
    borderColor: "#2795E4",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  consoleMark: { fontSize: 24, color: "#FFF", fontWeight: "900", fontStyle: "italic" },
  platformTitle: { fontSize: 12, color: c.text, fontWeight: "600" },
  radio: { height: 15, width: 15, borderWidth: 1.5, borderRadius: 8, borderColor: "#627D9E" },
  service: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071B32",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 9,
    paddingHorizontal: 3,
    paddingVertical: 11,
    gap: 5,
    minHeight: 108,
  },
  serviceTitle: { color: c.text, fontSize: 9, fontWeight: "600", textAlign: "center" },
  serviceValue: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  link: { color: c.blue, fontSize: 10 },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 7,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
  },
  address: {
    backgroundColor: "#040F1F",
    borderRadius: 9,
    borderColor: c.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  addressText: { fontFamily: "monospace", color: c.text, fontSize: 13, flexShrink: 1 },
  port: {
    marginLeft: "auto",
    borderLeftWidth: 1,
    borderLeftColor: c.border,
    paddingLeft: 12,
    gap: 3,
  },
  number: {
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: "#0788EF",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  pairRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warning: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#7E6B38",
    backgroundColor: "#29271366",
    borderRadius: 12,
    padding: 10,
    marginTop: 3,
  },
  warnTitle: { color: c.warning, fontSize: 11, fontWeight: "700" },
});
