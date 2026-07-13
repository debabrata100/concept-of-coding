// Inspect Buffer chunks

const fs = require("fs");

async function checkFile(filepath) {
  try {
    await fs.promises.access(filepath);
    return true;
  } catch (error) {
    return false;
  }
}

async function createLargeFile(filename) {
  const content = "This would be a file with large texts.";
  try {
    const fileExists = await checkFile(filename);
    if (fileExists) return;
    console.log("File is being created...");
    await fs.promises.writeFile(filename, content);
    const stream = fs.createWriteStream(filename, { flags: "a" });
    for (let i = 0; i < 100000; i++) {
      const canContinue = stream.write(`${content}\n`);
      if (!canContinue) {
        await new Promise((resolve) => stream.once("drain", resolve));
      }
    }
  } catch (error) {
    console.error(error);
  }
}

createLargeFile("large-file.txt");

// Read file with stream

function readFileWithStream(filename) {
  const stream = fs.createReadStream(filename);
  let count = 0;
  stream.on("data", (chunk) => {
    count++;
    console.log(`Chunk: ${count}: ${chunk.length} bytes`);
  });
  stream.on("end", () => {
    console.log("Done");
  });
}
readFileWithStream("large-file.txt");

// copy file using stream

function copyFile(sourceFile, targetFile) {
  const read = fs.createReadStream(sourceFile);
  const write = fs.createWriteStream(targetFile);
  read.pipe(write);
}

copyFile("large-file.txt", "output/copy.txt");
