# Crafty Command

Act as an expert full-stack software architect, UI/UX designer, and Node.js game automation engineer. 

I want to build a complete web platform and desktop bridge for a Minecraft voice-controlled automation system. Users should be able to visit the website, download the local companion software, and use a futuristic dashboard to control Minecraft builds via voice commands (e.g., "build me a mansion").

Please help me architect and code the following three core pillars:

### 1. Futuristic Public Landing Page & Download Hub

- **Design:** Clean, dark-mode futuristic aesthetic with smooth animations (Tailwind CSS, subtle glow effects, glassmorphism).

- **Features:** A clear hero section explaining the voice automation concept, an interactive preview of the dashboard, and a direct download link for the user's local bridge software.

### 2. Voice-Activated Control Dashboard

- **Design:** Sleek dark UI control center with real-time status indicators.

- **Features:** 

  - Voice recording/speech-to-text integration (via browser Web Speech API or local audio streaming).

  - Command execution log (showing translation from speech like "build a mansion" into structured building instructions).

  - Quick-action templates and status feedback (Connected, Building, Idle, Error).

### 3. Local Bridge & Minecraft Integration (JavaScript/Node.js)

- **Architecture:** A downloadable companion script/app that runs locally on the user's machine where Minecraft Java Edition is installed.

- **Integration:** 

  - Connects to the local Minecraft game instance using **Mineflayer** (Node.js Minecraft bot framework).

  - Receives parsed voice commands from the web dashboard (via WebSocket or local polling).

  - Implements procedural building algorithms that translate high-level commands (e.g., "mansion") into automated block placement routines inside the game.

Let's start by designing the project structure and writing the initial code for the landing page UI and the core Mineflayer integration script.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/39d2951c-8adb-440f-b598-47437cb660b0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
