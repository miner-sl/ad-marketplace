import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  bundle: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  treeshake: true,
  // Drop console.log and console.error statements
  // External dependencies that should not be bundled
  external: [
    // 'mongoose',
    // '@fastify/cors',
    // 'fastify',
    'dotenv',
    'node-fetch',
  ],
  esbuildOptions(options) {
    // options.drop = ['console', 'debugger'];
    options.platform = 'node';
    options.banner = {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    };
  },
  onSuccess: 'echo "✅ Build completed successfully!"',
});
