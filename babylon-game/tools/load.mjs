// Lädt die Spielregeln (js/config.js und js/sim/*) in Node, ohne Browser.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
for (const f of ["config", "sim/steering", "sim/world", "sim/tree-ai", "sim/water-ai"]) require("../js/" + f + ".js");
export const FW = globalThis.FW;
export const sim = FW.sim;
