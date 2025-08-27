//backend/src/routes/saCourses.js
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authz.js";
import * as ctrl from "../controllers/saCoursesController.js";

const r = Router();
r.use(requireAuth, requireRole("superadmin"));

r.get("/", ctrl.list);
r.post("/", ctrl.create);
r.post("/bulk-upsert", ctrl.bulkUpsert);
r.patch("/:id", ctrl.patch);
r.post("/:id/status", ctrl.setStatus);
r.delete("/:id", ctrl.remove);

export default r;
