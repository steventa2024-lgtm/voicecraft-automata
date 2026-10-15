import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import type { Session } from "@supabase/supabase-js";
import { authConfigured, supabase } from "./src/lib/supabase";
import {
  connectionModeLabel,
  getConnection,
  saveConnection,
  subscribeConnection,
} from "./src/lib/connection.js";
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
import { Button, Card, Field, Note } from "./src/ui";
import { BlueprintScreen, CatalogScreen } from "./src/catalog";
import { PcScreen } from "./src/pc";
import { HomeScreen } from "./src/home";
import { ConsoleScreen } from "./src/console";
import { LibraryScreen } from "./src/library";
import type { BlueprintDraft } from "./src/blueprint";
import { BottomNav, GlowCard, LogoMark, ModeMenu, ScreenHero, type MainTab } from "./src/chrome";

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
  const [tab, setTab] = useState<MainTab>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [buildMode, setBuildMode] = useState<"blueprint" | "voice">("blueprint");
  const [templateId, setTemplateId] = useState("lakeside-cottage");
  const [draft, setDraft] = useState<BlueprintDraft | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [libraryError, setLibraryError] = useState("");
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const notify = (title: string, message: string) => setNotice({ title, message });
  const planRevision = useRef(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState<CloudSession | null>(null);
  const [health, setHealth] = useState<CloudHealth | null>(null);
  const [platform, setPlatform] = useState<ConsolePlatform>("ps5");
  const [pairCode, setPairCode] = useState("");
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<CloudPreview | null>(null);
  const [job, setJob] = useState<CloudJob | null>(null);
  const [blueprints, setBlueprints] = useState<CloudBlueprint[]>([]);
  const [blueprintName, setBlueprintName] = useState("");
  const [connection, setConnection] = useState(getConnection);
  const [modeDraft, setModeDraft] = useState(getConnection().mode);
  const [apiDraft, setApiDraft] = useState(getConnection().apiUrl);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const insets = useSafeAreaInsets();
  const endpoint = `${session?.user.id || ""}|${connection.mode}|${connection.apiUrl}`;
  const latestEndpoint = useRef(endpoint);
  const cloudRequest = useRef(0);
  const healthRequest = useRef(0);
  latestEndpoint.current = endpoint;

  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }
    const client = supabase;
    client.auth
      .getSession()
      .then(async ({ data }) => {
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
      })
      .catch(() => setLoadingAuth(false));
    const listener = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.data.subscription.unsubscribe();
  }, []);

  useEffect(
    () =>
      subscribeConnection(() => {
        const next = getConnection();
        setConnection(next);
        setModeDraft(next.mode);
        setApiDraft(next.apiUrl);
      }),
    [],
  );

  async function refreshCloud() {
    if (!cloudConfigured() || !session) return;
    const key = endpoint;
    const request = ++cloudRequest.current;
    try {
      const next = await fetchSession();
      if (latestEndpoint.current !== key || request !== cloudRequest.current) return;
      setCloud(next);
      setJob(next.activeJob || next.recent?.[0] || null);
    } catch (error) {
      if (latestEndpoint.current === key && request === cloudRequest.current) {
        setCloud(null);
        setJob(null);
      }
      throw error;
    }
  }

  async function refreshHealth() {
    const key = endpoint;
    const request = ++healthRequest.current;
    try {
      const next = await fetchHealth();
      if (latestEndpoint.current === key && request === healthRequest.current) setHealth(next);
    } catch (error) {
      if (latestEndpoint.current === key && request === healthRequest.current) setHealth(null);
      throw error;
    }
  }

  useEffect(() => {
    setCloud(null);
    setHealth(null);
    setJob(null);
    setPreview(null);
    planRevision.current += 1;
    if (!session || !cloudConfigured()) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = () => void Promise.allSettled([refreshCloud(), refreshHealth()]);
    function start() {
      poll();
      timer = setInterval(poll, 15000);
    }
    function clear() {
      if (timer) clearInterval(timer);
      timer = null;
      cloudRequest.current += 1;
      healthRequest.current += 1;
    }
    start();
    const listener = AppState.addEventListener("change", (state) => {
      clear();
      if (state === "active") start();
      else {
        setCloud(null);
        setHealth(null);
        setJob(null);
        setPreview(null);
        planRevision.current += 1;
      }
    });
    return () => {
      clear();
      listener.remove();
    };
  }, [endpoint]);

  useEffect(() => {
    if (!job || !["queued", "building", "cancelling"].includes(job.status)) return;
    let disposed = false;
    const timer = setInterval(() => {
      fetchJob(job.jobId)
        .then((next) => {
          if (!disposed) setJob(next);
        })
        .catch(() => {
          if (!disposed) setJob(null);
        });
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [job?.jobId, job?.status, endpoint]);

  async function authenticate() {
    if (!supabase || busy) return;
    if (!email.trim() || password.length < 6) {
      notify("Check your details", "Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = creating
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (creating && !result.data.session)
        notify("Check your email", "Confirm your email address before signing in.");
    } catch (error) {
      notify("Authentication failed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function checkHealth() {
    setBusy(true);
    try {
      await refreshHealth();
    } catch (error) {
      notify("Cloud unavailable", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    setBusy(true);
    try {
      await claimPairing(pairCode.trim().toUpperCase(), platform);
      await refreshCloud();
      setTab("home");
    } catch (error) {
      notify("Pairing failed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function plan() {
    if (!cloud?.link || !instruction.trim()) return;
    setBusy(true);
    setPreview(null);
    const revision = ++planRevision.current;
    try {
      const result = await requestPreview(cloud.link.worldId, instruction.trim());
      if (revision !== planRevision.current) return;
      if (result.requiresConfirmation !== true)
        throw new Error("The server did not require confirmation.");
      setPreview(result);
      setBlueprintName(result.structure || "Blueprint");
    } catch (error) {
      notify("Preview failed", errorMessage(error));
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
      notify("Build not authorized", errorMessage(error));
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
        planRevision.current += 1;
        setInstruction(text);
        setPreview(null);
        notify(
          "Review the transcript",
          "Nothing was built. Request a preview after you edit the text.",
        );
      } catch (error) {
        notify("Transcription unavailable", errorMessage(error));
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
      notify("Recording unavailable", errorMessage(error));
    }
  }

  async function loadLibrary() {
    try {
      const body = await fetchBlueprints();
      setBlueprints(body.blueprints);
      setLibraryError("");
    } catch (error) {
      setBlueprints([]);
      setLibraryError(errorMessage(error));
    }
  }

  function openTab(next: MainTab) {
    setSettingsOpen(false);
    setTab(next);
    if (next === "library") loadLibrary().catch(() => setBlueprints([]));
  }

  function openTemplate(id: string) {
    setTemplateId(id);
    setDraft(null);
    setEditorKey((value) => value + 1);
    setBuildMode("blueprint");
    openTab("build");
  }

  if (loadingAuth) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.blue} />
        <Text style={styles.sub}>Loading VoiceCraft</Text>
      </View>
    );
  }

  if (!authConfigured || !session) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.auth, { paddingTop: insets.top + 12 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <LogoMark />
            <Text style={styles.brand}>
              Zero<Text style={{ color: c.blue }}>Pulse</Text>
            </Text>
          </View>
          <Text style={styles.hero}>VoiceCraft</Text>
          <Text style={styles.sub}>
            Turn your ideas into Minecraft builds. Sign in with the same ZeroPulse account as the
            website.
          </Text>
          <Card>
            <Text style={styles.cardTitle}>
              {authConfigured ? (creating ? "Create your account" : "Sign in") : "Setup required"}
            </Text>
            {authConfigured ? (
              <>
                <Field
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email"
                  accessibilityLabel="Email"
                />
                <Field
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Password"
                  accessibilityLabel="Password"
                />
                <Button
                  title={busy ? "Please wait" : creating ? "Create account" : "Sign in"}
                  disabled={busy}
                  onPress={authenticate}
                />
                <Button
                  title={creating ? "I already have an account" : "Create an account"}
                  secondary
                  onPress={() => setCreating(!creating)}
                />
                <Button
                  title="Email me a reset link"
                  secondary
                  onPress={() => {
                    if (!supabase || !email.includes("@")) {
                      notify(
                        "Enter your email",
                        "Type the email for your ZeroPulse account first.",
                      );
                      return;
                    }
                    supabase.auth.resetPasswordForEmail(email.trim()).then(({ error }) => {
                      if (error) notify("Reset failed", error.message);
                      else notify("Check your email", "Use the reset link, then sign in here.");
                    });
                  }}
                />
              </>
            ) : (
              <Note>
                Add the website's Supabase URL and publishable key to mobile/.env. Do not put a
                service-role key in the app.
              </Note>
            )}
          </Card>
        </ScrollView>
        <MessageDialog notice={notice} onClose={() => setNotice(null)} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["left", "right"]}>
      <View style={styles.flex}>
        {settingsOpen ? (
          <Settings
            email={session.user.email || ""}
            cloud={cloud}
            connectionLabel={connectionModeLabel(connection.mode)}
            configured={cloudConfigured()}
            mode={modeDraft}
            apiDraft={apiDraft}
            onMode={setModeDraft}
            onDraft={setApiDraft}
            onSave={() => {
              try {
                saveConnection({ mode: modeDraft, apiUrl: apiDraft.trim() });
                notify(
                  "Connection saved",
                  "The next request uses this API. A build still needs a preview you approve.",
                );
              } catch (error) {
                notify("Address not allowed", errorMessage(error));
              }
            }}
            onSignOut={() => supabase?.auth.signOut()}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
        {!settingsOpen && tab === "home" ? (
          <HomeScreen
            cloud={cloud}
            health={health}
            configured={cloudConfigured()}
            job={job}
            onBell={() => setSettingsOpen(true)}
            onBuild={() => {
              setBuildMode("blueprint");
              openTab("build");
            }}
            onVoice={() => {
              setBuildMode("voice");
              openTab("build");
            }}
            onText={() => {
              setBuildMode("voice");
              openTab("build");
            }}
            onCatalog={() => openTab("catalog")}
            onPc={() => openTab("pc")}
            onConsole={() => openTab("console")}
            onOpen={openTemplate}
          />
        ) : null}
        {!settingsOpen && tab === "build" && buildMode === "blueprint" ? (
          <BlueprintScreen
            key={editorKey}
            templateId={templateId}
            draft={draft}
            onDraft={setDraft}
            mode={buildMode}
            onMode={setBuildMode}
            onBell={() => setSettingsOpen(true)}
            onBack={() => openTab("catalog")}
            onPc={() => openTab("pc")}
          />
        ) : null}
        {!settingsOpen && tab === "build" && buildMode === "voice" ? (
          <VoiceStudio
            mode={buildMode}
            onMode={setBuildMode}
            onBell={() => setSettingsOpen(true)}
            recording={recorderState.isRecording}
            busy={busy}
            instruction={instruction}
            onInstruction={(value) => {
              setInstruction(value);
              setPreview(null);
              planRevision.current += 1;
            }}
            onVoice={() => void toggleVoice()}
            onPlan={() => void plan()}
            linked={Boolean(cloud?.link)}
            preview={preview}
            blueprintName={blueprintName}
            onSave={() => {
              if (!preview) return;
              saveBlueprint(preview.previewId, blueprintName || "Blueprint")
                .then(() =>
                  notify("Saved", "The blueprint is in your library. The world was not changed."),
                )
                .catch((error) => notify("Not saved", errorMessage(error)));
            }}
            onApprove={() => void approve()}
            onDiscard={() => setPreview(null)}
            job={job}
            onCancel={() =>
              job &&
              cancelJob(job.jobId)
                .then(setJob)
                .catch((error) => notify("Could not cancel", errorMessage(error)))
            }
          />
        ) : null}
        {!settingsOpen && tab === "console" ? (
          <ConsoleScreen
            configured={cloudConfigured()}
            platform={platform}
            onPlatform={setPlatform}
            health={health}
            busy={busy}
            onCheck={() => void checkHealth()}
            pairCode={pairCode}
            onCode={setPairCode}
            onPair={() => void pair()}
            cloud={cloud}
            onUnpair={() => {
              revokePairing()
                .then(() => refreshCloud())
                .catch((error) => notify("Could not unpair", errorMessage(error)));
            }}
            onBell={() => setSettingsOpen(true)}
          />
        ) : null}
        {!settingsOpen && tab === "library" ? (
          <LibraryScreen
            blueprints={blueprints}
            cloudError={libraryError}
            onCatalog={() => openTab("catalog")}
            onOpenLocal={(item) => {
              setDraft(item);
              setTemplateId(item.templateId);
              setEditorKey((value) => value + 1);
              setBuildMode("blueprint");
              openTab("build");
            }}
            onRefresh={() => void loadLibrary()}
            onPreview={(item) => {
              previewBlueprint(item.id)
                .then((next) => {
                  setPreview(next);
                  setBuildMode("voice");
                  setTab("build");
                })
                .catch((error) => notify("Preview failed", errorMessage(error)));
            }}
            onFavorite={(item) => {
              favoriteBlueprint(item.id, !item.favorite)
                .then(loadLibrary)
                .catch((error) => notify("Not updated", errorMessage(error)));
            }}
            onDuplicate={(item) =>
              duplicateBlueprint(item.id)
                .then(loadLibrary)
                .catch((error) => notify("Not duplicated", errorMessage(error)))
            }
            onRename={(item, name) => {
              renameBlueprint(item.id, name)
                .then(loadLibrary)
                .catch((error) => notify("Not renamed", errorMessage(error)));
            }}
            onDelete={(item) =>
              deleteBlueprint(item.id)
                .then(loadLibrary)
                .catch((error) => notify("Not deleted", errorMessage(error)))
            }
            onBell={() => setSettingsOpen(true)}
          />
        ) : null}
        {!settingsOpen && tab === "catalog" ? (
          <CatalogScreen onOpen={openTemplate} onBell={() => setSettingsOpen(true)} />
        ) : null}
        {!settingsOpen && tab === "pc" ? (
          <PcScreen
            onBell={() => setSettingsOpen(true)}
            onPrepare={() => {
              setBuildMode("blueprint");
              openTab("build");
            }}
            onApprove={() => {
              setBuildMode("blueprint");
              openTab("build");
            }}
          />
        ) : null}
      </View>
      <BottomNav tab={tab} onChange={openTab} />
      <MessageDialog notice={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

function MessageDialog({
  notice,
  onClose,
}: {
  notice: { title: string; message: string } | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#0009",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <GlowCard style={{ width: "100%", maxWidth: 400 }}>
          <Text style={styles.cardTitle}>{notice?.title}</Text>
          <Note>{notice?.message}</Note>
          <Button title="OK" onPress={onClose} />
        </GlowCard>
      </View>
    </Modal>
  );
}

function VoiceStudio(props: {
  mode: "blueprint" | "voice";
  onMode: (mode: "blueprint" | "voice") => void;
  onBell: () => void;
  recording: boolean;
  busy: boolean;
  instruction: string;
  onInstruction: (value: string) => void;
  onVoice: () => void;
  onPlan: () => void;
  linked: boolean;
  preview: CloudPreview | null;
  blueprintName: string;
  onSave: () => void;
  onApprove: () => void;
  onDiscard: () => void;
  job: CloudJob | null;
  onCancel: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <ScreenHero
          compact
          subtitle="Describe a build. Nothing is placed until you approve a preview."
          onBell={props.onBell}
          right={<ModeMenu mode={props.mode} onChange={props.onMode} />}
        />
        <View style={styles.pad}>
          <GlowCard>
            <Button
              title={props.recording ? "Stop and transcribe" : "Voice Build"}
              onPress={props.onVoice}
              disabled={props.busy && !props.recording}
            />
            <Note>
              {props.recording
                ? "Microphone is on."
                : "The microphone stays off until you tap record."}
            </Note>
            <Field
              value={props.instruction}
              onChangeText={props.onInstruction}
              multiline
              placeholder="Build a small stone house"
              accessibilityLabel="Build request"
            />
            <Button
              title={props.busy ? "Working" : "Preview"}
              disabled={props.busy || !props.linked}
              onPress={props.onPlan}
            />
            {!props.linked ? (
              <Note>Pair a console player before a cloud preview can be created.</Note>
            ) : null}
          </GlowCard>
          {props.preview ? (
            <GlowCard>
              <Text style={styles.cardTitle}>{props.preview.summary}</Text>
              <Note>
                {props.preview.estimatedBlocks} blocks · {props.preview.width} ×{" "}
                {props.preview.height} × {props.preview.depth}
              </Note>
              {props.preview.warnings.map((warning) => (
                <Note key={warning}>{warning}</Note>
              ))}
              <Button title="Approve Build" onPress={props.onApprove} disabled={props.busy} />
              <Button title="Save Blueprint" secondary onPress={props.onSave} />
              <Button title="Discard preview" secondary onPress={props.onDiscard} />
            </GlowCard>
          ) : null}
          {props.job ? <JobCard job={props.job} onCancel={props.onCancel} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Settings(props: {
  email: string;
  cloud: CloudSession | null;
  connectionLabel: string;
  configured: boolean;
  mode: "local" | "community" | "supplied";
  apiDraft: string;
  onMode: (mode: "local" | "community" | "supplied") => void;
  onDraft: (value: string) => void;
  onSave: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <ScreenHero compact subtitle="Account, connection, and what this phone is allowed to do." />
      <View style={styles.pad}>
        <Button title="Back" secondary onPress={props.onClose} />
        <GlowCard>
          <Text style={styles.cardTitle}>{props.email}</Text>
          <Note>App 0.2.0. Remote push notifications are not configured.</Note>
          <Note>Microphone access is requested only when you record.</Note>
          <Note>
            {props.cloud?.entitlement.plan
              ? `Plan ${props.cloud.entitlement.plan}. ${props.cloud.entitlement.message || ""}`
              : "Subscription status appears after the API accepts this session."}
          </Note>
          <Note>
            {props.configured ? `API ${props.connectionLabel}` : "Cloud API URL is not set."}
          </Note>
          <Button title="Sign out" onPress={props.onSignOut} />
        </GlowCard>
        <GlowCard>
          <Text style={styles.cardTitle}>Server connection</Text>
          <Note>
            One app, three ways to reach an authorized VoiceCraft API. None of these places blocks
            on the phone.
          </Note>
          <Button
            title="Local developer"
            secondary={props.mode !== "local"}
            onPress={() => props.onMode("local")}
          />
          <Button
            title="Community server"
            secondary={props.mode !== "community"}
            onPress={() => props.onMode("community")}
          />
          <Button
            title="Your server"
            secondary={props.mode !== "supplied"}
            onPress={() => props.onMode("supplied")}
          />
          <Field
            value={props.apiDraft}
            onChangeText={props.onDraft}
            autoCapitalize="none"
            placeholder="https://api.example"
            accessibilityLabel="VoiceCraft API address"
          />
          <Button title="Save connection" onPress={props.onSave} />
          <Note>Local developer mode uses this computer on your private network.</Note>
          <Note>
            Community server mode uses HTTPS. You can pair and revoke your device. You cannot
            administer their world from this phone.
          </Note>
          <Note>Your server mode is for a Minecraft host you control.</Note>
        </GlowCard>
      </View>
    </ScrollView>
  );
}

function JobCard({ job, onCancel }: { job: CloudJob; onCancel: () => void }) {
  const active =
    job.status === "queued" || job.status === "building" || job.status === "cancelling";
  return (
    <GlowCard>
      <Text style={styles.cardTitle}>{job.status}</Text>
      <Note>
        {job.confirmed} confirmed · {job.failed} failed · {job.total} planned
      </Note>
      {job.error ? <Note>{job.error}</Note> : null}
      {active ? <Button title="Cancel build" danger onPress={onCancel} /> : null}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: c.background,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: c.background,
  },
  auth: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  brand: { color: c.text, fontSize: 28, fontWeight: "800" },
  hero: { color: c.text, fontSize: 34, fontWeight: "800" },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  sub: { color: c.muted, lineHeight: 20 },
  pad: { gap: 12, padding: 16 },
});
