import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("prisma keys:", Object.keys(prisma));
  // show type of authSession
  console.log("authSession delegate exists?", typeof (prisma as any).authSession);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
