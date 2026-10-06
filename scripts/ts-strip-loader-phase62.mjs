import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@capacitor/core') return { url: new URL('./capacitor-core-stub-phase62.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[a-z0-9]+$/i.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(base.href + suffix);
      try { await access(fileURLToPath(candidate)); return { url: candidate.href, shortCircuit: true }; } catch {}
    }
  }
  return nextResolve(specifier, context);
}
