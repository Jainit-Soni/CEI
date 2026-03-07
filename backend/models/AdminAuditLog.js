/**
 * models/AdminAuditLog.js — CEI Admin Action Audit Trail
 * ========================================================
 * Logs every admin action with email, action type, resource, and IP.
 * Written on every successful admin API request (non-blocking fire-and-forget).
 *
 * Indexes on adminEmail + timestamp for fast dashboard queries.
 */

'use strict';

const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema({
    adminEmail: { type: String, required: true, index: true },
    adminUid: { type: String, default: null },
    action: { type: String, required: true },          // e.g. "resolve_report", "trigger_job"
    resource: { type: String, required: true },          // e.g. "/api/admin/report/abc/resolve"
    method: { type: String, default: 'GET' },          // HTTP method
    ip: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 300 },
    meta: { type: mongoose.Schema.Types.Mixed, default: null }, // Extra context (job name, college id...)
    timestamp: { type: Date, default: Date.now, index: true },
}, {
    collection: 'admin_audit_logs',
    versionKey: false,
});

AdminAuditLogSchema.index({ adminEmail: 1, timestamp: -1 });

module.exports = mongoose.models.AdminAuditLog ||
    mongoose.model('AdminAuditLog', AdminAuditLogSchema);
