// backend/src/routes/public.js
import { Router } from "express";
import { featured, byProgramType } from "../controllers/publicCatalogController.js";

const r = Router();

// Public catalog endpoints (no auth)
r.get("/catalog/featured", featured);
r.get("/catalog/by-program-type", byProgramType);

export default r;
