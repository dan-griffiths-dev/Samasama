import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SamasamaLessonDetailDto } from "@samasama/shared";

import { fetchLessonDetailRequest } from "../api/client";
import { ErrorState } from "../components/error-state";
import { LoadingState } from "../components/loading-state";
import { useAuthStore } from "../store/auth-store";
import { theme } from "../theme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "LessonDetail">;

export function LessonDetailScreen({ navigation, route }: Props) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [lesson, setLesson] = useState<SamasamaLessonDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLesson = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchLessonDetailRequest({
        lessonId: route.params.lessonId,
        accessToken
      });
      setLesson(response.lesson);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lesson");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, route.params.lessonId]);

  useEffect(() => {
    void loadLesson();
  }, [loadLesson]);

  if (isLoading) {
    return <LoadingState label="Loading lesson detail..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {error || !lesson ? (
          <ErrorState
            title="Could not load lesson"
            message={error ?? "Lesson not found."}
            onRetry={() => {
              void loadLesson();
            }}
          />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.stage}>{lesson.stage}</Text>
              <Text style={styles.title}>{lesson.title}</Text>
              <Text style={styles.description}>
                {lesson.description ?? "No description yet."}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Unlock state</Text>
              <Text style={styles.sectionBody}>
                Status: {lesson.unlockMetadata?.status ?? "NO_SESSION"}
              </Text>
              <Text style={styles.sectionBody}>
                Completed: {lesson.unlockMetadata?.isCompleted ? "Yes" : "No"}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prerequisites</Text>
              {lesson.prerequisiteLessons.length === 0 ? (
                <Text style={styles.sectionBody}>No prerequisites.</Text>
              ) : (
                lesson.prerequisiteLessons.map((item) => (
                  <View key={item.lessonId} style={styles.exerciseCard}>
                    <Text style={styles.exerciseTitle}>{item.lessonCode}</Text>
                    <Text style={styles.exerciseBody}>{item.lessonTitle}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              {lesson.exercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() =>
                    navigation.navigate("Exercise", {
                      lessonId: route.params.lessonId,
                      exerciseId: exercise.id,
                      lessonTitle: lesson.title,
                      exerciseCode: exercise.code
                    })
                  }
                  style={({ pressed }) => [
                    styles.exerciseCard,
                    pressed ? styles.exerciseCardPressed : null
                  ]}
                >
                  <Text style={styles.exerciseTitle}>{exercise.code}</Text>
                  <Text style={styles.exerciseBody}>{exercise.promptText}</Text>
                  <Text style={styles.exerciseMeta}>{exercise.exerciseKind}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg
  },
  hero: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  stage: {
    color: theme.colors.accent,
    fontWeight: "800"
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  description: {
    color: theme.colors.textSecondary,
    lineHeight: 22
  },
  section: {
    gap: theme.spacing.sm
  },
  sectionTitle: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  sectionBody: {
    color: theme.colors.textSecondary
  },
  exerciseCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  exerciseCardPressed: {
    opacity: 0.86
  },
  exerciseTitle: {
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  exerciseBody: {
    color: theme.colors.textSecondary
  },
  exerciseMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  }
});
