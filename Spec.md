# Realtime Trainer Wattage App — Implementation Spec

## Overview

Build a desktop-first application that connects to a Bluetooth-enabled smart trainer (starting with Wahoo KICKR Core), subscribes to realtime power data, and displays the rider's current wattage with a low-latency live readout.

The first version should optimize for a short path to a working prototype:

* pair trainer from the app UI
* connect over Bluetooth Low Energy (BLE)
* subscribe to standard cycling power notifications
* decode instantaneous power in watts
* render the current wattage in realtime
* handle disconnects and reconnection attempts cleanly

This spec is intended for execution by an agentic coding app with minimal back-and-forth.

---

## Product Goal

## Delivery Priority

The very first delivery priority is to get this local-first web app into the user's personal GitHub account and set up automated deployment.

Target GitHub account:

* `tomsimpkins`
* Repository home: `https://github.com/tomsimpkins`

Delivery requirements:

* create the project in the user's personal GitHub account
* commit the initial scaffold and implementation to a dedicated repository under that account
* configure automatic deployment with GitHub Actions
* treat deployability as a first-class requirement from the beginning, not an afterthought
* include a README section explaining local development versus deployed production usage

Preferred deployment target for v1:

* GitHub Pages via GitHub Actions

Why this is the preferred default:

* free and simple for a static Vite-built web app
* easy to connect to a personal GitHub repository
* straightforward automatic deployment on push to the default branch
* suitable for a local-first app with no backend

Important deployment note:

* Deployed production hosting is primarily for publishing the app and making it easy to access and share
* Hardware access during development should still happen locally on `localhost` in a supported browser
* The deployed site must also be served over HTTPS because Web Bluetooth requires a secure context

## Product Goal

Deliver a working v1 that allows a user to:

1. Open the app on a laptop
2. Click a connect button
3. Select their trainer from a Bluetooth device picker
4. See a live wattage number update continuously while pedaling

Nice-to-have data in v1.1:

* cadence
* speed
* connection quality / status
* short rolling chart of recent watts
* session timer and simple recording

Out of scope for v1:

* ERG mode control
* workout builder
* user accounts
* cloud sync
* social / multiplayer features
* backend services

---

## Recommended Technical Approach

### Primary stack

* Frontend framework: React
* Language: TypeScript
* Package manager and runtime: Bun
* Dev server and bundling: Vite run via Bun
* Runtime target: desktop browser, preferably Chrome or Edge
* Bluetooth API: Web Bluetooth
* State management: Redux Toolkit
* Charting: lightweight SVG or Recharts
* Component library: Mantine as the default recommendation
* Storage: localStorage or IndexedDB for lightweight persisted settings/session history

### Why this stack

* Fastest route to working BLE prototype
* Keeps React thin and focused on rendering and transient UI state
* Redux Toolkit provides a predictable application-state boundary outside the view layer
* Bun gives a fast local developer workflow
* No backend required
* Standard browser UI primitives are sufficient for v1

### UI library guidance

Use a free component library, but do not let the library own application architecture.

Recommended choice:

* Mantine

Why Mantine is the default recommendation:

* free and MIT licensed
* strong dark mode support
* good fit for a polished, modern, dashboard-like sports UI
* accessible components without forcing a heavy visual identity
* works well when most of the screen is a custom numeric display and charting surface

Acceptable alternatives:

* shadcn/ui if the team wants open code and maximum control over styling
* MUI if the team prefers a very comprehensive ecosystem and is comfortable overriding the more recognisable Material look

Selection rule:

* Prefer Mantine for v1 unless there is already a strong internal preference for shadcn/ui
* Keep most of the trainer screen custom-built even when using a component library; use the library mainly for panels, buttons, alerts, drawers, menus, and layout primitives

### Architectural preference: thin UI

The implementation should be explicitly layered so React remains thin.

Principles:

* React components should primarily render state and dispatch intents
* Domain logic, BLE lifecycle, protocol parsing, and session state transitions should live outside React components
* Use React local state only for ephemeral UI concerns such as open panels, focus state, temporary form inputs, or chart hover state
* Application state, device state, and measurement history should live in Redux Toolkit slices/selectors
* Avoid embedding business logic inside view components or hooks that are tightly coupled to rendering

