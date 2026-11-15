Sets the preferred light or dark appearance for the nearest presentation. `Navigation.present` also updates the presented controller's appearance; pairing it with `environments.colorScheme` is unnecessary. Omit the property to inherit the system or presenting host's appearance.

```ts
preferredColorScheme?: "light" | "dark"
```

```tsx
<NavigationStack preferredColorScheme="dark">
  <List>
    <Text>Dark presentation</Text>
  </List>
</NavigationStack>
```

An explicit outer preference overrides descendant requests. Dark wins conflicting sibling requests. Sheets, popovers, fullScreenCover and other `Navigation.present` calls have independent presentation boundaries and do not change the parent behind them.

Use `environments={{ colorScheme: "dark" }}` for a local subtree override. Read the local value with `EnvironmentValuesReader`; `useColorScheme()` subscribes to script root appearance events, rather than a subtree's local override.
