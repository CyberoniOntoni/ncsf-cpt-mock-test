import { seedIfNeeded } from "../src/db/seed";
import { getDb } from "../src/db";
import { equipmentItems, exercises, users } from "../src/db/schema";
import { listExercisesForOrg } from "../src/lib/exercises";
import { organizations } from "../src/db/schema";

async function main() {
  await seedIfNeeded();
  // concurrent call should not race
  await Promise.all([seedIfNeeded(), seedIfNeeded(), seedIfNeeded()]);
  const db = await getDb();
  const u = await db.select().from(users);
  const e = await db.select().from(equipmentItems);
  const x = await db.select().from(exercises);
  const [org] = await db.select().from(organizations).limit(1);
  const usable = org ? await listExercisesForOrg(org.id) : [];
  console.log(
    JSON.stringify(
      {
        users: u.length,
        equipment: e.length,
        exercises: x.length,
        usable: usable.filter((z) => z.available).length,
        demo: u[0]?.email,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
