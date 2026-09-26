import * as esbuild from 'esbuild-wasm';

await esbuild.initialize({
});

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/server.cjs',
});

console.log('server.cjs built successfully');
process.exit(0);
