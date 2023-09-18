import * as esbuild from "esbuild"
import { livereloadPlugin } from "@jgoz/esbuild-plugin-livereload";

async function watch() {
  const context = await esbuild.context({
    entryPoints: ["src/index.html", "src/app.css", "src/app.js", "src/samples/*"],
    outdir: "public",
    bundle: true,
    sourcemap: true,
    loader: {
      ".html": "copy",
      ".css": "copy",
      ".aiff": "copy",
    },
    write: true,
    metafile: true,
    plugins: [livereloadPlugin()],
  });
  await context.watch();
  await context.serve({
    port: 8080,
  });
}

void watch();
