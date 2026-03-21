// backend/src/routes/vendor.js
import { Router } from "express";
import { requireAuth, requireAnyRole } from "../middleware/authz.js";
import { listVendorStudents } from "../controllers/vendorController.js";

const r = Router();
r.use(requireAuth);
r.use(requireAnyRole("vendor"));

r.get("/students", listVendorStudents);

export default r;