### Fallback path if browser BLE becomes unreliable

If Web Bluetooth is not stable enough on the target machine or OS, keep the code modular so the transport layer can later be replaced with:

* Tauri with native BLE access, or
* Electron with a desktop BLE bridge

Do not build the fallback path in v1. Just keep the architecture ready for it.

---

## Target Device Support

### Initial target device

* Wahoo KICKR Core

### Expected protocol support

Use Bluetooth standard services rather than vendor-specific integrations wherever possible.

Start with:

* Cycling Power Service (CPS)

Potential later expansion:

* Fitness Machine Service (FTMS)

### v1 requirement

The implementation must prioritize reading live power from the standard cycling power measurement characteristic.

---

## Functional Requirements

### FR1: Device discovery

The app must allow the user to initiate Bluetooth device selection from the UI.

Acceptance criteria:

* A visible `Connect Trainer` button is present
* Clicking the button triggers browser Bluetooth device selection
* The device request should filter for standard cycling-related BLE services where possible
* The chosen device name is shown in the UI after selection

### FR2: BLE connection

The app must connect to the selected trainer over BLE GATT.

Acceptance criteria:

* App connects to the device's GATT server
* App discovers the required primary service(s)
* App discovers the required measurement characteristic
* App shows connection state: `idle`, `requesting`, `connecting`, `connected`, `disconnecting`, `error`

### FR3: Realtime power stream

The app must subscribe to power notifications and decode current watts.

Acceptance criteria:

* Notifications are started successfully on the cycling power measurement characteristic
* Each incoming notification is parsed into a typed measurement object
* Current wattage is displayed within the main UI
* UI updates continuously while pedaling
* Invalid packets do not crash the app

### FR4: Disconnection handling

The app must detect unexpected disconnects.

Acceptance criteria:

* If the BLE device disconnects, the UI updates immediately to show disconnected state
* Current wattage resets to a safe value, preferably `--` or `0` depending on UX choice
* A reconnect action is available
* The app does not require a full page reload after a disconnect

### FR5: Error handling

The app must surface useful errors without overwhelming the user.

Acceptance criteria:

* Permission denied, unsupported browser, missing services, and connection failure are handled separately
* A visible human-readable status or error message is shown
* Technical details are logged to console for debugging

### FR6: Live UI readout

The app must show a clear, readable wattage value.

Acceptance criteria:

* Current power is the primary visual element
* Numeric display is large and readable at distance
* Connection status is always visible
* Device name is visible when connected

---

## Non-Functional Requirements

### NFR1: Latency

* UI should update as quickly as notifications arrive
* Parsing and rendering should feel realtime to the user
* Avoid excessive re-renders

### NFR2: Reliability

* Malformed payloads should be ignored safely
* Temporary UI errors should not break the connection manager
* Disconnect events must be handled deterministically

### NFR3: Maintainability

* Separate BLE transport, protocol decoding, state, and UI
* Avoid trainer-specific assumptions in the top-level UI
* Keep parser logic pure and testable

### NFR4: Simplicity

* No backend
* No authentication
* No unnecessary abstraction layers beyond clear module boundaries

---

## Proposed Architecture

Use four layers.

### 1. Transport layer

Responsible for Web Bluetooth interaction.

Responsibilities:

* request device
* connect to GATT server
* discover services/characteristics
* subscribe/unsubscribe to notifications
* emit raw binary packets
* handle disconnect events

Suggested module:

* `src/ble/trainerClient.ts`

Suggested interface:

* `requestAndConnect(): Promise<ConnectedTrainer>`
* `disconnect(): Promise<void>`
* `onDisconnected(callback)`
* `subscribeToPower(callback)`

### 2. Protocol decoding layer

Responsible for converting DataView payloads into typed domain measurements.

Responsibilities:

* decode cycling power measurement packets
* extract instantaneous power
* optionally extract cadence if present and understood
* ignore unsupported flags safely

Suggested module:

* `src/protocol/cyclingPower.ts`

Suggested types:

* `PowerMeasurement`
* `DecodeResult`

This layer should be pure and unit-testable.

### 3. Application state layer

