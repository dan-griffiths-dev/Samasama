import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body
  }
});
