const http = require("http"),
  fs = require("fs"),
  path = require("path");
const root = path.join(__dirname, "dist");
http
  .createServer((req, res) => {
    const name = decodeURIComponent(req.url.split("?")[0]);
    const file = path.resolve(
      root,
      "." + (name === "/" ? "/index.html" : name),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, bytes) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css",
          ".js": "text/javascript",
          ".zip": "application/zip",
          ".webmanifest": "application/manifest+json",
          ".png": "image/png",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(bytes);
    });
  })
  .listen(5187, "127.0.0.1", () => console.log("http://127.0.0.1:5187"));
