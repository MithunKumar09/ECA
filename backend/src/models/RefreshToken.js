// backend/src/models/RefreshToken.js
import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    jti:         { type: String, unique: true, required: true },
    exp:         { type: Date, required: true },
    // device: raw User-Agent string (kept as String for backward compatibility)
    device:      { type: String },
    // New session-tracking fields
    ip:          { type: String, default: null },
    lastUsedAt:  { type: Date, default: Date.now },
    isRevoked:   { type: Boolean, default: false },
    // Rotation bookkeeping (existing)
    revokedAt:   { type: Date },
    replacedBy:  { type: String },
  },
  { timestamps: true }
);

// TTL: MongoDB auto-deletes expired tokens (expireAfterSeconds: 0 = remove as soon as exp passes)
RefreshTokenSchema.index({ exp: 1 }, { expireAfterSeconds: 0 });
// Fast lookup for session list per user
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export default mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", RefreshTokenSchema);