Responsible for app state and session state.

Responsibilities:

* connection state
* selected device metadata
* latest power sample
* recent sample history for charts
* errors and messages
* async connection lifecycle actions

Suggested modules:

* `src/state/store.ts`
* `src/state/trainerSlice.ts`
* `src/state/trainerSelectors.ts`
* `src/state/trainerThunks.ts`

### 4. UI layer

Responsible for rendering and user interaction.

Responsibilities:

* connect/disconnect controls
* power readout
* status text
* optional mini-chart
* optional diagnostics panel

Suggested structure:

* `src/App.tsx`
* `src/components/PowerDisplay.tsx`
* `src/components/ConnectionPanel.tsx`
* `src/components/PowerChart.tsx`
* `src/components/StatusBanner.tsx`

---

## Domain Model

Define the following domain types.

```ts
export type ConnectionState =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error'

export interface TrainerDeviceInfo {
  id?: string
  name: string
}

export interface PowerMeasurement {
  timestamp: number
  watts: number
  cadenceRpm?: number
  source: 'cps'
}

export interface TrainerState {
  connectionState: ConnectionState
  device?: TrainerDeviceInfo
  latestPower?: PowerMeasurement
  recentPower: PowerMeasurement[]
  error?: string
}
```

---

## BLE Requirements

### Required service/characteristic targets

v1 should first attempt standard cycling power.

Target service:

* Cycling Power Service

Target characteristic:

* Cycling Power Measurement

Implementation notes:

* Use standard Web Bluetooth service/characteristic names if supported by the browser
* If needed, isolate UUID constants in one file so they can be updated without touching application logic

Suggested constants module:

* `src/ble/uuids.ts`

### Device selection behavior

Prefer a targeted device request over a broad scan.

Pseudo-approach:

* Request device filtered by `cycling_power` service
* Optionally include `fitness_machine` as an optional service for future use

### Event flow

1. User clicks `Connect Trainer`
2. App requests Bluetooth device
3. App connects to GATT server
4. App gets primary cycling power service
5. App gets cycling power measurement characteristic
6. App starts notifications
7. App listens for `characteristicvaluechanged`
8. App decodes payload and updates state
9. UI re-renders current watts

---

## Parsing Requirements

### Minimum parser support

The parser must correctly decode instantaneous power from the cycling power measurement payload.

Implementation guidance:

* Treat the parser as a pure function from `DataView` to `PowerMeasurement | null`
* Validate expected minimum length before reading bytes
* Handle little-endian integer decoding
* Respect flags rather than hardcoding too many assumptions
* If fields beyond watts are not yet supported, parse watts only and ignore the rest safely

Suggested function:

```ts
export function decodeCyclingPowerMeasurement(
  dataView: DataView,
  timestamp: number = Date.now()
): PowerMeasurement | null
```

### Parser behavior requirements

* Return `null` for invalid or unsupported packets
* Never throw on malformed notifications unless there is a programming bug
* Make it straightforward to extend parser support later

---

## State Management Requirements

Use Redux Toolkit for application state management.

Store responsibilities:

* hold connection state
* hold current device name
* hold current power
* maintain a recent rolling buffer of samples, for example last 30 to 120 seconds
* clear or reset state on disconnect

Suggested reducers/actions:

* `setConnectionState(state)`
* `setDevice(device)`
* `pushPowerSample(sample)`
* `setError(message)`
* `resetConnection()`

Suggested async orchestration:

* `requestTrainerDevice`
* `connectTrainer`
* `disconnectTrainer`
* `startPowerStream`

Performance requirement:

* Updates from BLE notifications should not trigger unnecessary full-app rerenders

---

## UI/UX Requirements

### Main screen layout

The initial screen can be a single-page layout with:

* top status area
* central large wattage display
* connect/disconnect controls
* optional recent trend chart
* optional diagnostic panel in a collapsible section

### Wattage display

Requirements:

* large numeric text
* label `Watts`
* fallback placeholder when no data available
* readable on a laptop placed a few feet away

### Connection status

Requirements:

* always visible
* distinguish `connected`, `connecting`, and `error`
* show selected device name

### Errors

Requirements:

