const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads", "templates");

fs.mkdirSync(PUBLIC, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const DB_FILE = path.join(DATA, "templates.json");

const defaults = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: "Template #" + (i + 1),
  category: ["Photo", "Video", "Reels", "AI"][i % 4],
  description: "Premium editable template",
  instruction: "",
  active: true,
  image_url: null,
  video_url: null,
  updatedAt: null
}));

let db = defaults;

if (fs.existsSync(DB_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    if (Array.isArray(saved)) {
      for (const item of saved) {
        if (item?.id >= 1 && item?.id <= 100) {
          db[item.id - 1] = {
            ...db[item.id - 1],
            ...item
          };
        }
      }
    }
  } catch (e) {
    console.log("DB read error:", e.message);
  }
}

function save() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        "-" +
        Math.random().toString(36).slice(2) +
        path.extname(file.originalname)
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json());

app.use(
  "/uploads",
  express.static(path.join(ROOT, "uploads"))
);

app.use(
  express.static(PUBLIC)
);

function admin(req, res, next) {
  if (req.method === "GET") {
    return next();
  }

  if (req.get("X-Admin-Key") !== ADMIN_KEY) {
    return res.status(401).json({
      error: "Admin authentication required"
    });
  }

  next();
}

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

function deleteFile(url) {
  if (!url) return;

  try {
    fs.unlinkSync(
      path.join(ROOT, url.replace(/^\//, ""))
    );
  } catch {}
}

/* HOME */
app.get("/", (req, res) => {
  const file = path.join(PUBLIC, "index.html");

  if (!fs.existsSync(file)) {
    return res.status(500).send(
      "index.html not found. Expected: " + file
    );
  }

  res.sendFile(file);
});

/* ADMIN PAGE */
app.get("/admin", (req, res) => {
  const file = path.join(PUBLIC, "admin.html");

  if (!fs.existsSync(file)) {
    return res.status(500).send(
      "admin.html not found. Expected: " + file
    );
  }

  res.sendFile(file);
});

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    templates: 100
  });
});

/* TEMPLATES */
app.get("/api/templates", (req, res) => {
  res.json(db.map(publicTemplate));
});

app.get("/api/templates/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!db[id - 1]) {
    return res.status(404).json({
      error: "Not found"
    });
  }

  res.json(publicTemplate(db[id - 1]));
});

/* ADMIN API */
app.use("/api", admin);

app.post(
  "/api/templates/:id",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 }
  ]),
  (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1 || id > 100) {
      return res.status(400).json({
        error: "Template must be 1-100"
      });
    }

    const x = db[id - 1];

    if (req.body.name !== undefined) {
      x.name =
        String(req.body.name).trim() ||
        "Template #" + id;
    }

    if (req.body.category !== undefined) {
      x.category = String(req.body.category);
    }

    if (req.body.description !== undefined) {
      x.description = String(req.body.description);
    }

    if (req.body.instruction !== undefined) {
      x.instruction = String(req.body.instruction);
    }

    if (req.body.active !== undefined) {
      x.active =
        String(req.body.active) !== "false";
    }

    const video = req.files?.video?.[0];
    const image = req.files?.image?.[0];

    if (video) {
      deleteFile(x.video_url);

      x.video_url =
        "/uploads/templates/" + video.filename;
    }

    if (image) {
      deleteFile(x.image_url);

      x.image_url =
        "/uploads/templates/" + image.filename;
    }

    x.updatedAt = Date.now();

    save();

    res.json(publicTemplate(x));
  }
);

app.delete("/api/templates/:id", (req, res) => {
  const id = Number(req.params.id);

  if (id < 1 || id > 100) {
    return res.status(400).json({
      error: "Bad template"
    });
  }

  const x = db[id - 1];

  deleteFile(x.video_url);
  deleteFile(x.image_url);

  db[id - 1] = {
    ...defaults[id - 1],
    updatedAt: Date.now()
  };

  save();

  res.json({
    ok: true
  });
});

/* DEBUG */
console.log("ROOT:", ROOT);
console.log("PUBLIC:", PUBLIC);
console.log(
  "index.html exists:",
  fs.existsSync(path.join(PUBLIC, "index.html"))
);
console.log(
  "admin.html exists:",
  fs.existsSync(path.join(PUBLIC, "admin.html"))
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "DK AI Template Studio running on port " + PORT
  );
});
