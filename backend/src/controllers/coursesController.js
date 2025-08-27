//backend/src/controllers/coursesController.js
import Course from "../models/Course.js";

function sanitize(doc) {
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
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    tags: Array.isArray(o.tags) ? o.tags : [],
  };
}

// GET /courses  (admin + vendor)
export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const { q, status = "all" } = req.query || {};
  const and = [{ orgId: actor.orgId }];
  if (q) {
    const rx = { $regex: String(q), $options: "i" };
    and.push({ $or: [{ title: rx }, { slug: rx }, { category: rx }, { description: rx }, { tags: rx }] });
  }
  if (status !== "all") and.push({ status });

  const docs = await Course.find({ $and: and }).sort({ createdAt: -1 });
  return res.json(docs.map(sanitize));
}

// POST /courses
export async function create(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const { title, slug, description, category, price, visibility, status, tags } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, message: "title required" });

  const payload = {
    title, slug, description, category,
    price: Number.isFinite(price) ? price : 0,
    visibility: visibility || "unlisted",
    status: status || "draft",
    orgId: actor.orgId,
    ownerId: actor.role === "vendor" ? (actor.managerId || null) : actor._id || actor.sub || null,
    managerId: actor.role === "vendor" ? (actor.managerId || null) : null,
    tags: Array.isArray(tags) ? tags : (typeof tags === "string" ? String(tags).split(",").map(s=>s.trim()).filter(Boolean) : []),
  };

  const doc = await Course.create(payload);
  return res.json(sanitize(doc));
}

// PATCH /courses/:id
export async function patch(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false });

  const { id } = req.params;
  const allow = ["title","slug","description","category","price","visibility","status","tags"];
  const patch = {};
  for (const k of allow) if (k in req.body) patch[k] = req.body[k];

  const doc = await Course.findOneAndUpdate(
    { _id: id, orgId: actor.orgId },
    { $set: patch },
    { new: true }
  );
  if (!doc) return res.status(404).json({ ok: false });
  return res.json(sanitize(doc));
}

// POST /courses/:id/status
export async function setStatus(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false });

  const { id } = req.params;
  const { status } = req.body || {};
  if (!["draft","published","archived"].includes(status)) return res.status(400).json({ ok: false });

  const doc = await Course.findOneAndUpdate(
    { _id: id, orgId: actor.orgId },
    { $set: { status } },
    { new: true }
  );
  if (!doc) return res.status(404).json({ ok: false });
  return res.json(sanitize(doc));
}

// DELETE /courses/:id
export async function remove(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false });

  const { id } = req.params;
  const ok = await Course.deleteOne({ _id: id, orgId: actor.orgId });
  return res.json({ ok: ok.acknowledged });
}

// POST /courses/bulk-upsert  (admin + vendor)
export async function bulkUpsert(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  let created = 0, updated = 0;

  for (const r of rows) {
    try {
      const title = String(r.title || "").trim();
      if (!title) continue;

      const slug = r.slug ? String(r.slug).trim().toLowerCase() : undefined;
      const patch = {
        title,
        slug,
        description: r.description || null,
        category: r.category || null,
        price: Number.isFinite(r.price) ? r.price : 0, // expecting paise (client converts)
        visibility: ["public","private","unlisted"].includes(String(r.visibility || "").toLowerCase())
          ? String(r.visibility).toLowerCase()
          : "unlisted",
        status: ["draft","published","archived"].includes(String(r.status || "").toLowerCase())
          ? String(r.status).toLowerCase()
          : "draft",
        tags: Array.isArray(r.tags) ? r.tags :
              (typeof r.tags === "string" ? String(r.tags).split(",").map(s=>s.trim()).filter(Boolean) : []),
      };

      const criteria = { orgId: actor.orgId };
      if (slug) criteria.slug = slug;

      let doc = null;
      if (slug) {
        doc = await Course.findOne(criteria);
      }
      if (doc) {
        await Course.updateOne({ _id: doc._id }, { $set: patch });
        updated++;
      } else {
        doc = await Course.create({
          ...patch,
          orgId: actor.orgId,
          ownerId: actor.role === "vendor" ? (actor.managerId || null) : (actor._id || actor.sub || null),
          managerId: actor.role === "vendor" ? (actor.managerId || null) : null,
        });
        created++;
      }
    } catch (_) { /* skip bad row */ }
  }

  return res.json({ created, updated, total: created + updated });
}
