import { Router, Request, Response } from 'express';
import { requireAuth, requireSelfOrAdmin } from '../middleware/auth';
import { getStudentBillStatement, PeriodFilter } from '../services/billingService';
import { generateStudentBillPdf } from '../services/pdfService';
import { logAuditEvent } from '../services/auditService';

const router = Router();

/**
 * GET /api/reports/statement-pdf/:studentId
 * Generate and stream official PDF mess statement
 * IDOR Protected: Student can only access their own statement
 */
router.get('/statement-pdf/:studentId', requireSelfOrAdmin, async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const filter = (req.query.filter as PeriodFilter) || 'month';
  const customStart = req.query.startDate as string;
  const customEnd = req.query.endDate as string;

  try {
    const statement = await getStudentBillStatement(
      studentId,
      filter,
      customStart,
      customEnd
    );

    const pdfBuffer = await generateStudentBillPdf(statement);

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
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
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate PDF statement' });
  }
});

export default router;
