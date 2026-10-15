import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import type { Session } from "@supabase/supabase-js";
import { authConfigured, supabase } from "./src/lib/supabase";
import { connectionModeLabel, getConnection, saveConnection, subscribeConnection } from "./src/lib/connection.js";
import {
  cancelJob,
  claimPairing,
  cloudConfigured,
  confirmPreview,
  deleteBlueprint,
  duplicateBlueprint,
  favoriteBlueprint,
  fetchBlueprints,
  fetchHealth,
  fetchJob,
  fetchSession,
  previewBlueprint,
  renameBlueprint,
  requestPreview,
  revokePairing,
  saveBlueprint,
  transcribeAudio,
  type CloudBlueprint,
  type CloudHealth,
  type CloudJob,
  type CloudPreview,
  type CloudSession,
  type ConsolePlatform,
} from "./src/lib/cloud";
import { theme as c } from "./src/theme";
import { Button, Card, Field, Footprint, Note, Status } from "./src/ui";

type Tab = "home" | "build" | "console" | "library" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "build", label: "Build" },
  { id: "console", label: "Console" },
  { id: "library", label: "Library" },
  { id: "settings", label: "Settings" },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState<CloudSession | null>(null);
  const [health, setHealth] = useState<CloudHealth | null>(null);
  const [platform, setPlatform] = useState<ConsolePlatform>("ps5");
  const [step, setStep] = useState(0);
  const [pairCode, setPairCode] = useState("");
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<CloudPreview | null>(null);
  const [job, setJob] = useState<CloudJob | null>(null);
  const [blueprints, setBlueprints] = useState<CloudBlueprint[]>([]);
  const [blueprintName, setBlueprintName] = useState("");
  const [connection, setConnection] = useState(getConnection);
  const [apiDraft, setApiDraft] = useState(getConnection().apiUrl);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }
    const client = supabase;
    client.auth.getSession().then(async ({ data }) => {
      const current = data.session;
      if (current?.expires_at && current.expires_at * 1000 < Date.now() + 60_000) {
        const refreshed = await client.auth.refreshSession();
        if (refreshed.error || !refreshed.data.session) {
          await client.auth.signOut();
          setSession(null);
        } else {
          setSession(refreshed.data.session);
        }
      } else {
        setSession(current);
      }
      setLoadingAuth(false);
    }).catch(() => setLoadingAuth(false));
    const listener = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.data.subscription.unsubscribe();
  }, []);

  useEffect(() => subscribeConnection(() => {
    const next = getConnection();
    setConnection(next);
    setApiDraft(next.apiUrl);
  }), []);

  async function refreshCloud() {
    if (!cloudConfigured() || !session) return;
    const next = await fetchSession();
    setCloud(next);
    if (next.activeJob) setJob(next.activeJob);
  }

  useEffect(() => {
    if (!session) return;
    refreshCloud().catch(() => setCloud(null));
  }, [session, tab, connection.mode, connection.apiUrl]);

  useEffect(() => {
    if (!job || !["queued", "building", "cancelling"].includes(job.status)) return;
    const timer = setInterval(() => {
      fetchJob(job.jobId).then(setJob).catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [job?.jobId, job?.status]);

  async function authenticate() {
    if (!supabase || busy) return;
    if (!email.trim() || password.length < 6) {
      Alert.alert("Check your details", "Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = creating
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (creating && !result.data.session) Alert.alert("Check your email", "Confirm your email address before signing in.");
    } catch (error) {
      Alert.alert("Authentication failed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function checkHealth() {
    setBusy(true);
    try {
      setHealth(await fetchHealth());
      setStep(2);
    } catch (error) {
      setHealth(null);
      Alert.alert("Cloud unavailable", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    setBusy(true);
    try {
      await claimPairing(pairCode.trim().toUpperCase(), platform);
      await refreshCloud();
      setStep(4);
      setTab("build");
    } catch (error) {
      Alert.alert("Pairing failed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function plan() {
    if (!cloud?.link || !instruction.trim()) return;
    setBusy(true);
    setPreview(null);
    try {
      const result = await requestPreview(cloud.link.worldId, instruction.trim());
      if (result.requiresConfirmation !== true) throw new Error("The server did not require confirmation.");
      setPreview(result);
      setBlueprintName(result.structure || "Blueprint");
    } catch (error) {
      Alert.alert("Preview failed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!preview) return;
    setBusy(true);
    try {
      const next = await confirmPreview(preview.previewId, preview.previewId);
      setJob(next);
      setPreview(null);
    } catch (error) {
      Alert.alert("Build not authorized", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleVoice() {
    if (recorderState.isRecording) {
      setBusy(true);
      try {
        await recorder.stop();
        if (!recorder.uri) throw new Error("No audio file was recorded.");
        const text = await transcribeAudio(recorder.uri);
        setInstruction(text);
        setPreview(null);
        Alert.alert("Review the transcript", "Nothing was built. Request a preview after you edit the text.");
      } catch (error) {
        Alert.alert("Transcription unavailable", errorMessage(error));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission is required.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert("Recording unavailable", errorMessage(error));
    }
  }

  async function loadLibrary() {
    const body = await fetchBlueprints();
    setBlueprints(body.blueprints);
  }

  if (loadingAuth) {
    return <View style={styles.center}><ActivityIndicator color={c.blue} /><Text style={styles.sub}>Loading VoiceCraft</Text></View>;
  }

  if (!authConfigured || !session) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>ZERO<Text style={{ color: c.blue }}>PULSE</Text></Text>
          <Text style={styles.hero}>VoiceCraft</Text>
          <Card>
            <Text style={styles.cardTitle}>{authConfigured ? (creating ? "Create your account" : "Sign in") : "Setup required"}</Text>
            {authConfigured ? (
              <>
                <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" accessibilityLabel="Email" />
                <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" accessibilityLabel="Password" />
                <Button title={busy ? "Please wait" : creating ? "Create account" : "Sign in"} disabled={busy} onPress={authenticate} />
                <Button title={creating ? "I already have an account" : "Create an account"} secondary onPress={() => setCreating(!creating)} />
                <Button title="Email me a reset link" secondary onPress={() => {
                  if (!supabase || !email.includes("@")) {
                    Alert.alert("Enter your email", "Type the email for your ZeroPulse account first.");
                    return;
                  }
                  supabase.auth.resetPasswordForEmail(email.trim()).then(({ error }) => {
                    if (error) Alert.alert("Reset failed", error.message);
                    else Alert.alert("Check your email", "Use the reset link, then sign in here.");
                  });
                }} />
              </>
            ) : (
              <Note>Add the website's Supabase URL and publishable key to mobile/.env. Do not put a service-role key in the app.</Note>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {tab === "home" ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>COMMAND CENTER</Text>
            <Text style={styles.hero}>Speak it. Preview it. Build it.</Text>
            <Card>
              <Status label={cloud?.link ? `Linked ${cloud.link.playerName}` : "No Minecraft player linked"} good={Boolean(cloud?.link)} />
              <Status label={cloudConfigured() ? "Cloud API configured" : "Cloud API not configured"} good={cloudConfigured()} />
              <Note>{connectionModeLabel(connection.mode)}. The phone sends VoiceCraft API requests only. It cannot send Minecraft console commands.</Note>
              <Text style={styles.cardTitle}>{cloud?.link?.worldName || "No world"}</Text>
              <Note>{cloud?.entitlement.message || (cloud ? `Plan ${cloud.entitlement.plan || "unknown"}` : "Sign-in succeeded. Pull to reopen this tab after the API is configured.")}</Note>
              {cloud?.entitlement.tasksRemaining != null ? <Note>{cloud.entitlement.tasksRemaining} tasks remaining today.</Note> : null}
            </Card>
            {job ? <JobCard job={job} onCancel={() => cancelJob(job.jobId).then(setJob).catch((error) => Alert.alert("Could not cancel", errorMessage(error)))} /> : <Note>No build is running.</Note>}
            <Button title="Open Build Studio" onPress={() => setTab("build")} />
          </View>
        ) : null}

        {tab === "build" ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>BUILD STUDIO</Text>
            <Card>
              <Button
                title={recorderState.isRecording ? "Stop and transcribe" : "Hold is not required. Tap to record"}
                onPress={() => void toggleVoice()}
                disabled={busy && !recorderState.isRecording}
              />
              <Note>{recorderState.isRecording ? "Microphone is on." : "The microphone stays off until you tap record."}</Note>
              <Field value={instruction} onChangeText={setInstruction} multiline placeholder="Build a small stone house" accessibilityLabel="Build request" />
              <Button title={busy ? "Working" : "Preview"} disabled={busy || !cloud?.link} onPress={() => void plan()} />
              {!cloud?.link ? <Note>Pair a console player before a preview can be created.</Note> : null}
            </Card>
            {preview ? (
              <Card>
                <Text style={styles.cardTitle}>{preview.summary}</Text>
                <Note>{preview.estimatedBlocks} blocks · {preview.width} × {preview.height} × {preview.depth}</Note>
                <Footprint width={preview.width} depth={preview.depth} />
                {preview.warnings.map((warning) => <Note key={warning}>{warning}</Note>)}
                <Button title="Approve build" onPress={() => void approve()} disabled={busy} />
                <Button title="Save blueprint" secondary onPress={() => {
                  saveBlueprint(preview.previewId, blueprintName || "Blueprint")
                    .then(() => Alert.alert("Saved", "The blueprint is in your library. The world was not changed."))
                    .catch((error) => Alert.alert("Not saved", errorMessage(error)));
                }} />
                <Button title="Discard preview" secondary onPress={() => setPreview(null)} />
              </Card>
            ) : null}
            {job ? <JobCard job={job} onCancel={() => cancelJob(job.jobId).then(setJob).catch((error) => Alert.alert("Could not cancel", errorMessage(error)))} /> : null}
          </View>
        ) : null}

        {tab === "console" ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>CONSOLE</Text>
            <Text style={styles.section}>Choose a console</Text>
            <Button title="PlayStation 5" secondary={platform !== "ps5"} onPress={() => { setPlatform("ps5"); setStep(1); }} />
            <Button title="Xbox Series X/S" secondary={platform !== "xbox"} onPress={() => { setPlatform("xbox"); setStep(1); }} />
            {step >= 1 ? (
              <Card>
                <Text style={styles.cardTitle}>Cloud status</Text>
                <Button title={busy ? "Checking" : "Check cloud"} disabled={busy} onPress={() => void checkHealth()} />
                {health ? (
                  <>
                    <Status label={`API ${health.api}`} good={health.api === "ok"} />
                    <Status label={`Minecraft ${health.minecraft}`} good={health.minecraft === "tcp-open"} />
                    <Note>
                      {health.bedrock
                        ? `Bedrock address ${health.bedrock.host}:${health.bedrock.port}. UDP was not probed from this phone.`
                        : "No public Bedrock address is published yet."}
                    </Note>
                  </>
                ) : <Note>A successful check is the only connection state this screen will show.</Note>}
              </Card>
            ) : null}
            {step >= 2 ? (
              <Card>
                <Text style={styles.cardTitle}>Join from {platform === "ps5" ? "PS5" : "Xbox"}</Text>
                <Note>Use the same Wi-Fi as the phone. Open Minecraft Bedrock, then the Servers or Friends tab, and use BedrockConnect or the featured-server workaround documented for your console. VoiceCraft does not join an existing single-player world or Realm.</Note>
                <Note>In the cloud world, type vc pair. Enter the 8 character code here. The code alone does not authorize a build.</Note>
                <Field value={pairCode} onChangeText={setPairCode} autoCapitalize="characters" placeholder="Pairing code" accessibilityLabel="Pairing code" />
                <Button title="Link this player" disabled={busy} onPress={() => void pair()} />
              </Card>
            ) : null}
            {cloud?.link ? (
              <Card>
                <Text style={styles.cardTitle}>Linked</Text>
                <Note>{cloud.link.playerName} on {cloud.link.platform} · {cloud.link.worldName}</Note>
                <Note>{cloud.link.bedrock ? "The server reported a Bedrock player id. PlayStation or Xbox is the choice you made here, not a guess from that id." : "The server did not report a Bedrock player id."}</Note>
                <Button title="Unpair" danger onPress={() => {
                  revokePairing().then(() => refreshCloud()).catch((error) => Alert.alert("Could not unpair", errorMessage(error)));
                }} />
              </Card>
            ) : null}
          </View>
        ) : null}

        {tab === "library" ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>LIBRARY</Text>
            <Button title="Refresh" secondary onPress={() => loadLibrary().catch((error) => Alert.alert("Library unavailable", errorMessage(error)))} />
            {blueprints.length === 0 ? <Note>No saved blueprints yet. Save one from a real preview.</Note> : null}
            {blueprints.map((item) => (
              <Card key={item.id}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Note>{item.summary}</Note>
                <Note>{item.estimatedBlocks} blocks · {item.favorite ? "Favorite" : item.category}</Note>
                <Button title="Preview again" onPress={() => {
                  previewBlueprint(item.id).then((next) => {
                    setPreview(next);
                    setTab("build");
                  }).catch((error) => Alert.alert("Preview failed", errorMessage(error)));
                }} />
                <Button title={item.favorite ? "Unfavorite" : "Favorite"} secondary onPress={() => {
                  favoriteBlueprint(item.id, !item.favorite).then(loadLibrary).catch((error) => Alert.alert("Not updated", errorMessage(error)));
                }} />
                <Button title="Duplicate" secondary onPress={() => duplicateBlueprint(item.id).then(loadLibrary).catch((error) => Alert.alert("Not duplicated", errorMessage(error)))} />
                <Button title="Rename" secondary onPress={() => renameBlueprint(item.id, `${item.name} renamed`).then(loadLibrary).catch((error) => Alert.alert("Not renamed", errorMessage(error)))} />
                <Button title="Delete" danger onPress={() => deleteBlueprint(item.id).then(loadLibrary).catch((error) => Alert.alert("Not deleted", errorMessage(error)))} />
              </Card>
            ))}
          </View>
        ) : null}

        {tab === "settings" ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>SETTINGS</Text>
            <Card>
              <Text style={styles.cardTitle}>{session.user.email}</Text>
              <Note>App 0.2.0 · remote push notifications are not configured.</Note>
              <Note>Microphone access is requested only when you record. Background recording is off.</Note>
              <Note>{cloud?.entitlement.plan ? `Plan ${cloud.entitlement.plan}. ${cloud.entitlement.message || ""}` : "Subscription status appears after the API accepts this session."}</Note>
              <Note>{cloudConfigured() ? `API ${connectionModeLabel(connection.mode)}` : "Cloud API URL is not set."}</Note>
              <Button title="Sign out" onPress={() => supabase?.auth.signOut()} />
            </Card>
            <Card>
              <Text style={styles.cardTitle}>Server connection</Text>
              <Note>One app, three ways to reach an authorized VoiceCraft API. None of these places blocks on the phone.</Note>
              <Button title="Local developer" secondary={connection.mode !== "local"} onPress={() => setConnection({ ...connection, mode: "local" })} />
              <Button title="Community server" secondary={connection.mode !== "community"} onPress={() => setConnection({ ...connection, mode: "community" })} />
              <Button title="Your server" secondary={connection.mode !== "supplied"} onPress={() => setConnection({ ...connection, mode: "supplied" })} />
              <Field value={apiDraft} onChangeText={setApiDraft} autoCapitalize="none" placeholder="https://api.example" accessibilityLabel="VoiceCraft API address" />
              <Button title="Save connection" onPress={() => {
                try {
                  saveConnection({ mode: connection.mode, apiUrl: apiDraft.trim() });
                  Alert.alert("Connection saved", "The next request uses this API. A build still needs a preview you approve.");
                } catch (error) {
                  Alert.alert("Address not allowed", errorMessage(error));
                }
              }} />
              <Note>Local developer mode uses this computer on your private network. It is for testing, not a 24/7 service.</Note>
              <Note>Community server mode uses HTTPS to an operator who installed the VoiceCraft adapter. You can pair and revoke your device. You cannot administer their world from this phone.</Note>
              <Note>Your server mode is for a Minecraft host you control. Install the adapter from the repository docs. If you do not control the server, use community mode and ask the operator.</Note>
            </Card>
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: tab === item.id }} onPress={() => {
            setTab(item.id);
            if (item.id === "library") loadLibrary().catch(() => setBlueprints([]));
          }} style={styles.tab}>
            <Text style={[styles.tabText, tab === item.id && styles.tabOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function JobCard({ job, onCancel }: { job: CloudJob; onCancel: () => void }) {
  const active = job.status === "queued" || job.status === "building" || job.status === "cancelling";
  return (
    <Card>
      <Text style={styles.cardTitle}>{job.status}</Text>
      <Note>{job.confirmed} confirmed · {job.failed} failed · {job.total} planned</Note>
      {job.error ? <Note>{job.error}</Note> : null}
      {active ? <Button title="Cancel build" danger onPress={onCancel} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: c.background },
  auth: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },
  page: { padding: 20, gap: 16, paddingBottom: 32 },
  stack: { gap: 14 },
  brand: { color: c.text, fontSize: 18, fontWeight: "800", letterSpacing: 4 },
  hero: { color: c.text, fontSize: 32, fontWeight: "800" },
  kicker: { color: c.blue, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  section: { color: c.text, fontSize: 18, fontWeight: "700" },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: "700" },
  sub: { color: c.muted },
  tabs: {
    flexDirection: "row",
    borderTopColor: c.border,
    borderTopWidth: 1,
    backgroundColor: "#0b1220",
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { color: c.muted, fontSize: 12, fontWeight: "700" },
  tabOn: { color: c.blue },
});
