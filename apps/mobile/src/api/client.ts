import Constants from "expo-constants";

import type {
  SamasamaAuthResponse,
  SamasamaCreateAttemptResponse,
  SamasamaLessonDetailResponse,
  SamasamaLessonsListResponse
} from "@samasama/shared";

const API_URL = resolveApiUrl();

type RequestOptions = {
  method?: "GET" | "POST";
  accessToken?: string | null;
  body?: unknown;
};

export async function loginRequest(input: {
  email: string;
  password: string;
}) {
  return request<SamasamaAuthResponse>("/auth/login", {
    method: "POST",
    body: input
  });
}

export async function fetchLessonsRequest(accessToken: string | null) {
  return request<SamasamaLessonsListResponse>("/lessons", {
    method: "GET",
    accessToken
  });
}

export async function fetchLessonDetailRequest(input: {
  lessonId: string;
  accessToken: string | null;
}) {
  return request<SamasamaLessonDetailResponse>(`/lessons/${input.lessonId}`, {
    method: "GET",
    accessToken: input.accessToken
  });
}

export async function createAttemptRequest(input: {
  accessToken: string;
  exerciseId: string;
  transcript: string | null;
  mediaPath: string | null;
}) {
  return request<SamasamaCreateAttemptResponse>("/attempts", {
    method: "POST",
    accessToken: input.accessToken,
    body: {
      exerciseId: input.exerciseId,
      transcript: input.transcript,
      mediaPath: input.mediaPath
    }
  });
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) {
        message = data.message;
      }
    } catch {
      // Keep the fallback message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    null;

  if (!hostUri) {
    return "http://localhost:3001";
  }

  const host = hostUri.split(":")[0];
  return `http://${host}:3001`;
}
