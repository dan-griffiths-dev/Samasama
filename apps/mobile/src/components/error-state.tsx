import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Try again"
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm
  },
  title: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.danger
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  }
});
