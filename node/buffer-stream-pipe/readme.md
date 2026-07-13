# Explain Buffers, Streams, and Pipe together.
"A Buffer is a fixed-size block of binary memory used to temporarily hold raw bytes. Streams process data incrementally as a sequence of Buffer chunks instead of loading everything into memory. pipe() efficiently connects a readable stream to a writable stream and automatically manages data flow, including backpressure, so large files, network traffic, and uploads can be processed with constant memory usage."

Why Buffers Exist

Let's start with a problem.
Imagine your Express API allows users to upload a 5GB movie.
Without Buffers, Node would have to do this:
              Read entire file (5GB)
              ↓
              Store in RAM (5GB)
              ↓
              Process
              ↓
              Send

That is impossible.

Instead Node does:
                  Read 64 KB
                  ↓
                  Process
                  ↓
                  Discard
                  ↓
                  Read next 64 KB
                  ↓
                  Process
                  ↓
                  Discard
This small temporary memory is called a Buffer.
A Buffer is simply a chunk of raw binary memory.

Think of it as:
RAM

------------------------------------
| 01 | AF | B2 | 99 | 45 | 22 | ...
------------------------------------

## Why JavaScript Needed Buffers?

JavaScript originally only had:
String
Number
Boolean
Object

There was no binary data type.
But servers constantly deal with binary data:
Images
PDFs
Videos
Zip files
Network packets
TCP messages

Hence Node introduced Buffer.
Think of Buffer Like This

Imagine downloading a movie.

Without Buffer
          Internet
                ↓
          Entire movie
                ↓
          RAM
                ↓
          Disk
Needs huge RAM.

With Buffer
          Internet
            ↓
          64KB
            ↓
          Disk

          ↓

          Next 64KB

          ↓

          Disk

Stream Types:
    Readable
    Writable
    Duplex
    Transform

const fs = require("fs");

const stream = fs.createReadStream("movie.mp4");

stream.on("data", chunk => {
    console.log(chunk.length);
});

internally:
          Disk
          ↓
          64KB
          ↓
          Buffer
          ↓
          data event
          ↓
          Application

What is Piping?

Without pipe:
    Read
    ↓
    Receive chunk
    ↓
    Write chunk
    ↓
    Repeat

code:
read.on("data", chunk => {
    write.write(chunk);
});

Need error, close, finish, backpressure handling.
Pipe automates everything.
read.pipe(write);

internally:
          Disk
          ↓
          Read Stream
          ↓
          Buffer
          ↓
          Pipe
          ↓
          Buffer
          ↓
          Write Stream
          ↓
          Disk

# How to handle error using pipe?
const {pipeline} = require("node:stream);
pipeline(readStream, WriteStream, (err) => {
    console.error("Pipeline failed:", err);
})