import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SamasamaLessonSummaryDto } from "@samasama/shared";

import { fetchLessonsRequest } from "../api/client";
import { ErrorState } from "../components/error-state";
import { LoadingState } from "../components/loading-state";
import { useAuthStore } from "../store/auth-store";
import { theme } from "../theme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Lessons">;

export function LessonsScreen({ navigation }: Props) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [lessons, setLessons] = useState<SamasamaLessonSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchLessonsRequest(accessToken);
      setLessons(response.lessons);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lessons");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  if (isLoading) {
    return <LoadingState label="Loading lessons..." />;
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Lessons</Text>
          <Text style={styles.subtitle}>
            {user ? `Signed in as ${user.displayName}` : "Anonymous viewer"}
          </Text>
        </View>
        <Pressable onPress={clearSession} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.content}>
          <ErrorState
            title="Could not load lessons"
            message={error}
            onRetry={() => {
              void loadLessons();
            }}
          />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={lessons}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("LessonDetail", {
                  lessonId: item.id,
                  lessonTitle: item.title
                })
              }
              style={({ pressed }) => [
                styles.card,
                pressed ? styles.cardPressed : null
              ]}
            >
              <View style={styles.badgeRow}>
                <Text style={styles.stageBadge}>{item.stage}</Text>
                <Text style={styles.statusBadge}>
                  {item.unlockMetadata?.status ?? "NO_SESSION"}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>
                {item.description ?? "No description yet."}
              </Text>
              <Text style={styles.cardMeta}>
                {item.exerciseCount} exercises
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  signOutButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  signOutText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  content: {
    padding: theme.spacing.lg
  },
  listContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  cardPressed: {
    opacity: 0.88
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  stageBadge: {
    color: theme.colors.accent,
    fontWeight: "800"
  },
  statusBadge: {
    color: theme.colors.success,
    fontWeight: "700"
  },
  cardTitle: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    lineHeight: 21
  },
  cardMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  }
});
