// Kleiner Server für das Spiel: liefert die Dateien dieses Ordners aus und verbietet dem Browser das Zwischenspeichern,
// damit nach einer Änderung ein einfaches Neuladen reicht.
// Aufruf: node tools/serve.mjs [Port]   ->   http://localhost:8765
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), ".."), port = +(process.argv[2] || 8765);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname), file = normalize(join(root, path === "/" ? "index.html" : path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end("Forbidden"); return; }      // nichts außerhalb des Spielordners
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(data);
  } catch (_) { res.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Feuer gegen Wasser: http://localhost:${port}`));
