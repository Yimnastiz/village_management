import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // `officialCode` is text: do not cast the entire code, because it may have
  // leading zeroes. Only the numeric two-character suffix represents moo.
  const changed = await prisma.$executeRaw`
    UPDATE "ThailandVillageMaster"
    SET "moo" = CASE
      WHEN "officialCode" ~ '[0-9]{2}$'
        AND RIGHT("officialCode", 2)::integer > 0
      THEN RIGHT("officialCode", 2)::integer::text
      ELSE NULL
    END
    WHERE "officialCode" IS NOT NULL
      AND "moo" IS DISTINCT FROM CASE
        WHEN "officialCode" ~ '[0-9]{2}$'
          AND RIGHT("officialCode", 2)::integer > 0
        THEN RIGHT("officialCode", 2)::integer::text
        ELSE NULL
      END
  `;
  const linkedVillagesChanged = await prisma.$executeRaw`
    UPDATE "Village" AS village
    SET "moo" = catalog."moo"
    FROM "ThailandVillageMaster" AS catalog
    WHERE village."catalogVillageId" = catalog.id
      AND village."moo" IS DISTINCT FROM catalog."moo"
  `;
  console.log(JSON.stringify({ catalogRowsUpdated: changed, linkedVillagesUpdated: linkedVillagesChanged }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
