import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"], // Build for commonJS and ESmodules
	dts: true, // Generate declaration file (.d.ts)
	outDir: "lib",
	splitting: false,
	sourcemap: true,
	clean: true,
	outExtension: ({ format }) => ({
		js: format === "cjs" ? ".cjs" : ".mjs",
	}),
});
