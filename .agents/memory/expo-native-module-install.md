---
name: Installing Expo native modules in this pnpm monorepo
description: Why `expo install` fails here and how to add an Expo-compatible native module correctly.
---

# Installing Expo native modules (pnpm monorepo)

`pnpm --filter @workspace/<app> exec expo install <pkg>` FAILS in this repo:
`expo install` shells out to **npm**, whose resolver hits ERESOLVE on the
workspace's peer-dep graph (e.g. react-native wants react@19 but react@18 is
pinned).

**How to apply:** look up the SDK-pinned version in
`artifacts/<app>/node_modules/expo/bundledNativeModules.json`, then install with
pnpm directly:
`pnpm --filter @workspace/<app> add <pkg>@<version>`.

Example: for Expo SDK 54, `@react-native-community/datetimepicker` is `8.4.4`.

**Why:** pnpm satisfies the existing caret ranges and skips npm's strict peer
resolution, so the install succeeds and the version stays Expo-compatible.
