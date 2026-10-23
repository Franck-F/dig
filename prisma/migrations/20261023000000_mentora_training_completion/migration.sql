-- Mentorat onboarding trainings: one row per (user, module) once completed.
-- Module catalogue is static in src/lib/mentora/trainings.ts.
CREATE TABLE "MentoraTrainingCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoraTrainingCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MentoraTrainingCompletion_userId_moduleSlug_key" ON "MentoraTrainingCompletion"("userId", "moduleSlug");

CREATE INDEX "MentoraTrainingCompletion_userId_idx" ON "MentoraTrainingCompletion"("userId");

ALTER TABLE "MentoraTrainingCompletion" ADD CONSTRAINT "MentoraTrainingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
