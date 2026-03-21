/**
 * PHASE 2 — One-time DB migration: vendor → teacher
 *
 * RUN AFTER Phase 1 backend is deployed.
 * RUN ONCE in a maintenance window.
 * All active sessions with role:"vendor" in their JWT will be invalidated;
 * users must re-login to receive a new token with role:"teacher".
 *
 * Usage:
 *   node backend/scripts/migrate-vendor-to-teacher.js
 *
 * Requires MONGODB_URI in env (or .env file loaded by dotenv).
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set.");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;

  // 1. Rename role: "vendor" → "teacher" on all user documents
  const usersResult = await db.collection("users").updateMany(
    { role: "vendor" },
    { $set: { role: "teacher" } }
  );
  console.log(`users: ${usersResult.modifiedCount} documents updated (vendor → teacher).`);

  // 2. Rename source: "vendor" → "teacher" in enrollments
  const enrollmentsResult = await db.collection("enrollments").updateMany(
    { source: "vendor" },
    { $set: { source: "teacher" } }
  );
  console.log(`enrollments: ${enrollmentsResult.modifiedCount} documents updated (source vendor → teacher).`);

  await mongoose.disconnect();
  console.log("Migration complete. All vendor users are now teacher users.");
  console.log("NOTE: All existing JWT tokens with role:'vendor' are now invalid.");
  console.log("      Users must re-login to receive a new token with role:'teacher'.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
