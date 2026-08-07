import { seedIfNeeded } from "../src/db/seed";
import { getDb } from "../src/db";
import { organizations, clients } from "../src/db/schema";
import { searchPlaybooks } from "../src/lib/ai/retrieval";
import { runCoachTurn } from "../src/lib/ai/coach";

async function main() {
  await seedIfNeeded();
  const db = await getDb();
  const orgs = await db.select().from(organizations);
  console.log("orgs", orgs.length, orgs[0]?.name);

  const hits = await searchPlaybooks(
    orgs[0].id,
    "client fails back scratch test on one side"
  );
  console.log(
    "hits",
    hits.map((h) => `${h.title}:${h.score}`)
  );

  const r1 = await runCoachTurn({
    organizationId: orgs[0].id,
    userMessage: "client fails back scratch test on one side",
    history: [],
  });
  console.log("turn1", r1.type, r1.type === "follow_up" ? r1.questions.length : "");

  const r2 = await runCoachTurn({
    organizationId: orgs[0].id,
    userMessage:
      "Right side, stiffness only, no injury history, intermediate lifter, goal overhead press",
    history: [
      { role: "user", content: "client fails back scratch test on one side" },
      { role: "assistant", content: "follow ups..." },
    ],
  });
  console.log(
    "turn2",
    r2.type,
    r2.type === "solution" ? r2.summary.slice(0, 100) : ""
  );

  const cli = await db.select().from(clients);
  console.log(
    "clients",
    cli.map((c) => `${c.firstName} ${c.lastName}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

