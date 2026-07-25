import AuditLog from '../models/AuditLog.js';

export const logAudit = async ({ actor, action, targetType, targetId, details, isOverride, overrideReason, req }) => {
  try {
    await AuditLog.create({
      actor: actor._id || actor,
      actorName: actor.name || '',
      actorRole: actor.role || '',
      action,
      targetType,
      targetId,
      details,
      isOverride: !!isOverride,
      overrideReason: overrideReason || '',
      ipAddress: req?.ip || req?.socket?.remoteAddress || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};
