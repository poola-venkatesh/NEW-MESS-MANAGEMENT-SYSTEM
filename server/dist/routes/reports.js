"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const billingService_1 = require("../services/billingService");
const pdfService_1 = require("../services/pdfService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
/**
 * GET /api/reports/statement-pdf/:studentId
 * Generate and stream official PDF mess statement
 * IDOR Protected: Student can only access their own statement
 */
router.get('/statement-pdf/:studentId', auth_1.requireSelfOrAdmin, async (req, res) => {
    const { studentId } = req.params;
    const filter = req.query.filter || 'month';
    const customStart = req.query.startDate;
    const customEnd = req.query.endDate;
    try {
        const statement = await (0, billingService_1.getStudentBillStatement)(studentId, filter, customStart, customEnd);
        const pdfBuffer = await (0, pdfService_1.generateStudentBillPdf)(statement);
        await (0, auditService_1.logAuditEvent)({
            actorUserId: req.user.id,
            actorRole: req.user.role,
            action: 'PDF_REPORT_GENERATED',
            entityType: 'Report',
            entityId: statement.student.id,
            details: {
                studentId: statement.student.studentId,
                filter,
                totalCharges: statement.summary.totalCharges,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });
        const filename = `mess-statement-${statement.student.studentId}-${filter}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);
    }
    catch (error) {
        console.error('PDF generation error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate PDF statement' });
    }
});
exports.default = router;
