// backend/scripts/reconcilePayments.js  (ESM)
//
// Finds all "captured" payments that have no matching enrollment and reports them.
// Default: dry-run (read-only). Pass --fix to create missing enrollments.
//
// Usage:
//   node scripts/reconcilePayments.js           # dry-run
//   node scripts/reconcilePayments.js --fix     # create missing enrollments

import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../src/config/mongo.js";
import Payment from "../src/models/Payment.js";
import Enrollment from "../src/models/Enrollment.js";

const DRY_RUN = !process.argv.includes("--fix");
const isOid = (v) => mongoose.isValidObjectId(v);
const toId = (v) => (isOid(v) ? new mongoose.Types.ObjectId(String(v)) : null);

async function run() {
  await connectMongo();
  console.log(`[reconcile] mode=${DRY_RUN ? "DRY-RUN" : "FIX"}`);

  const payments = await Payment.find({ status: "captured" })
    .select("_id studentId courseId orgId type method createdAt")
    .lean();

  console.log(`[reconcile] total captured payments: ${payments.length}`);

  let missing = 0;
  let fixed = 0;
  let skipped = 0;

  for (const p of payments) {
    const sid = toId(p.studentId);
    const cid = toId(p.courseId);
    const oid = toId(p.orgId);

    if (!sid || !cid || !oid) {
      console.warn(`[reconcile] SKIP payment=${p._id} — invalid ids (sid=${!!sid} cid=${!!cid} oid=${!!oid})`);
      skipped++;
      continue;
    }

    const enrollment = await Enrollment.findOne({ studentId: sid, courseId: cid, orgId: oid })
      .select("_id status")
      .lean();

    if (enrollment) continue; // enrollment exists — OK

    missing++;
    console.log(
      `[reconcile] MISSING enrollment — payment=${p._id} student=${sid} course=${cid} org=${oid} type=${p.type} created=${p.createdAt?.toISOString()}`
    );

    if (DRY_RUN) continue;

    // --fix: create the enrollment
    try {
      const result = await Enrollment.updateOne(
        { studentId: sid, courseId: cid, orgId: oid },
        {
          $setOnInsert: {
            studentId: sid,
            courseId: cid,
            orgId: oid,
            status: "premium",
            source: "reconcile",
            paymentId: p._id,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      if (result.upsertedCount) {
        console.log(`[reconcile] FIXED enrollment created — payment=${p._id} student=${sid} course=${cid}`);
        fixed++;
      } else {
        console.log(`[reconcile] enrollment already existed (race) — payment=${p._id}`);
      }
    } catch (e) {
      if (e?.code === 11000) {
        console.log(`[reconcile] duplicate key (race) — payment=${p._id}`);
      } else {
        console.error(`[reconcile] ERROR fixing payment=${p._id}:`, e?.message);
      }
    }
  }

  console.log(
    `[reconcile] done — checked=${payments.length} missing=${missing} skipped=${skipped}${DRY_RUN ? "" : ` fixed=${fixed}`}`
  );

  await disconnectMongo();
  process.exit(0);
}

run().catch((e) => {
  console.error("[reconcile] fatal:", e);
  process.exit(1);
});
