// backend/src/routes/teacher.js
import { Router } from "express";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import {
  listTeacherStudents,
  markStudentComplete,
  getStudentProgress,
} from "../controllers/teacherController.js";

const r = Router();

r.use(requireAuth);
// Accept both "teacher" (new) and "vendor" (old JWT — backward compat during migration window)
r.use(requireAnyRole("vendor", "teacher"));

r.get("/students", listTeacherStudents);
r.post("/students/:studentId/courses/:courseId/complete", markStudentComplete);
r.get("/students/:studentId/courses/:courseId/progress", getStudentProgress);

export default r;
