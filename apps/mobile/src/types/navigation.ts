export type RootStackParamList = {
  Login: undefined;
  Lessons: undefined;
  LessonDetail: {
    lessonId: string;
    lessonTitle: string;
  };
  Exercise: {
    lessonId: string;
    exerciseId: string;
    lessonTitle: string;
    exerciseCode: string;
  };
};
