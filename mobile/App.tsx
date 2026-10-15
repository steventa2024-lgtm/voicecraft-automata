import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import type { Session } from '@supabase/supabase-js';
import { authConfigured, supabase } from './src/lib/supabase';
import {
  cloudConfigured,
  claimPairing,
  confirmPreview,
  requestPreview,
  transcribeAudio,
  type PairingResult,
  type PreviewResult,
} from './src/lib/cloud';
import { theme as c } from './src/theme';

type Tab = 'home' | 'build' | 'console' | 'library' | 'settings';
type Console = 'ps5' | 'xbox';

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={s.heading}><Text style={s.title}>{title}</Text><Text style={s.sub}>{subtitle}</Text></View>;
}

function Button({
  title, onPress, disabled = false, secondary = false, danger = false,
}: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button, secondary && s.buttonSecondary, danger && s.buttonDanger,
        disabled && s.buttonDisabled, pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: c.text }]}>{title}</Text>
    </Pressable>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      autoCorrect={false}
      placeholderTextColor={c.muted}
      style={[s.input, props.multiline && { height: 110, textAlignVertical: 'top' }, props.style]}
    />
  );
}

function Status({ label, good = false }: { label: string; good?: boolean }) {
  return <View style={s.status}><View style={[s.dot, { backgroundColor: good ? c.success : c.warning }]} /><Text style={s.statusText}>{label}</Text></View>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={s.note}>{children}</Text>;
}