* present short user-friendly messages in the main UI
* preserve technical detail in console logs

### Accessibility

Requirements:

* connect button keyboard accessible
* status communicated with text, not just color
* sufficient contrast for large numeric display

---

## Deployment Requirements

### Repository and hosting

The agent should prioritize repository setup and deployment automation early in the implementation.

Requirements:

* use a repository under the `tomsimpkins` GitHub account
* configure GitHub Actions-based deployment from the default branch
* configure GitHub Pages as the initial deployment target unless a better static-hosting reason is documented
* ensure Vite base path is set correctly if deploying to a project Pages URL of the form `https://tomsimpkins.github.io/<repo>/`

### CI/CD expectations

Minimum workflow expectations:

* install dependencies with Bun
* run build
* optionally run unit tests before deployment
* publish the built static site automatically through GitHub Actions

Suggested workflow files:

* `.github/workflows/deploy.yml`
* optionally `.github/workflows/ci.yml`

### README expectations

The README should include:

* local development commands using Bun
* supported browser notes
* Web Bluetooth secure-context notes
* deployment URL and deployment model
* any GitHub Pages base-path caveats

## Suggested File Structure

```text
src/
  App.tsx
  main.tsx
  app/
    store.ts
    hooks.ts
  ble/
    trainerClient.ts
    uuids.ts
  protocol/
    cyclingPower.ts
  state/
    trainerSlice.ts
    trainerSelectors.ts
    trainerThunks.ts
  components/
    ConnectionPanel.tsx
    PowerDisplay.tsx
    PowerChart.tsx
    StatusBanner.tsx
  utils/
    ringBuffer.ts
    errors.ts
```

---

## Browser and Platform Constraints

The app should be explicitly treated as desktop-first.

Known assumptions for v1:

* Secure context required for Web Bluetooth
* User gesture required for device request
* Browser must support Web Bluetooth
* Safari and Firefox are not target browsers for v1

Local development requirement:

* The implementation should support local hardware development on `localhost`
* `localhost` should be treated as the primary local development origin
* Do not require custom HTTPS certificates for the normal local development path unless the team later chooses to test on a non-localhost hostname or another device on the LAN
* The README should explicitly state that local testing with hardware should be done from a Bun-run local dev server on `localhost` in Chrome or Edge

Acceptance criteria:

* If Web Bluetooth is missing, show a message like `This app currently requires Chrome or Edge with Web Bluetooth support.`
* If the app is opened from an insecure non-local origin, show a message explaining that Web Bluetooth requires a secure context and that local development should use `localhost` or HTTPS

---

## Testing Requirements

### Unit tests

Add unit tests for protocol decoding.

Required coverage:

* valid packet with expected watts
* packet too short
* malformed packet
* flags combinations that are ignored safely

Suggested test target:

* `src/protocol/cyclingPower.test.ts`

### Manual integration test plan

Manual test cases:

1. Open app in supported browser
2. Click connect
3. Select Wahoo KICKR Core
4. Confirm connected state appears
5. Pedal trainer
6. Confirm watts update live
7. Stop pedaling
8. Confirm watts drop appropriately
9. Turn trainer off or move out of range
10. Confirm disconnect state appears without crash

### Optional simulator

If helpful, build a development-only mock data source so the UI can be developed without hardware present.

Suggested approach:

* feature flag or query param for simulated power stream
* emit sinusoidal or interval-like sample data

---

## Logging and Diagnostics

For v1, keep diagnostics simple.

Requirements:

* log connect/disconnect lifecycle events
* log discovered services/characteristics in development mode
* log parser failures only in development mode to avoid noisy console output

Optional diagnostics panel fields:

* browser support detected
* device name
* last packet timestamp
* sample count
* average watts over last 10 seconds

---

## Definition of Done

The task is complete when all of the following are true:

* repository is created under the user's personal GitHub account
* GitHub Actions deployment is configured and documented
* the app is published automatically from the repository
* app starts locally with standard frontend dev tooling
* user can connect to a Wahoo KICKR Core through browser Bluetooth UI
* app successfully subscribes to cycling power notifications
* current wattage is decoded and displayed live
* disconnects are handled without page refresh
* unsupported browsers show a clear message
* parser has basic unit tests
* code is modular enough to later add FTMS and trainer control

