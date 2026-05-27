import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  SamasamaCreateAttemptResponse,
  SamasamaExerciseDto,
  SamasamaLessonDetailDto
} from "@samasama/shared";

import { createAttemptRequest, fetchLessonDetailRequest } from "../api/client";
import { ErrorState } from "../components/error-state";
import { LoadingState } from "../components/loading-state";
import { feedbackMessages } from "../constants/feedback-messages";
import { useAuthStore } from "../store/auth-store";
import { theme } from "../theme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Exercise">;

const PLACEHOLDER_TRANSCRIPT = "A";
const PLACEHOLDER_MEDIA_PATH = "mobile-placeholder://recordings/demo-a.wav";

export function ExerciseScreen({ route }: Props) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [lesson, setLesson] = useState<SamasamaLessonDetailDto | null>(null);
  const [exercise, setExercise] = useState<SamasamaExerciseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<SamasamaCreateAttemptResponse | null>(null);

  const loadExercise = useCallback(async () => {
    if (!accessToken) {
      setLoadError("You must be signed in to open an exercise.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetchLessonDetailRequest({
        lessonId: route.params.lessonId,
        accessToken
      });
      const matchingExercise = response.lesson.exercises.find(
        (item) => item.id === route.params.exerciseId
      );

      if (!matchingExercise) {
        throw new Error("Exercise not found in lesson detail.");
      }

      setLesson(response.lesson);
      setExercise(matchingExercise);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load exercise.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, route.params.exerciseId, route.params.lessonId]);

  useEffect(() => {
    void loadExercise();
  }, [loadExercise]);

  const handleSubmit = async () => {
    if (!accessToken || !exercise) {
      setSubmitError("Exercise session is not ready.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await createAttemptRequest({
        accessToken,
        exerciseId: exercise.id,
        transcript: PLACEHOLDER_TRANSCRIPT,
        mediaPath: PLACEHOLDER_MEDIA_PATH
      });

      setAttemptResult(response);
      setIsRecording(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit attempt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading exercise..." />;
  }

  if (loadError || !lesson || !exercise) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ErrorState
            title="Could not load exercise"
            message={loadError ?? "Exercise data is missing."}
            onRetry={() => {
              void loadExercise();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const feedback =
    attemptResult?.attempt.analysisResult
      ? feedbackMessages[attemptResult.attempt.analysisResult.feedbackCode]
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{lesson.stage}</Text>
          <Text style={styles.title}>{exercise.code}</Text>
          <Text style={styles.prompt}>{exercise.promptText}</Text>
          <Text style={styles.note}>
            Recording is stubbed in this ticket. Real microphone capture will plug into the
            record/submit controls later.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Interaction</Text>
          <Text style={styles.panelBody}>
            Record state: {isRecording ? "Placeholder clip ready" : "No clip staged"}
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => {
                setSubmitError(null);
                setIsRecording((current) => !current);
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {isRecording ? "Clear Stub Clip" : "Record Stub Clip"}
              </Text>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
              style={[
                styles.primaryButton,
                isSubmitting ? styles.disabledButton : null
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Submitting..." : "Submit Attempt"}
              </Text>
            </Pressable>
          </View>

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
        </View>

        {attemptResult ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Feedback</Text>
              <Text style={styles.feedbackTitle}>{feedback?.title}</Text>
              <Text style={styles.panelBody}>{feedback?.body}</Text>
              <Text style={styles.metricLine}>
                Pitch score: {attemptResult.attempt.analysisResult?.metrics.pitchScore.toFixed(2)}
              </Text>
              <Text style={styles.metricLine}>
                Phoneme score: {attemptResult.attempt.analysisResult?.metrics.phonemeScore.toFixed(2)}
              </Text>
              <Text style={styles.metricLine}>
                Timing score: {attemptResult.attempt.analysisResult?.metrics.timingScore.toFixed(2)}
              </Text>
              <Text style={styles.metricLine}>
                Passed: {attemptResult.attempt.passed ? "Yes" : "No"}
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Progression Snapshot</Text>
              <Text style={styles.metricLine}>
                Current lesson: {attemptResult.progressionSnapshot.currentLessonId ?? "None"}
              </Text>
              <Text style={styles.metricLine}>
                Tamagotchi stage: {attemptResult.progressionSnapshot.sprite.currentStage}
              </Text>
              <Text style={styles.metricLine}>
                Growth points: {attemptResult.progressionSnapshot.sprite.growthPoints}
              </Text>
              {attemptResult.progressionSnapshot.lessons.map((item) => (
                <Text key={item.lessonId} style={styles.snapshotLine}>
                  {item.lessonId}: {item.status}
                </Text>
              ))}
            </View>
          </>
        ) : null}
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
  eyebrow: {
    color: theme.colors.accent,
    fontWeight: "800"
  },
  title: {
    fontSize: theme.typography.title,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  prompt: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  note: {
    color: theme.colors.textSecondary,
    lineHeight: 22
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  panelTitle: {
    fontSize: theme.typography.heading,
    fontWeight: "700",
    color: theme.colors.textPrimary
  },
  panelBody: {
    color: theme.colors.textSecondary,
    lineHeight: 21
  },
  buttonRow: {
    gap: theme.spacing.sm
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    alignItems: "center"
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800"
  },
  secondaryButton: {
    backgroundColor: theme.colors.accentSoft,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  errorText: {
    color: theme.colors.danger
  },
  feedbackTitle: {
    color: theme.colors.success,
    fontWeight: "800",
    fontSize: theme.typography.body
  },
  metricLine: {
    color: theme.colors.textPrimary
  },
  snapshotLine: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption
  }
});
