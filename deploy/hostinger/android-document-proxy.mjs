import http from "node:http";

const LISTEN_PORT = Number(process.env.MKT88_ANDROID_PROXY_PORT || 3001);
const UPSTREAM_PORT = Number(process.env.MKT88_UPSTREAM_PORT || 3000);
const HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

function passthroughHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP_HEADERS.has(name.toLowerCase())));
}

const server = http.createServer((request, response) => {
  const headers = passthroughHeaders(request.headers);
  headers.host = `127.0.0.1:${UPSTREAM_PORT}`;
  delete headers["accept-encoding"];

  const upstream = http.request({
    hostname: "127.0.0.1",
    port: UPSTREAM_PORT,
    method: request.method,
    path: request.url,
    headers,
  }, (upstreamResponse) => {
    const responseHeaders = passthroughHeaders(upstreamResponse.headers);
    const isDocument = request.method !== "HEAD"
      && /^text\/html\b/i.test(String(upstreamResponse.headers["content-type"] || ""));

    if (!isDocument) {
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
      return;
    }

    const chunks = [];
    upstreamResponse.on("data", (chunk) => chunks.push(chunk));
    upstreamResponse.on("end", () => {
      const body = Buffer.concat(chunks);
      responseHeaders["content-length"] = String(body.length);
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      response.end(body);
    });
    upstreamResponse.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
  });

  upstream.setTimeout(30_000, () => upstream.destroy(new Error("upstream timeout")));
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad Gateway");
  });
  request.pipe(upstream);
});

server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(`MKT88 Android document proxy listening on 127.0.0.1:${LISTEN_PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