---

## V2: Multi-Screen App Flow Specification

### Overview

Evolve the app from a single-screen telemetry view into a guided, multi-step single-page application with three primary screens:

1. Connect (Trainer Setup)
2. Workout Selection
3. Ride (Workout Dashboard)

Navigation should be state-driven and enforce progression through the flow.

---

## App Navigation Model

### Routes

* `/connect`
* `/workouts`
* `/ride`

### Navigation Rules

* User cannot access `/workouts` until trainer setup is successful
* User cannot access `/ride` until a workout is selected
* If trainer disconnects during ride, remain on `/ride` and show degraded state

### App Flow State

```ts
export type AppScreen = 'connect' | 'workouts' | 'ride'
```

---

## Screen 1: Trainer Setup (Connect)

### Purpose

* Establish BLE connection
* Discover services and characteristics
* Infer trainer capabilities
* Present capabilities explicitly to the user

### UI Sections

1. Trainer Connection
2. Detected Capabilities
3. Primary Actions

### Capability Model

```ts
export type Capability =
  | 'power'
  | 'cadence'
  | 'speed'
  | 'resistanceControl'
  | 'ergMode'
  | 'simulationMode'

export type CapabilityStatus =
  | 'unknown'
  | 'checking'
  | 'available'
  | 'unavailable'

export interface TrainerCapabilities {
  power: boolean
  cadence: boolean
  speed: boolean
  resistanceControl: boolean
  ergMode: boolean
  simulationMode: boolean
}
```

### Behaviour

* On connect, transition capabilities from `unknown` → `checking`
* After service discovery, mark each capability
* Minimum requirement to proceed: `power === true`

### Visual States

* Unknown: muted/grey
* Checking: animated/amber
* Available: green
* Unavailable: dimmed

### Actions

* Connect Trainer
* Retry Setup
* Continue (enabled only when valid)

---

## Screen 2: Workout Selection

### Purpose

* Allow user to choose workout
* Abstract away BLE details

### Workout Options (v1)

1. Free Ride
2. 20 min x 2
3. Tabata

### Workout Model

```ts
export type WorkoutType = 'freeRide' | 'structured'

export interface WorkoutDefinition {
  id: string
  name: string
  type: WorkoutType
  durationSeconds: number
  description: string
  blocks: WorkoutBlock[]
}

export interface WorkoutBlock {
  id: string
  label: string
  durationSeconds: number
  target?: {
    kind: 'none' | 'ftpPercent' | 'watts'
    value?: number
  }
}
```

### Behaviour

* Selecting a workout sets active workout in state
* Navigates to `/ride`

---

## Screen 3: Ride (Workout Dashboard)

### Purpose

* Display live metrics
* Track workout progress
* Provide session controls

### UI Elements

* Current workout name
* Elapsed time
* Current interval/block
* Live power (primary)
* Optional cadence
* Recent power chart
* Controls: pause, end

### Removed Elements

* No BLE connection controls
* No device selection UI

### Behaviour

* Assumes active connection
* Handles disconnect gracefully with overlay/banner

---

## State Architecture Updates

### Trainer Slice

* connection state
* device info
* capabilities

### Workout Slice

* selected workout
* workout status
* current block index

### Metrics Slice

* latest power
* cadence
* history buffer

### App Slice

* current screen

---

## Capability Resolution Layer

Introduce a mapping layer:

* BLE services/characteristics → capabilities

Example:

```ts
function resolveCapabilities(services): TrainerCapabilities
```

This isolates BLE details from UI.

---

## UX Guidance

### Navigation Style

* Stepper or progress indicator preferred over generic tabs
* Show progression: Connect → Workout → Ride

### Color System

* Green: available / healthy
* Amber: in-progress
* Grey: unknown
* Red: error only

---

## Definition of Done (V2)

* App supports 3-screen flow
* Capability detection implemented and visualized
* Workout selection implemented
* Dashboard decoupled from connection UI
* Navigation rules enforced
* Redux slices updated to reflect new domains

---

## Stretch Goals After v1

* rolling averages
* cadence display
* FTMS support
* structured workout execution engine
