const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_KEY =
  process.env.ADMIN_KEY || "change-this-admin-key";

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads", "templates");

fs.mkdirSync(PUBLIC, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const DB_FILE = path.join(DATA, "templates.json");

const categories = [
  "Photo",
  "Video",
  "Reels",
  "AI"
];

/* =========================
   100 DEFAULT TEMPLATES
========================= */

const defaults = Array.from(
  { length: 100 },
  (_, i) => ({
    id: i + 1,
    name: "Template #" + (i + 1),
    category: categories[i % categories.length],
    description: "Premium editable template",
    instruction: "",
    active: true,
    image_url: null,
    video_url: null,
    updatedAt: null
  })
);

let db = defaults.map(x => ({ ...x }));

/* =========================
   LOAD DATABASE
========================= */

if (fs.existsSync(DB_FILE)) {
  try {
    const saved = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    if (Array.isArray(saved)) {
      for (const item of saved) {
        const id = Number(item?.id);

        if (
          Number.isInteger(id) &&
          id >= 1 &&
          id <= 100
        ) {
          db[id - 1] = {
            ...db[id - 1],
            ...item,
            id
          };
        }
      }
    }
  } catch (e) {
    console.log(
      "DB read error:",
      e.message
    );
  }
}

/* =========================
   SAVE DATABASE
========================= */

function save() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

/* =========================
   MULTER UPLOAD
========================= */

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },

  filename: (req, file, cb) => {

    const ext = path
      .extname(file.originalname || "")
      .toLowerCase();

    cb(
      null,
      Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .slice(2) +
        ext
    );
  }

});
const upload = multer({

  storage,

  limits: {
    fileSize:
      500 * 1024 * 1024
  }

});

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

/* Uploaded media */

app.use(
  "/uploads",
  express.static(
    path.join(ROOT, "uploads")
  )
);

/* HTML files */

app.use(
  express.static(PUBLIC)
);

/* =========================
   PUBLIC TEMPLATE FORMAT
========================= */

function publicTemplate(x) {

  return {
    id: x.id,
    name: x.name,
    category: x.category,
    description: x.description,
    instruction: x.instruction,
    active: x.active,
    image_url: x.image_url,
    video_url: x.video_url,
    updatedAt: x.updatedAt
  };

}

/* =========================
   DELETE MEDIA FILE
========================= */

function deleteFile(url) {

  if (!url) return;

  try {

    const relative =
      String(url).replace(
        /^\/+/,
        ""
      );

    const filePath =
      path.join(
        ROOT,
        relative
      );

    if (
      filePath.startsWith(ROOT)
    ) {
      fs.unlinkSync(filePath);
    }

  } catch {

    /* File already missing */

  }

}

/* =========================
   ADMIN AUTH
========================= */

function admin(req, res, next) {

  if (req.method === "GET") {
    return next();
  }

  const key =
    req.get("X-Admin-Key");

  if (
    !key ||
    key !== ADMIN_KEY
  ) {

    return res
      .status(401)
      .json({
        error:
          "Admin authentication required"
      });

  }

  next();

}

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

  const file =
    path.join(
      PUBLIC,
      "index.html"
    );

  if (!fs.existsSync(file)) {

    return res
      .status(500)
      .send(
        "index.html not found. Expected: " +
          file
      );

  }

  res.sendFile(file);

});

/* =========================
   ADMIN PAGE
========================= */

app.get(
  "/admin",
  (req, res) => {

    const file =
      path.join(
        PUBLIC,
        "admin.html"
      );

    if (!fs.existsSync(file)) {

      return res
        .status(500)
        .send(
          "admin.html not found. Expected: " +
            file
        );

    }

    res.sendFile(file);

  }
);
/* =========================
   HEALTH CHECK
========================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      templates: 100
    });

  }
);

/* =========================
   GET ALL TEMPLATES
========================= */

app.get(
  "/api/templates",
  (req, res) => {

    res.json(
      db.map(publicTemplate)
    );

  }
);

/* =========================
   GET ONE TEMPLATE
========================= */

app.get(
  "/api/templates/:id",
  (req, res) => {

    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 100
    ) {

      return res
        .status(400)
        .json({
          error:
            "Template must be 1-100"
        });

    }

    res.json(
      publicTemplate(
        db[id - 1]
      )
    );

  }
);

/* =========================
   ADMIN API
========================= */

app.use(
  "/api",
  admin
);

/* =========================
   SAVE / UPDATE TEMPLATE
========================= */

app.post(
  "/api/templates/:id",

  upload.fields([
    {
      name: "video",
      maxCount: 1
    },
    {
      name: "image",
      maxCount: 1
    }
  ]),

  (req, res) => {

    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 100
    ) {

      return res
        .status(400)
        .json({
          error:
            "Template must be 1-100"
        });

    }

    const x =
      db[id - 1];

    /* Name */

    if (
      req.body.name !==
      undefined
    ) {

      x.name =
        String(
          req.body.name
        ).trim() ||
        "Template #" + id;

    }

    /* Category */

    if (
      req.body.category !==
      undefined
    ) {

      const category =
        String(
          req.body.category
        );

      x.category =
        categories.includes(
          category
        )
          ? category
          : "Photo";

    }

    /* Description */

    if (
      req.body.description !==
      undefined
    ) {

      x.description =
        String(
          req.body.description
        );

    }

    /* Instruction */

    if (
      req.body.instruction !==
      undefined
    ) {

      x.instruction =
        String(
          req.body.instruction
        );

    }

    /* Active */

    if (
      req.body.active !==
      undefined
    ) {

      x.active =
        String(
          req.body.active
        ).toLowerCase() !==
        "false";

    }

    /* Uploaded video */

    const video =
      req.files?.video?.[0];

    /* Uploaded image */

    const image =
      req.files?.image?.[0];

    if (video) {

      deleteFile(
        x.video_url
      );

      x.video_url =
        "/uploads/templates/" +
        video.filename;

    }

    if (image) {

      deleteFile(
        x.image_url
      );

      x.image_url =
        "/uploads/templates/" +
        image.filename;

    }

    x.updatedAt =
      Date.now();

    save();

    res.json(
      publicTemplate(x)
    );

  }
);

/* =========================
   RESET TEMPLATE
========================= */

app.delete(
  "/api/templates/:id",
  (req, res) => {

    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id > 100
    ) {

      return res
        .status(400)
        .json({
          error:
            "Template must be 1-100"
        });

    }

    const x =
      db[id - 1];

    deleteFile(
      x.video_url
    );

    deleteFile(
      x.image_url
    );

    db[id - 1] = {
      ...defaults[id - 1],
      updatedAt: Date.now()
    };

    save();

    res.json({
      ok: true
    });

  }
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
  (err, req, res, next) => {

    console.error(
      "Server error:",
      err
    );

    res
      .status(500)
      .json({
        error:
          err.message ||
          "Server error"
      });

  }
);

/* =========================
   DEBUG
========================= */

console.log(
  "ROOT:",
  ROOT
);

console.log(
  "PUBLIC:",
  PUBLIC
);
console.log(
  "index.html exists:",
  fs.existsSync(
    path.join(
      PUBLIC,
      "index.html"
    )
  )
);

console.log(
  "admin.html exists:",
  fs.existsSync(
    path.join(
      PUBLIC,
      "admin.html"
    )
  )
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "DK AI Template Studio running on port " +
        PORT
    );

  }
);


