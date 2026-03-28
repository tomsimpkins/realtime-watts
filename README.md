# Realtime Watts

Desktop-first smart trainer wattage dashboard built with React, TypeScript, Redux Toolkit, Mantine, Vite, and Bun.

## What it does

- Connects to a Bluetooth smart trainer from the browser UI
- Subscribes to the standard Cycling Power Measurement characteristic
- Decodes instantaneous power in watts
- Renders a large live wattage display with status, diagnostics, and a rolling chart
- Handles disconnects without requiring a full page reload
- Supports a `?simulate=1` mode for UI development without hardware

## Local development

Install dependencies with Bun:

```bash
bun install
```

Start the local dev server:

```bash
bun run dev
```

Run unit tests:

```bash
bun run test
```

Create a production build locally:

```bash
bun run build
```

## Hardware testing notes

- Use Chrome or Edge on desktop for Web Bluetooth support.
- Web Bluetooth requires a secure context.
- Local hardware testing should be done from the Bun dev server on `localhost`.
- Safari and Firefox are not supported targets for v1.
- If you need to work on the UI without a trainer nearby, open `http://localhost:5173/?simulate=1`.

## Production deployment

- Repository: `https://github.com/tomsimpkins/realtime-watts`
- Expected GitHub Pages URL: `https://tomsimpkins.github.io/realtime-watts/`
- Deployment happens automatically from pushes to the default branch through GitHub Actions.

### Local vs production usage

- Local development on `localhost` is the primary path for working with real trainer hardware.
- GitHub Pages exists to publish and share the app, and it is served over HTTPS.
- Production hosting is suitable for the UI and secure-context delivery, but trainer testing is still easiest and most reliable locally.

### GitHub Pages base-path caveat

Vite uses `VITE_BASE_PATH` during the deploy workflow so the built site works at the project Pages path `/realtime-watts/`. Local development and local builds default to `/`.

## Project structure

```text
src/
  App.tsx
  app/
    hooks.ts
    store.ts
  ble/
    trainerClient.ts
    uuids.ts
  components/
    ConnectionPanel.tsx
    DiagnosticsPanel.tsx
    PowerChart.tsx
    PowerDisplay.tsx
    StatusBanner.tsx
  domain/
    trainer.ts
  protocol/
    cyclingPower.ts
    cyclingPower.test.ts
  state/
    trainerSelectors.ts
    trainerSlice.ts
    trainerThunks.ts
  utils/
    environment.ts
    errors.ts
    ringBuffer.ts
```

## Deployment workflow

- `.github/workflows/ci.yml` runs tests and build checks.
- `.github/workflows/deploy.yml` builds the app with the repository base path and publishes `dist/` to GitHub Pages.

If GitHub Pages has not been enabled yet for the repository, set the Pages source to GitHub Actions in the repository settings.
