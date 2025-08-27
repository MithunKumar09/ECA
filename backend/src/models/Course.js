//backend/src/models/Course.js
import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug:  { type: String, trim: true, lowercase: true, index: true, sparse: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },
  price: { type: Number, default: 0 }, // paise
  visibility: { type: String, enum: ["public","private","unlisted"], default: "unlisted" },
  status: { type: String, enum: ["draft","published","archived"], default: "draft" },

  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null }, // null => Global
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // admin owner
  tags: [{ type: String, trim: true }],
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

CourseSchema.index({ orgId: 1, slug: 1 }, { unique: false, sparse: true });

export default mongoose.models.Course ?? mongoose.model("Course", CourseSchema);
