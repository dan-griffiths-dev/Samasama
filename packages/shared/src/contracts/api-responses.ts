import type {
  SamasamaAttemptDto,
  SamasamaExerciseDto,
  SamasamaLessonDetailDto,
  SamasamaLessonSummaryDto,
  SamasamaProgressionSnapshotDto,
  SamasamaSpriteStateDto,
  SamasamaUserDto
} from "./domain";

export interface SamasamaApiHealthResponse {
  status: SamasamaServiceStatus;
  service: string;
}

export interface SamasamaAuthResponse {
  user: SamasamaUserDto;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface SamasamaCurrentUserResponse {
  user: SamasamaUserDto;
}

export interface SamasamaLessonsListResponse {
  lessons: SamasamaLessonSummaryDto[];
}

export interface SamasamaLessonDetailResponse {
  lesson: SamasamaLessonDetailDto;
}

export interface SamasamaCreateAttemptResponse {
  attempt: SamasamaAttemptDto;
  progressionSnapshot: SamasamaProgressionSnapshotDto;
}

export interface SamasamaAttemptDetailResponse {
  attempt: SamasamaAttemptDto;
}

export interface SamasamaProgressionSnapshotResponse {
  progression: SamasamaProgressionSnapshotDto;
}

export interface SamasamaLessonExerciseCollectionResponse {
  lessonId: string;
  exercises: SamasamaExerciseDto[];
}

export interface SamasamaSpriteStateResponse {
  sprite: SamasamaSpriteStateDto;
}

export enum SamasamaServiceStatus {
  OK = "ok"
}
