import { seedIfNeeded } from "../src/db/seed";
import { getDb } from "../src/db";
import { organizations } from "../src/db/schema";
import {
  listExercisesForOrg,
  listEquipmentCatalogWithOrg,
  suggestExercisesForCoach,
} from "../src/lib/exercises";
import { runCoachTurn } from "../src/lib/ai/coach";

async function main() {
  await seedIfNeeded();
  const db = await getDb();
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error("no org");

  const eq = await listEquipmentCatalogWithOrg(org.id);
  const ex = await listExercisesForOrg(org.id);
  console.log(
    "equipment",
    eq.length,
    "available",
    eq.filter((e) => e.available).length
  );
  console.log(
    "exercises",
    ex.length,
    "usable",
    ex.filter((e) => e.available).length
  );

  const sug = await suggestExercisesForCoach(
    org.id,
    "fails back scratch test shoulder mobility",
    ["shoulder", "mobility"],
    5
  );
  console.log(
    "suggestions",
    sug.map((s) => s.name)
  );

  const turn = await runCoachTurn({
    organizationId: org.id,
    userMessage: "client fails back scratch on one side",
    history: [
      { role: "user", content: "client fails back scratch on one side" },
      { role: "assistant", content: "follow ups asked" },
      {
        role: "user",
        content: "right side, stiffness only, no injury, intermediate",
      },
    ],
  });
  if (turn.type === "solution") {
    console.log(
      "coach exercises",
      turn.exerciseSuggestions?.map((e) => e.name)
    );
  } else {
    console.log("turn type", turn.type);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