function MainApp() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<Console>('ps5');
  const [pairCode, setPairCode] = useState('');
  const [paired, setPaired] = useState<PairingResult | null>(null);
  const [instruction, setInstruction] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [lastJob, setLastJob] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    if (!supabase) { setLoadingAuth(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    }).catch(() => setLoadingAuth(false));
    const listener = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.data.subscription.unsubscribe();
  }, []);

  async function authenticate() {
    if (!supabase || busy) return;
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter your email address and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = creating
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (creating && !result.data.session) Alert.alert('Check your email', 'Confirm your email address before signing in.');
    } catch (e) { Alert.alert('Authentication failed', errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function pair() {
    if (!cloudConfigured) {
      Alert.alert('Cloud not deployed', 'Configure the authenticated VoiceCraft Cloud API first. No console pairing was attempted.');
      return;
    }
    if (!/^[A-Z0-9]{6,8}$/.test(pairCode.trim().toUpperCase())) {
      Alert.alert('Invalid pairing code', 'Enter the 6–8 character code issued by an authorized VoiceCraft server.');
      return;
    }
    setBusy(true);
    try {
      const result = await claimPairing(pairCode.trim().toUpperCase(), platform);
      if (!result.worldId || !result.worldName) throw new Error('Invalid pairing response.');
      setPaired(result);
      setPreview(null);
      setLastJob(null);
      setTab('build');
    } catch (e) { Alert.alert('Pairing failed', errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function plan() {
    if (!paired || !instruction.trim() || busy) return;
    setBusy(true);
    setPreview(null);
    try {
      const result = await requestPreview(paired.worldId, instruction.trim());
      if (!result.previewId || result.requiresConfirmation !== true) throw new Error('Invalid or unsafe preview response.');
      setPreview(result);
    } catch (e) { Alert.alert('Preview failed', errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!preview || !paired || busy) return;
    setBusy(true);
    try {
      const job = await confirmPreview(preview.previewId);
      if (!job.jobId) throw new Error('Server did not return a job ID.');
      setLastJob(job.jobId);
      setPreview(null);
      Alert.alert('Build requested', 'The cloud accepted this build job. In-world status verification is still required.');
    } catch (e) { Alert.alert('Build not authorized', errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function toggleVoice() {
    if (busy) return;
    if (recorderState.isRecording) {
      setBusy(true);
      try {
        await recorder.stop();
        if (!recorder.uri) throw new Error('No audio file was recorded.');
        const text = await transcribeAudio(recorder.uri);
        setInstruction(text);
        setPreview(null);
        Alert.alert('Voice transcribed', 'Review the text and request a preview. Your audio did not trigger a build.');
      } catch (e) { Alert.alert('Voice transcription unavailable', errorMessage(e)); }
      finally { setBusy(false); }
      return;
    }
    if (!cloudConfigured) {
      Alert.alert('Cloud not deployed', 'Voice transcription requires the VoiceCraft Cloud API. Typed instructions can be drafted offline.');
      return;
    }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone permission is required.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) { Alert.alert('Recording unavailable', errorMessage(e)); }
  }

  if (loadingAuth) return <View style={s.center}><ActivityIndicator color={c.blue} /><Text style={s.sub}>Loading VoiceCraft...</Text></View>;

  if (!authConfigured || !session) {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.authWrap}>
          <Text style={s.brand}>ZERO<Text style={{ color: c.blue }}>PULSE</Text></Text>
          <Text style={s.hero}>VOICECRAFT</Text>
          <Text style={s.heroCaption}>CONSOLE COMPANION</Text>
          <Card>
            <Text style={s.cardTitle}>{authConfigured ? (creating ? 'Create your account' : 'Sign in') : 'Setup required'}</Text>
            {!authConfigured ? (
              <Note>Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in mobile/.env to connect your existing ZeroPulse account. See mobile/README.md.</Note>
            ) : (
              <>
                <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" accessibilityLabel="Email address" />
                <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" accessibilityLabel="Password" />
                <Button title={busy ? 'Please wait...' : creating ? 'Create account' : 'Sign in'} disabled={busy} onPress={authenticate} />
                <Button title={creating ? 'I already have an account' : 'Create an account'} secondary onPress={() => setCreating(!creating)} />
              </>
            )}
          </Card>
          <Note>VoiceCraft uses your existing ZeroPulse identity. Minecraft console integration requires an authorized cloud server.</Note>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={s.flex}>
      <View style={s.header}>
        <View><Text style={s.headerBrand}>ZEROPULSE <Text style={{ color: c.blue }}>VOICECRAFT</Text></Text><Text style={s.headerCaption}>MOBILE COMPANION  /  EARLY ACCESS</Text></View>
        <View style={s.avatar}><Text style={s.avatarText}>{(session.user.email || 'U').charAt(0).toUpperCase()}</Text></View>
      </View>
      <ScrollView style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tab === 'home' && (
          <>
            <Heading title="Command Center" subtitle="Console building, controlled from your phone." />
            <Card>
              <Text style={s.eyebrow}>CONNECTION STATUS</Text>
              <Status label={cloudConfigured ? 'Cloud URL configured — connection not verified' : 'VoiceCraft Cloud not deployed'} />
              <Status label={paired ? 'Paired to ' + paired.worldName : 'No Minecraft world paired'} good={Boolean(paired)} />
              <Status label="ZeroPulse account signed in" good />
              <Button title={paired ? 'Open Build Studio' : 'Set Up Console'} onPress={() => setTab(paired ? 'build' : 'console')} />
            </Card>
            <Card>
              <Text style={s.cardTitle}>Build from anywhere</Text>
              <Text style={s.body}>Play Minecraft on PS5 or Xbox. VoiceCraft Mobile sends authenticated building requests to the cloud host, never to an unprotected pairing-code relay.</Text>
              <View style={s.row}><Text style={s.pill}>PS5</Text><Text style={s.pill}>XBOX</Text><Text style={s.pill}>iOS + ANDROID</Text></View>
            </Card>
            <Card>
              <Text style={s.cardTitle}>Quick start</Text>
              <Text style={s.body}>1. Join a supported VoiceCraft Minecraft server.</Text>
              <Text style={s.body}>2. Pair your account and console player.</Text>
              <Text style={s.body}>3. Speak or type a building request.</Text>
              <Text style={s.body}>4. Review and confirm the blueprint.</Text>
            </Card>
          </>
        )}

        {tab === 'console' && (
          <>
            <Heading title="Connect Console" subtitle="Pair your Bedrock player with VoiceCraft Cloud." />
            <Card>
              <Text style={s.eyebrow}>CHOOSE PLATFORM</Text>
              <View style={s.row}>
                <Pressable onPress={() => setPlatform('ps5')} style={[s.choice, platform === 'ps5' && s.choiceActive]}><Text style={s.choiceText}>PlayStation 5</Text></Pressable>
                <Pressable onPress={() => setPlatform('xbox')} style={[s.choice, platform === 'xbox' && s.choiceActive]}><Text style={s.choiceText}>Xbox</Text></Pressable>
              </View>
              <Text style={s.cardTitle}>Pairing code</Text>
              <Input value={pairCode} onChangeText={setPairCode} autoCapitalize="characters" maxLength={8} placeholder="Server-issued code" accessibilityLabel="Pairing code" />
              <Button title={busy ? 'Pairing...' : 'Verify & Pair'} disabled={busy || !cloudConfigured} onPress={pair} />
              {!cloudConfigured && <Note>Pairing is unavailable until the authenticated cloud host is implemented and configured.</Note>}
            </Card>
            <Card>
              <Text style={s.cardTitle}>How to join</Text>
              <Text style={s.body}>1. Open Minecraft Bedrock on your console.</Text>
              <Text style={s.body}>2. Join an authorized VoiceCraft-enabled server. Consoles may require a phone-based LAN discovery helper.</Text>
              <Text style={s.body}>3. Follow the server's account-linking instructions.</Text>
              <Text style={s.body}>4. Enter the short-lived pairing code above.</Text>
              <Note>Pairing is for an authorized cloud world; it cannot directly edit your console's existing single-player worlds.</Note>
            </Card>
            {paired && <Card><Text style={s.cardTitle}>{paired.worldName}</Text><Status label="Server accepted pairing" good /><Button title="Open Build Studio" onPress={() => setTab('build')} /></Card>}
          </>
        )}

        {tab === 'build' && (
          <>
            <Heading title="Build Studio" subtitle="Speak it. Preview it. Build it." />
            <Card>
              <Status label={paired ? 'Target: ' + paired.worldName : 'Connect to a console world first'} good={Boolean(paired)} />
              <Text style={s.cardTitle}>Describe your build</Text>
              <Input value={instruction} onChangeText={(text) => { setInstruction(text); setPreview(null); }} multiline placeholder="Build a medieval castle with four corner towers..." accessibilityLabel="Build instruction" />
              <Button title={recorderState.isRecording ? '■ Stop & Transcribe' : '🎙 Record Voice Command'} secondary disabled={busy} onPress={toggleVoice} />
              {recorderState.isRecording && <Status label="Recording microphone audio now" />}
              <Button title={busy ? 'Processing...' : 'Generate Safe Preview'} disabled={busy || !paired || !instruction.trim()} onPress={plan} />
              {!paired && <Note>Pair a cloud world in the Console tab before sending build commands.</Note>}
            </Card>
            {preview && (
              <Card>
                <Text style={s.eyebrow}>AWAITING YOUR APPROVAL</Text>
                <Text style={s.cardTitle}>{preview.summary}</Text>
                <Text style={s.body}>Estimated blocks: {preview.estimatedBlocks}</Text>
                <Note>Confirming will authorize a real world modification. The server must re-check permissions and usage limits.</Note>
                <Button title={busy ? 'Requesting...' : 'Confirm Build'} disabled={busy} onPress={approve} />
                <Button title="Cancel Preview" secondary onPress={() => setPreview(null)} />
              </Card>
            )}
            {lastJob && <Card><Text style={s.cardTitle}>Build request submitted</Text><Note>Job ID: {lastJob}</Note><Note>Real-time progress requires the cloud job-status endpoint; it is not simulated.</Note></Card>}
          </>
        )}

        {tab === 'library' && (
          <>
            <Heading title="Blueprint Library" subtitle="Your saved structures and future builds." />
            <Card><Text style={s.cardTitle}>No blueprints loaded</Text><Text style={s.body}>This section will display real blueprints once the authenticated cloud library API is implemented.</Text><Note>No fabricated examples or completion statuses are shown.</Note></Card>
          </>
        )}

        {tab === 'settings' && (
          <>
            <Heading title="Settings" subtitle="Account, cloud configuration, and privacy." />
            <Card><Text style={s.cardTitle}>Account</Text><Text style={s.body}>{session.user.email || 'Signed-in user'}</Text><Button title="Sign out" danger onPress={async () => { await supabase?.auth.signOut(); setPaired(null); setPreview(null); setLastJob(null); }} /></Card>
            <Card><Text style={s.cardTitle}>Service Configuration</Text><Status label={authConfigured ? 'Supabase authentication configured' : 'Supabase missing'} good={authConfigured} /><Status label={cloudConfigured ? 'Cloud API URL configured' : 'Cloud API not configured'} good={cloudConfigured} /><Note>Mobile public environment values are bundled with the app. Never include service-role keys or server-side runner tokens.</Note></Card>
            <Card><Text style={s.cardTitle}>Voice Privacy</Text><Text style={s.body}>Voice recording begins only when you tap the recording button. Audio is uploaded for transcription only when you tap stop, and is never interpreted as build approval.</Text></Card>
          </>
        )}
      </ScrollView>
      <View style={s.tabs}>
        {([
          ['home', '⌂', 'Home'],
          ['build', '◇', 'Build'],
          ['console', '▣', 'Console'],
          ['library', '▤', 'Library'],
          ['settings', '⚙', 'Settings'],
        ] as const).map(([key, symbol, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} style={s.tab}>
            <Text style={[s.tabIcon, tab === key && s.tabActive]}>{symbol}</Text>
            <Text style={[s.tabLabel, tab === key && s.tabActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error. Try again.';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <MainApp />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.border },
  headerBrand: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  headerCaption: { color: c.muted, fontSize: 9, marginTop: 6, letterSpacing: 1.5 },
  avatar: { backgroundColor: c.blueDeep, height: 38, width: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  avatarText: { color: c.text, fontSize: 18, fontWeight: '800' },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  heading: { marginVertical: 8, gap: 6 },
  title: { fontSize: 27, fontWeight: '800', letterSpacing: -0.6, color: c.text },
  sub: { color: c.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 18, borderRadius: 20, gap: 13 },
  cardTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
  eyebrow: { color: c.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  body: { color: c.text, fontSize: 13, lineHeight: 22 },
  note: { color: c.muted, fontSize: 12, lineHeight: 19 },
  input: { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1, color: c.text, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  button: { minHeight: 48, backgroundColor: c.blueDeep, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 },
  buttonDanger: { backgroundColor: '#652735' },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { color: c.blue, backgroundColor: c.surfaceAlt, fontSize: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: c.muted, fontSize: 12, flexShrink: 1 },
  choice: { flex: 1, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, padding: 16, borderRadius: 13, alignItems: 'center' },
  choiceActive: { borderColor: c.blue, backgroundColor: '#17395A' },
  choiceText: { color: c.text, fontWeight: '700', fontSize: 13 },
  tabs: { borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, paddingBottom: 7 },
  tab: { alignItems: 'center', gap: 3, minWidth: 53 },
  tabIcon: { color: c.muted, fontSize: 22 },
  tabLabel: { color: c.muted, fontSize: 10, fontWeight: '600' },
  tabActive: { color: c.blue },
  authWrap: { padding: 26, flexGrow: 1, justifyContent: 'center', gap: 18 },
  brand: { color: c.text, fontSize: 19, fontWeight: '800', letterSpacing: 5 },
  hero: { color: c.text, fontSize: 38, fontWeight: '900', letterSpacing: 1.5 },
  heroCaption: { color: c.blue, fontSize: 12, letterSpacing: 3, fontWeight: '800', marginBottom: 15 },
});