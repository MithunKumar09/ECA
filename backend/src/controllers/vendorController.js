// backend/src/controllers/vendorController.js
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";

const isOid = (v) => mongoose.isValidObjectId(v);
const { ObjectId } = mongoose.Types;

/**
 * GET /api/vendor/students
 * Returns enrollments for courses where course.teacherId === currentUser._id
 * Vendor only sees their own assigned courses — no cross-teacher leakage.
 */
export async function listVendorStudents(req, res) {
  try {
    const actor = req.user;
    const actorId = actor?._id || actor?.id || actor?.sub;
    if (!actorId || !isOid(actorId)) return res.status(401).json({ ok: false });

    const { courseId, status, page: pageRaw, limit: limitRaw } = req.query;

    const page  = Math.max(1, parseInt(pageRaw)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw) || 20));
    const skip  = (page - 1) * limit;

    // 🔒 Only courses assigned to this vendor (teacherId = currentUser)
    const courseFilter = { teacherId: new ObjectId(String(actorId)) };
    if (courseId && isOid(courseId)) courseFilter._id = new ObjectId(String(courseId));

    const vendorCourses = await Course.find(courseFilter).select("_id title").lean();
    if (!vendorCourses.length) {
      return res.json({ items: [], total: 0 });
    }

    const courseIds = vendorCourses.map(c => c._id);
    const courseMap = new Map(vendorCourses.map(c => [String(c._id), c.title || ""]));

    // Build enrollment query
    const enrollFilter = { courseId: { $in: courseIds } };
    if (status) enrollFilter.status = status;

    const [enrollments, total] = await Promise.all([
      Enrollment.find(enrollFilter)
        .select("_id studentId courseId status createdAt progressPercent")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments(enrollFilter),
    ]);

    // Bulk-fetch student names/emails
    const studentIds = [...new Set(enrollments.map(e => String(e.studentId)))].filter(isOid);
    const studentMap = new Map();
    if (studentIds.length) {
      const users = await User.find({ _id: { $in: studentIds } })
        .select("_id name fullName firstName lastName email")
        .lean();
      for (const u of users) {
        const name = u.name || u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        studentMap.set(String(u._id), { name, email: u.email || null });
      }
    }

    const items = enrollments.map(e => {
      const student = studentMap.get(String(e.studentId)) || {};
      return {
        enrollmentId: String(e._id),
        studentId:    String(e.studentId),
        studentName:  student.name  || null,
        studentEmail: student.email || null,
        courseId:     String(e.courseId),
        courseTitle:  courseMap.get(String(e.courseId)) || null,
        enrollmentStatus: e.status,
        enrolledAt:   e.createdAt,
        progressPercent: e.progressPercent ?? null,
      };
    });

    return res.json({ items, total });
  } catch (e) {
    console.error("[vendor.listStudents]", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
