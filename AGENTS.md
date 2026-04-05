# Architecture Rules

## Layering

- `src/domain` contains core domain models and business rules.
- `src/application` contains application services and orchestration.
- `src/adapters` contains framework-facing and external-system adapters.
- `src/app` contains app bootstrap and composition.

## Dependency Rules

- Files in `src/domain` must not import from `src/adapters`, `src/app`, or UI component modules.
- Files in `src/application` may import from `src/domain`, but must not import React, Redux, Mantine, or router modules directly.
- Files in `src/adapters` may depend inward on `src/application` and `src/domain`.
- Files in `src/app` compose the application and may import from any layer.

## Practical Guidance

- Keep Bluetooth protocol and Web Bluetooth code in `src/adapters/bluetooth`.
- Keep Redux slices, thunks, and selectors in `src/adapters/state`.
- Keep React screens and components in `src/adapters/ui`.
- Prefer moving shared business concepts into `src/domain` rather than duplicating them in adapter code.
