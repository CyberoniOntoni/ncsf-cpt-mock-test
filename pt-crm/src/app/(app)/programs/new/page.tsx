import { ProgramNewChooser } from "@/components/program-new-chooser";
import { ProgramScratchForm } from "@/components/program-scratch-form";
import { ProgramWizard } from "@/components/program-wizard";
import type { ProgramGoal } from "@/lib/program-builder";

export const dynamic = "force-dynamic";

export default async function NewProgramPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    client?: string;
    goal?: string;
    days?: string;
    minutes?: string;
    experience?: string;
    mobility?: string;
    notes?: string;
  }>;
}) {
  const params = await searchParams;
  const mode = (params.mode || "").toLowerCase();
  const clientId = params.client ?? null;

  if (mode === "scratch") {
    return <ProgramScratchForm initialClientId={clientId} />;
  }

  if (mode === "wizard" || mode === "auto" || mode === "design") {
    const days = params.days ? Number(params.days) : undefined;
    const minutes = params.minutes ? Number(params.minutes) : undefined;
    const goal = (
      ["general", "strength", "hypertrophy", "fat_loss", "mobility"].includes(
        params.goal || ""
      )
        ? params.goal
        : undefined
    ) as ProgramGoal | undefined;

    return (
      <ProgramWizard
        initialClientId={clientId}
        initialGoal={goal}
        initialDaysPerWeek={
          days && days >= 2 && days <= 6 ? days : undefined
        }
        initialSessionMinutes={
          minutes && minutes >= 20 && minutes <= 120 ? minutes : undefined
        }
        initialExperience={params.experience}
        initialPreferMobility={
          params.mobility === "1" || params.mobility === "true"
        }
        initialNotes={params.notes}
      />
    );
  }

  return <ProgramNewChooser clientId={clientId} />;
}
