const express = require("express");
const app = express();

const crypto = require("crypto");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");

app.use(express.static("public"));


// Middlewares
app.use(express.json());
app.set("view engine", "ejs");

// DB
const mongoURI = "mongodb://localhost:27017/node-file-upl";

// connection
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// init gfs
let gfs;
conn.once("open", () => {
  // init stream
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
});

// Storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
          metadata: {
            name: req.body.name,
            email: req.body.email,
            chapterName: req.body.chapterName,
          },
        };
        resolve(fileInfo);
      });
    });
  },
});


const upload = multer({
  storage,
});

// get / page
app.get("/", (req, res) => {
  gfs.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      return res.render("index", { files: false });
    } else {
      const f = files.map((file) => ({
        ...file,
        isImage: ["image/jpeg", "image/png"].includes(file.contentType),
        metadataName: file.metadata
          ? file.metadata.name || "Unknown"
          : "Unknown",
        metadataEmail: file.metadata
          ? file.metadata.email || "Unknown"
          : "Unknown",
        metadataChapterName: file.metadata
          ? file.metadata.chapterName || "Unknown"
          : "Unknown",
      }));
      return res.render("index", { files: f });
    }
  });
});



app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req.file); // Check file details
  console.log(req.body); // Check additional form fields
  res.redirect("/");
});


app.get("/files", (req, res) => {
  gfs.find().toArray((err, files) => {
    // check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "no files exist",
      });
    }

    return res.json(files);
  });
});

app.get("/files/:filename", (req, res) => {
  gfs.find(
    {
      filename: req.params.filename,
    },
    (err, file) => {
      if (!file) {
        return res.status(404).json({
          err: "no files exist",
        });
      }

      return res.json(file);
    }
  );
});

app.get("/image/:filename", (req, res) => {
  // console.log('id', req.params.id)
  const file = gfs
    .find({
      filename: req.params.filename,
    })
    .toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: "no files exist",
        });
      }
      gfs.openDownloadStreamByName(req.params.filename).pipe(res);
    });
});

// files/del/:id
// Delete chunks from the db
app.post("/files/del/:id", (req, res) => {
  gfs.delete(new mongoose.Types.ObjectId(req.params.id), (err, data) => {
    if (err) return res.status(404).json({ err: err.message });
    res.redirect("/");
  });
});

const port = 5001;

app.listen(port, () => {
  console.log("server started on " + port);
});
