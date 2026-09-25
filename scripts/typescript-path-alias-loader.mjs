import { access } from "node:fs/promises";

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      await access(url);
      return url.href;
    } catch {
      // Try the next source-module candidate.
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let candidateUrl = null;
  if (specifier.startsWith("@/")) {
    candidateUrl = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) {
    candidateUrl = new URL(specifier, context.parentURL);
  }

  if (candidateUrl && !/\.[a-z0-9]+$/iu.test(candidateUrl.pathname)) {
    const resolved = await firstExisting([
      `${candidateUrl.href}.ts`,
      `${candidateUrl.href}.tsx`,
      `${candidateUrl.href}.js`,
      `${candidateUrl.href}/index.ts`,
    ]);
    if (resolved) return { url: resolved, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
