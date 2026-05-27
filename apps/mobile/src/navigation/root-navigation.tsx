import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ExerciseScreen } from "../screens/exercise-screen";
import { LessonDetailScreen } from "../screens/lesson-detail-screen";
import { LessonsScreen } from "../screens/lessons-screen";
import { LoginScreen } from "../screens/login-screen";
import { useAuthStore } from "../store/auth-store";
import { theme } from "../theme";
import type { RootStackParamList } from "../types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.accent
  }
};

export function RootNavigation() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            color: theme.colors.textPrimary,
            fontWeight: "700"
          },
          contentStyle: {
            backgroundColor: theme.colors.background
          }
        }}
      >
        {!accessToken ? (
          <Stack.Screen
            component={LoginScreen}
            name="Login"
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              component={LessonsScreen}
              name="Lessons"
              options={{ title: "Curriculum" }}
            />
            <Stack.Screen
              component={ExerciseScreen}
              name="Exercise"
              options={({ route }) => ({
                title: route.params.exerciseCode
              })}
            />
            <Stack.Screen
              component={LessonDetailScreen}
              name="LessonDetail"
              options={({ route }) => ({
                title: route.params.lessonTitle
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
