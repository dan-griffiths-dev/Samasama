ALTER TABLE "attempts"
ADD COLUMN "progression_passed" BOOLEAN,
ADD COLUMN "progression_evaluated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "sprite_growth_events_user_id_lesson_id_trigger_to_stage_key"
ON "sprite_growth_events"("user_id", "lesson_id", "trigger", "to_stage");
