import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { loginRequest } from "../api/client";
import { useAuthStore } from "../store/auth-store";
import { theme } from "../theme";

export function LoginScreen() {
  const [email, setEmail] = useState("demo@samasama.local");
  const [password, setPassword] = useState("password123");
  const [localError, setLocalError] = useState<string | null>(null);

  const isAuthenticating = useAuthStore((state) => state.isAuthenticating);
  const authError = useAuthStore((state) => state.authError);
  const setAuthenticating = useAuthStore((state) => state.setAuthenticating);
  const setAuthError = useAuthStore((state) => state.setAuthError);
  const setSession = useAuthStore((state) => state.setSession);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLocalError("Enter both email and password.");
      return;
    }

    setLocalError(null);
    setAuthError(null);
    setAuthenticating(true);

    try {
      const response = await loginRequest({
        email: email.trim(),
        password
      });

      setSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user
      });
    } catch (error) {
      setAuthenticating(false);
      setAuthError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.keyboardContainer}
      >
        <View style={styles.hero}>
          <View style={styles.orb} />
          <Text style={styles.eyebrow}>Samasama V1</Text>
          <Text style={styles.title}>Learn the shell. Ship the loop.</Text>
          <Text style={styles.subtitle}>
            Sign in to view the seeded curriculum and lesson detail screens.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Login</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="demo@samasama.local"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="password123"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <Pressable
            disabled={isAuthenticating}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
              isAuthenticating ? styles.buttonDisabled : null
            ]}
          >
            <Text style={styles.buttonText}>
              {isAuthenticating ? "Signing in..." : "Sign in"}
            </Text>
          </Pressable>

          <Text style={styles.hint}>Seeded account: demo@samasama.local / password123</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "space-between",
    padding: theme.spacing.lg
  },
  hero: {
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm
  },
  orb: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    marginBottom: theme.spacing.sm
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: theme.colors.accent,
    fontWeight: "700"
  },
  title: {
    fontSize: theme.typography.title,
    lineHeight: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 23,
    maxWidth: 360
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    shadowColor: theme.colors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8
    },
    elevation: 5
  },
  cardTitle: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  fieldGroup: {
    gap: theme.spacing.xs
  },
  label: {
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  input: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: "center"
  },
  buttonPressed: {
    opacity: 0.9
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: theme.typography.body
  },
  errorText: {
    color: theme.colors.danger
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  }
});
