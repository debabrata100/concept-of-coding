const http = require("http");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("node:stream");

const server = http.createServer((req, res) => {
  console.log(req.url);
  if (req.url.includes("/download")) {
    const filePath = path.join(__dirname, "large-file.txt");
    // 1. Set the Content-Disposition header to trigger the download
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="large-file.txt"',
    );
    // 2. Set the Content-Type to octet-stream to force binary download behavior
    res.setHeader("Content-Type", "application/octet-stream");
    // Download large-file.txt
    const read = fs.createReadStream(filePath);
    pipeline(read, res, (error) => {
      console.error("Pipeline failed:", err);
      // If the error happened while sending, the response might be incomplete.
      // Ensure you don't try to send headers again if they were already sent.
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  }
});
server.listen(4000, () => {
  console.log("`Listening on port 4000");
});
