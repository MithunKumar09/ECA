// backend/src/controllers/publicCatalogController.js
import Course from "../models/Course.js";

/** Map DB course doc to lightweight public card */
function toCard(c) {
  const o = c.toObject ? c.toObject() : c;
  const courseType =
    o.courseType === "free" || o.courseType === "paid"
      ? o.courseType
      : Number(o.price) > 0
      ? "paid"
      : "free";

  return {
    id: String(o._id),
    slug: o.slug || null,
    title: o.title || "",
    courseType,               // "free" | "paid"
    price: Number(o.price) || 0,              // paise
    pricePaise: Number(o.price) || 0,
    coverUrl: o.bundleCoverUrl || o.coverUrl || o.image || null,
    ratingAvg: Number(o.ratingAvg) || 0,
    ratingCount: Number(o.ratingCount) || 0,
    durationText: o.durationText || null,
    createdAt: o.createdAt || null,
  };
}

/** Enhanced card mapper with all fields needed for home page display */
function toHomeCard(c) {
  const o = c.toObject ? c.toObject() : c;
  const courseType =
    o.courseType === "free" || o.courseType === "paid"
      ? o.courseType
      : Number(o.price) > 0
      ? "paid"
      : "free";

  // Handle teacherId - could be an ObjectId string or populated object
  let teacherIdStr = "";
  let teacherNameStr = null;
  
  if (o.teacherId) {
    if (typeof o.teacherId === 'object' && o.teacherId._id) {
      // Populated teacher object
      teacherIdStr = String(o.teacherId._id);
      teacherNameStr = o.teacherId.name || null;
    } else {
      // Just the ID string
      teacherIdStr = String(o.teacherId);
    }
  }

  return {
    id: String(o._id),
    slug: o.slug || null,
    title: o.title || "",
    category: o.category || null,
    programType: o.programType || null,
    courseType,               // "free" | "paid"
    price: Number(o.price) || 0,              // paise
    pricePaise: Number(o.price) || 0,
    coverUrl: o.bundleCoverUrl || o.coverUrl || o.image || null,
    demoVideoUrl: o.demoVideoUrl || null,
    ratingAvg: Number(o.ratingAvg) || 0,
    ratingCount: Number(o.ratingCount) || 0,
    durationText: o.durationText || null,
    createdAt: o.createdAt || null,
    updatedAt: o.updatedAt || null,
    teacherId: teacherIdStr,
    teacherName: teacherNameStr,
  };
}

/** GET /api/public/catalog/featured
 * Latest 3 paid + latest 3 free (published + public). No auth.
 */
export async function featured(_req, res) {
  try {
    const baseMatch = { status: "published", visibility: "public" };

    const [paid, free] = await Promise.all([
      Course.find({ ...baseMatch, courseType: "paid" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(3),
      Course.find({ ...baseMatch, courseType: "free" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(3),
    ]);

    return res.json({
      paid: paid.map(toCard),
      free: free.map(toCard),
    });
  } catch (err) {
    console.error("[publicCatalog.featured] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

/** GET /api/public/catalog/by-program-type
 * Fetch one most recent course for each unique programType (published + public). No auth.
 */
export async function byProgramType(_req, res) {
  try {
    const baseMatch = { status: "published", visibility: "public" };

    // Get all published + public courses, ordered by most recent
    const allCourses = await Course.find(baseMatch)
      .sort({ updatedAt: -1, createdAt: -1 })
      .select("programType updatedAt createdAt");

    // Track unique programTypes and get only the first (most recent) course for each
    const seenTypes = new Set();
    const coursesByType = [];

    for (const course of allCourses) {
      const programType = course.programType;
      if (programType && !seenTypes.has(programType)) {
        seenTypes.add(programType);
        coursesByType.push(course._id);
      }
    }

    // Now fetch the full course data for these IDs with populated teacher
    const courses = await Course.find({ _id: { $in: coursesByType } })
      .populate('teacherId', 'name')
      .sort({ updatedAt: -1, createdAt: -1 });

    return res.json({
      ok: true,
      courses: courses.map(toHomeCard),
    });
  } catch (err) {
    console.error("[publicCatalog.byProgramType] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
