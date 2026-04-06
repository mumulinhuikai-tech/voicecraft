# VoiceCraft — AI Speech Generator

A mobile-first web app for generating expressive, natural-sounding speech — optimized for Chinese and English, with voice cloning support.

## What It Does

- Convert text to speech in a style close to your own voice
- Select from 7 emotion styles (calm, warm, serious, joyful, sad, excited, encouraging)
- Control speed (0.5× – 2.0×) and expressiveness
- Upload reference audio samples to clone your voice
- Preview, replay, and download generated audio
- View and restore generation history

Designed for sermon-style, storytelling, and spoken-presentation reading in both Chinese and English.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| TTS Provider | ElevenLabs (swappable) |
| Storage | Local JSON file (MVP) |
| Audio output | MP3 (saved to `public/generated/`) |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add:

```
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=your_default_voice_id_here
```

- **API Key**: Get it from [elevenlabs.io](https://elevenlabs.io) → Profile → API Key
- **Voice ID**: Find voice IDs in your ElevenLabs voice library, or leave blank to use the default Sarah voice

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000/voice](http://localhost:3000/voice)

---

## Provider Architecture

The TTS layer is fully abstracted. All providers implement a single interface:

```typescript
// lib/tts/types.ts
interface TTSProviderInterface {
  generateSpeech(options: GenerateOptions): Promise<GenerateResult>
  createVoiceProfile(name, audioFiles): Promise<VoiceProfile>
  listVoices(): Promise<Voice[]>
}
```

### How to switch providers

1. Create `lib/tts/cartesia.ts` implementing `TTSProviderInterface`
2. Add a `case 'cartesia'` in `lib/tts/provider.ts`
3. Add `CARTESIA_API_KEY` to `.env.local`
4. Pass `providerName: 'cartesia'` in API requests

The rest of the app is untouched.

---

## Chinese Text Processing

Chinese text goes through a preprocessing pipeline before generation:

| Step | File | What it does |
|------|------|-------------|
| Language detection | `lib/text/chinese.ts` | Detects zh / en / mixed |
| Normalization | `lib/text/chinese.ts` | Normalizes full-width chars, spaces |
| Pause insertion | `lib/text/chinese.ts` | Adds spacing after 。！？ for rhythm |
| Segmentation | `lib/text/chinese.ts` | Splits on Chinese punctuation |
| Chunking | `lib/text/chinese.ts` | Splits long text into ≤2000 char chunks |
| Preprocessing entry | `lib/text/preprocess.ts` | Main pipeline orchestrator |

### Extension points (future)

- Add SSML break tags for more precise pause timing
- Phrase emphasis via custom markup
- Sermon/teaching cadence presets as `emotionPreset` objects
- Polyphone disambiguation lookup table

---

## Emotion System

Emotions map to ElevenLabs voice settings via `lib/text/emotion-mapping.ts`:

| Emotion | Stability | Style | Effect |
|---------|-----------|-------|--------|
| Calm | 0.75 | 0.15 | Stable, composed |
| Warm | 0.65 | 0.30 | Friendly, sincere |
| Serious | 0.85 | 0.10 | Authoritative |
| Joyful | 0.45 | 0.60 | Upbeat, cheerful |
| Sad | 0.70 | 0.35 | Soft, sorrowful |
| Excited | 0.35 | 0.75 | Energetic |
| Encouraging | 0.55 | 0.45 | Uplifting |

Expressiveness (0–1) scales style intensity. Higher expressiveness = more dramatic.

---

## Project Structure

```
app/
  voice/page.tsx              # Main TTS app page
  api/tts/
    generate/route.ts         # POST: generate speech
    history/route.ts          # GET/DELETE: history management
    voice-profile/route.ts    # POST/GET: voice profile + cloning

components/voice/
  EmotionSelector.tsx
  SliderControl.tsx
  ReferenceAudioUpload.tsx
  AudioPlayer.tsx
  HistoryList.tsx
  VoiceIdInput.tsx

lib/
  tts/
    types.ts                  # TTSProviderInterface
    provider.ts               # Factory: getProvider()
    elevenlabs.ts             # ElevenLabs implementation
  text/
    preprocess.ts             # Main preprocessing pipeline
    chinese.ts                # Chinese segmentation + normalization
    emotion-mapping.ts        # Emotion to voice settings map
  storage/
    history.ts                # JSON-based history persistence

types/
  tts.ts                      # Shared TypeScript types

data/
  history.json                # Auto-created on first generation

public/generated/
  *.mp3                       # Auto-created audio files
```

---

## API Routes

All TTS requests go through server-side routes. API keys are never exposed to the client.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/tts/generate` | POST | Generate speech from text |
| `/api/tts/history` | GET | Get generation history |
| `/api/tts/history?id=:id` | DELETE | Delete one history item |
| `/api/tts/history?id=all` | DELETE | Clear all history |
| `/api/tts/voice-profile` | POST | Create cloned voice profile |
| `/api/tts/voice-profile` | GET | List available voices |

---

## MVP Limitations

| Feature | Status |
|---------|--------|
| ElevenLabs TTS generation | Implemented |
| Emotion-mapped voice settings | Implemented |
| Chinese text preprocessing | Implemented |
| Speed control | ElevenLabs v1 API has no direct speed param; slider is in UI and stored in history, provider support pending |
| Voice cloning via reference upload | Implemented (requires ElevenLabs paid plan) |
| History persistence | Implemented (JSON file) |
| Style imitation from reference audio | Architecture prepared; not yet implemented |
| SSML / pause tags | Architecture prepared; plain text used |
| Long text chunking + stitching | Architecture prepared; single-chunk MVP |
| Multi-provider support | Architecture prepared; ElevenLabs only |

---

## Manual Configuration Needed

1. **ElevenLabs API key** — Add to `.env.local` before running
2. **Voice ID** — Find a voice in ElevenLabs voice library and set `ELEVENLABS_VOICE_ID`
3. **Voice cloning** — Requires ElevenLabs paid plan (Creator tier or above)
4. **`data/` and `public/generated/`** — Created automatically on first use; add to `.gitignore` if needed

---

## Future Upgrade Path

1. **Speed control**: When ElevenLabs adds native speed, add `speed` to the request body in `lib/tts/elevenlabs.ts`
2. **SSML pauses**: Extend `lib/text/chinese.ts → insertChinesePauses()` to emit SSML `<break>` tags
3. **Long text**: Use `chunkText()` + concatenate audio buffers in the generate route
4. **Style imitation**: Add `analyzeReferenceStyle()` to extract pace/tone and pass to `GenerateOptions`
5. **SQLite history**: Swap `lib/storage/history.ts` with a `better-sqlite3` adapter, same interface
6. **Second provider**: Implement `lib/tts/cartesia.ts` and add it to `lib/tts/provider.ts`
