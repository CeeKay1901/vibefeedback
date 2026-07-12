// Regeneriert layer.min.js und die Bookmarklet-Zeile in app.js aus layer.js
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

const VF = path.join(__dirname, "..");

(async () => {
  const src = fs.readFileSync(path.join(VF, "layer.js"), "utf8");
  const min = await minify(src, { compress: true, mangle: true });
  if (!min.code) throw new Error("terser produced no output");
  fs.writeFileSync(path.join(VF, "layer.min.js"), min.code);
  console.log("layer.min.js:", min.code.length, "bytes");

  const appJs = fs.readFileSync(path.join(VF, "app.js"), "utf8");
  const lines = appJs.split("\n");
  const idx = lines.findIndex(l => l.includes('bmLink.href = "javascript:"'));
  if (idx === -1) throw new Error("bookmarklet line not found");
  lines[idx] = '  if(bmLink){ bmLink.href = "javascript:" + encodeURIComponent(' + JSON.stringify(min.code) + "); }";
  fs.writeFileSync(path.join(VF, "app.js"), lines.join("\n"));
  console.log("app.js bookmarklet line", idx + 1, "updated,", lines[idx].length, "chars");
})();
