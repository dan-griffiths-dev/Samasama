export enum SamasamaFeedbackCode {
  PITCH_STEADY = "PITCH_STEADY",
  PITCH_VARIATION_REQUIRED = "PITCH_VARIATION_REQUIRED",
  TIMING_REPEAT_REQUIRED = "TIMING_REPEAT_REQUIRED",
  CLARITY_RETRY_REQUIRED = "CLARITY_RETRY_REQUIRED",
  ENERGY_INCREASE_REQUIRED = "ENERGY_INCREASE_REQUIRED"
}

export enum SamasamaAttemptStatus {
  PENDING = "PENDING",
  SCORED = "SCORED",
  FAILED = "FAILED"
}

export enum SamasamaSpriteStage {
  INFANT = "INFANT",
  TODDLER = "TODDLER"
}

export enum SamasamaLessonStage {
  INFANT = "INFANT",
  TODDLER = "TODDLER"
}

export enum SamasamaExerciseKind {
  VOWEL = "VOWEL",
  SYLLABLE = "SYLLABLE",
  PHRASE = "PHRASE"
}

export enum SamasamaLessonProgressStatus {
  LOCKED = "LOCKED",
  AVAILABLE = "AVAILABLE",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED"
}

export interface SamasamaUserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface SamasamaExerciseDto {
  id: string;
  lessonId: string;
  code: string;
  title: string;
  promptText: string;
  exerciseKind: SamasamaExerciseKind;
  sortOrder: number;
}

export interface SamasamaLessonSummaryDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  stage: SamasamaLessonStage;
  sortOrder: number;
  exerciseCount: number;
  prerequisiteLessonCodes: string[];
  prerequisiteLessons: SamasamaLessonPrerequisiteDto[];
  unlockMetadata: SamasamaLessonUnlockMetadataDto | null;
}

export interface SamasamaLessonDetailDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  stage: SamasamaLessonStage;
  sortOrder: number;
  prerequisiteLessonCodes: string[];
  prerequisiteLessons: SamasamaLessonPrerequisiteDto[];
  unlockMetadata: SamasamaLessonUnlockMetadataDto | null;
  exercises: SamasamaExerciseDto[];
}

export interface SamasamaAttemptDto {
  id: string;
  userId: string;
  lessonId: string;
  exerciseId: string;
  status: SamasamaAttemptStatus;
  passed: boolean | null;
  transcript: string | null;
  mediaPath: string | null;
  submittedAtIso: string;
  createdAtIso: string;
  analysisResult: SamasamaVoiceAnalysisResultDto | null;
}

export interface SamasamaSpriteStateDto {
  userId: string;
  currentStage: SamasamaSpriteStage;
  growthPoints: number;
}

export interface SamasamaProgressionLessonSnapshotDto {
  lessonId: string;
  status: SamasamaLessonProgressStatus;
  completedAtIso: string | null;
}

export interface SamasamaProgressionSnapshotDto {
  userId: string;
  currentLessonId: string | null;
  lessons: SamasamaProgressionLessonSnapshotDto[];
  sprite: SamasamaSpriteStateDto;
}

export interface SamasamaLessonPrerequisiteDto {
  lessonId: string;
  lessonCode: string;
  lessonTitle: string;
  lessonStage: SamasamaLessonStage;
}

export interface SamasamaLessonUnlockMetadataDto {
  isAuthenticated: boolean;
  status: SamasamaLessonProgressStatus | null;
  isUnlocked: boolean;
  isCompleted: boolean;
  unlockedAtIso: string | null;
  completedAtIso: string | null;
  lastAttemptAtIso: string | null;
}

export interface SamasamaVoiceAnalysisMetricsDto {
  pitchScore: number;
  phonemeScore: number;
  timingScore: number;
}

export interface SamasamaVoiceAnalysisResultDto {
  id: string;
  attemptId: string;
  feedbackCode: SamasamaFeedbackCode;
  analysisVersion: string;
  summary: string | null;
  completedAtIso: string | null;
  metrics: SamasamaVoiceAnalysisMetricsDto;
}
