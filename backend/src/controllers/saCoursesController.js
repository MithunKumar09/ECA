//backend/src/controllers/saCoursesController.js
import Course from "../models/Course.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";

function sanitize(doc) {
  if (!doc) return doc;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug || null,
    description: o.description || null,
    category: o.category || null,
    price: o.price ?? 0,
    visibility: o.visibility || "unlisted",
    status: o.status || "draft",
    orgId: o.orgId ? String(o.orgId) : null,
    ownerId: o.ownerId ? String(o.ownerId) : null,
    tags: Array.isArray(o.tags) ? o.tags : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    orgName: o.orgName || o.org?.name || null,
    ownerName: o.ownerName || o.owner?.name || null,
    ownerEmail: o.ownerEmail || o.owner?.email || null,
  };
}

// GET /sa/courses
export async function list(req, res) {
  const { q, status = "all", orgId, ownerEmail } = req.query || {};
  const and = [];
  if (q) {
    const rx = { $regex: String(q), $options: "i" };
    and.push({ $or: [{ title: rx }, { slug: rx }, { category: rx }, { description: rx }, { tags: rx }] });
  }
  if (status !== "all") and.push({ status });
  if (orgId === "global") and.push({ orgId: null });
  else if (orgId) and.push({ orgId });

  if (ownerEmail) {
    const owner = await User.findOne({ email: ownerEmail.toLowerCase() }).select("_id");
    if (owner) and.push({ ownerId: owner._id });
    else return res.json([]);
  }

  const where = and.length ? { $and: and } : {};
  const docs = await Course.find(where)
    .populate("ownerId", "name email")
    .populate("orgId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const rows = [];
  for (const d of docs) {
    rows.push({
      ...sanitize(d),
      ownerName: d.ownerId?.name || null,
      ownerEmail: d.ownerId?.email || null,
      orgName: d.orgId?.name || null,
    });
  }
  return res.json(rows);
}

// POST /sa/courses
export async function create(req, res) {
  const { title, slug, description, category, price, visibility, status, orgId, ownerEmail, tags } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, message: "title required" });

  let ownerId = null;
  if (ownerEmail) {
    const owner = await User.findOne({ email: String(ownerEmail).toLowerCase() });
    if (owner) ownerId = owner._id;
  }

  const doc = await Course.create({
    title, slug, description, category,
    price: Number.isFinite(price) ? price : 0,
    visibility: visibility || "unlisted",
    status: status || "draft",
    orgId: orgId || null,
    ownerId,
    tags: Array.isArray(tags) ? tags : (typeof tags === "string" ? String(tags).split(",").map(s=>s.trim()).filter(Boolean) : []),
  });

  return res.json(sanitize(doc));
}

// PATCH /sa/courses/:id
export async function patch(req, res) {
  const { id } = req.params;
  const p = {};
  const pick = [
    "title","slug","description","category",
    "price","visibility","status","orgId","tags"
  ];
  for (const k of pick) {
    if (k in req.body) p[k] = req.body[k];
  }
  if ("ownerEmail" in req.body) {
    const owner = await User.findOne({ email: String(req.body.ownerEmail).toLowerCase() });
    p.ownerId = owner ? owner._id : null;
  }
  const doc = await Course.findByIdAndUpdate(id, { $set: p }, { new: true })
    .populate("ownerId", "name email")
    .populate("orgId", "name");
  if (!doc) return res.status(404).json({ ok: false });
  const o = sanitize(doc);
  o.ownerName = doc.ownerId?.name || null;
  o.ownerEmail = doc.ownerId?.email || null;
  o.orgName = doc.orgId?.name || null;
  return res.json(o);
}

// POST /sa/courses/:id/status
export async function setStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!["draft","published","archived"].includes(status)) return res.status(400).json({ ok: false });
  const doc = await Course.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!doc) return res.status(404).json({ ok: false });
  return res.json(sanitize(doc));
}

// DELETE /sa/courses/:id
export async function remove(req, res) {
  const { id } = req.params;
  await Course.deleteOne({ _id: id });
  return res.json({ ok: true });
}

// POST /sa/courses/bulk-upsert  (superadmin)
export async function bulkUpsert(req, res) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  let created = 0, updated = 0;

  for (const r of rows) {
    try {
      const title = String(r.title || "").trim();
      if (!title) continue;

      const slug = r.slug ? String(r.slug).trim().toLowerCase() : undefined;
      const orgId = r.orgId === "global" ? null : (r.orgId || null);

      let ownerId = null;
      if (r.ownerEmail) {
        const owner = await User.findOne({ email: String(r.ownerEmail).toLowerCase() }).select("_id");
        ownerId = owner ? owner._id : null;
      }

      const patch = {
        title,
        slug,
        description: r.description || null,
        category: r.category || null,
        price: Number.isFinite(r.price) ? r.price : 0,
        visibility: ["public","private","unlisted"].includes(String(r.visibility || "").toLowerCase())
          ? String(r.visibility).toLowerCase()
          : "unlisted",
        status: ["draft","published","archived"].includes(String(r.status || "").toLowerCase())
          ? String(r.status).toLowerCase()
          : "draft",
        tags: Array.isArray(r.tags) ? r.tags :
              (typeof r.tags === "string" ? String(r.tags).split(",").map(s=>s.trim()).filter(Boolean) : []),
        orgId,
        ownerId,
      };

      const criteria = {};
      if (slug) criteria.slug = slug;
      if (orgId === null) criteria.orgId = null;
      else criteria.orgId = orgId;

      let doc = null;
      if (slug) {
        doc = await Course.findOne(criteria);
      }
      if (doc) {
        await Course.updateOne({ _id: doc._id }, { $set: patch });
        updated++;
      } else {
        await Course.create(patch);
        created++;
      }
    } catch (_) { /* ignore malformed row */ }
  }

  return res.json({ created, updated, total: created + updated });
}
