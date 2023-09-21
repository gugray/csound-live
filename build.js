import * as esbuild from "esbuild"
import * as fs from "fs";
import { livereloadPlugin } from "@jgoz/esbuild-plugin-livereload";

const timestamp = (+new Date).toString(36);

const args = (argList => {
  let res = {};
  let opt, thisOpt, curOpt;
  for (let i = 0; i < argList.length; i++) {
    thisOpt = argList[i].trim();
    opt = thisOpt.replace(/^\-+/, "");
    if (opt === thisOpt) {
      // argument value
      if (curOpt) res[curOpt] = opt;
      curOpt = null;
    } else {
      // argument name
      curOpt = opt;
      res[curOpt] = true;
    }
  }
  //console.log(res);
  return res;
})(process.argv);

const cacheBusterPlugin = {
  name: "cacheBusterPlugin",
  setup(build) {
    build.onEnd(() => {
      const dstr = "[" + new Date().toLocaleTimeString() + "] ";
      console.log(dstr + "Build finished");
      const index = fs.readFileSync("./public/index.html", {encoding: "utf-8"});
      const newIndex = index.replaceAll("%%VERSION%%", timestamp);
      fs.writeFileSync("./public/index.html", newIndex);
    })
  },
};


async function build() {
  const entryPoints = ["src/index.html", "src/app.css", "src/app.js", "src/fonts/*"];
  if (fs.existsSync("src/samples")) entryPoints.push("src/samples/*");
  const plugins = [cacheBusterPlugin];
  if (args.watch) plugins.push(livereloadPlugin());
  const context = await esbuild.context({
    entryPoints: entryPoints,
    outdir: "public",
    bundle: true,
    sourcemap: true,
    loader: {
      ".html": "copy",
      ".css": "copy",
      ".aiff": "copy",
      ".woff2": "copy",
    },
    write: true,
    metafile: true,
    plugins: plugins,
  });

  if (args.watch) {
    await context.watch();
    await context.serve({
      port: 8080,
    });
  }
  else {
    await context.rebuild();
    await context.dispose();
    process.exit(0);
  }
}

void build();
