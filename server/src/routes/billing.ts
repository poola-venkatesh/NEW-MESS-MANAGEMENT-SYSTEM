import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin, requireAuth, requireSelfOrAdmin } from '../middleware/auth';
import {
  getStudentBillStatement,
  PeriodFilter,
} from '../services/billingService';
import { getCurrentDateStr, getCurrentActiveMealSession } from '../services/mealSessionService';
import { logAuditEvent } from '../services/auditService';

const router = Router();

const paymentSchema = z.object({
  studentProfileId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD']),
  referenceNo: z.string().optional().or(z.literal('')),
  receiptNotes: z.string().optional().or(z.literal('')),
});

const adjustmentSchema = z.object({
  studentProfileId: z.string().uuid(),
  amount: z.number().positive('Adjustment amount must be positive'),
  type: z.enum(['CREDIT_REFUND', 'DEBIT_CORRECTION']),
  reason: z.string().min(5, 'Mandatory audit reason required for financial adjustment'),
});

/**
 * GET /api/billing/dashboard-stats
 * Comprehensive metrics for Admin Dashboard or Student Dashboard
 */
router.get('/dashboard-stats', requireAuth, async (req: Request, res: Response) => {
  const todayStr = getCurrentDateStr();

  try {
    if (req.user?.role === 'ADMIN') {
      // 1. Total registered & active students
      const totalStudents = await prisma.studentProfile.count({
        where: { softDeleted: false },
      });
      const activeStudents = await prisma.studentProfile.count({
        where: { softDeleted: false, user: { isActive: true } },
      });
      const enrolledFaces = await prisma.studentProfile.count({
        where: { softDeleted: false, faceEnrolled: true },
      });

      // 2. Today's attendance
      const todayAttendances = await prisma.attendance.findMany({
        where: { date: todayStr, status: 'VALID' },
        include: { mealSession: true },
      });

      const mealWiseCounts: Record<string, number> = {
        BREAKFAST: 0,
        LUNCH: 0,
        SNACKS: 0,
        DINNER: 0,
      };

      todayAttendances.forEach((a) => {
        const name = a.mealSession.name;
        mealWiseCounts[name] = (mealWiseCounts[name] || 0) + 1;
      });

      // 3. Today's charges
      const todayCharges = await prisma.charge.aggregate({
        where: { date: todayStr, status: 'APPLIED' },
        _sum: { amount: true },
      });

      // 4. Overall financials
      const allCharges = await prisma.charge.aggregate({
        where: { status: 'APPLIED' },
        _sum: { amount: true },
      });
      const allPayments = await prisma.payment.aggregate({
        _sum: { amount: true },
      });
      const allCreditAdjustments = await prisma.adjustment.aggregate({
        where: { type: 'CREDIT_REFUND' },
        _sum: { amount: true },
      });
      const allDebitAdjustments = await prisma.adjustment.aggregate({
        where: { type: 'DEBIT_CORRECTION' },
        _sum: { amount: true },
      });

      const totalChargesNum = Number(allCharges._sum.amount || 0);
      const totalPaymentsNum = Number(allPayments._sum.amount || 0);
      const netAdjustmentsNum =
        Number(allCreditAdjustments._sum.amount || 0) -
        Number(allDebitAdjustments._sum.amount || 0);

      const totalOutstanding = Number(
        (totalChargesNum - totalPaymentsNum - netAdjustmentsNum).toFixed(2)
      );

      // 5. Current meal session
      const currentSessionInfo = await getCurrentActiveMealSession();

      // 6. Recent attendance activity
      const recentActivity = await prisma.attendance.findMany({
        where: { status: 'VALID' },
        include: {
          student: { select: { fullName: true, studentId: true } },
          mealSession: { select: { name: true, price: true } },
        },
        orderBy: { verifiedAt: 'desc' },
        take: 10,
      });

      return res.json({
        role: 'ADMIN',
        metrics: {
          totalStudents,
          activeStudents,
          enrolledFaces,
          todayTotalAttendance: todayAttendances.length,
          mealWiseAttendance: mealWiseCounts,
          todayCharges: Number((todayCharges._sum.amount || 0).toFixed(2)),
          totalPaymentsReceived: Number(totalPaymentsNum.toFixed(2)),
          totalOutstandingBalances: totalOutstanding,
        },
        currentMealSession: currentSessionInfo.activeSession,
        recentActivity,
      });
    }

    // Student specific stats
    if (req.user?.role === 'STUDENT' && req.user.studentProfile) {
      const studentId = req.user.studentProfile.id;

      const [todayStatement, weekStatement, monthStatement, semesterStatement, yearStatement] =
        await Promise.all([
          getStudentBillStatement(studentId, 'today'),
          getStudentBillStatement(studentId, 'week'),
          getStudentBillStatement(studentId, 'month'),
          getStudentBillStatement(studentId, 'semester'),
          getStudentBillStatement(studentId, 'year'),
        ]);

      const currentSessionInfo = await getCurrentActiveMealSession();

      // Check if student attended today's meals
      const todayAttendances = await prisma.attendance.findMany({
        where: {
          studentId,
          date: todayStr,
          status: 'VALID',
        },
        include: { mealSession: true },
      });

      return res.json({
        role: 'STUDENT',
        student: req.user.studentProfile,
        todayAttendance: todayAttendances.map((a) => ({
          meal: a.mealSession.name,
          time: a.verifiedAt,
          price: a.mealSession.price,
        })),
        chargesSummary: {
          today: todayStatement.summary.totalCharges,
          week: weekStatement.summary.totalCharges,
          month: monthStatement.summary.totalCharges,
          semester: semesterStatement.summary.totalCharges,
          year: yearStatement.summary.totalCharges,
        },
        paymentsRecorded: monthStatement.summary.totalPayments,
        outstandingBalance: monthStatement.summary.outstandingBalance,
        currentMealSession: currentSessionInfo.activeSession,
      });
    }

    return res.status(403).json({ error: 'Unauthorized profile' });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
  }
});

/**
 * GET /api/billing/statement/:studentId
 * Itemized consumption-based statement with period filter (IDOR protected)
 */
router.get('/statement/:studentId', requireSelfOrAdmin, async (req: Request, res: Response) => {
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
    return res.json({ statement });
  } catch (error: any) {
    console.error('Get statement error:', error);
    return res.status(400).json({ error: error.message || 'Failed to generate statement' });
  }
});

/**
 * POST /api/billing/payments
 * Record a payment from a student (Admin only)
 */
router.post('/payments', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = paymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { studentProfileId, amount, paymentMethod, referenceNo, receiptNotes } =
    parseResult.data;

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
    });
    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount,
        paymentMethod,
        referenceNo: referenceNo || null,
        receivedByUserId: req.user!.id,
        receiptNotes: receiptNotes || null,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: payment.id,
      details: {
        studentId: student.studentId,
        amount,
        paymentMethod,
        referenceNo,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.status(201).json({
      message: `Payment of ₹${amount.toFixed(2)} recorded for ${student.fullName}`,
      payment,
    });
  } catch (error) {
    console.error('Record payment error:', error);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * POST /api/billing/adjustments
 * Record an audited adjustment or refund (Admin only)
 */
router.post('/adjustments', requireAdmin, async (req: Request, res: Response) => {
  const parseResult = adjustmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => e.message),
    });
  }

  const { studentProfileId, amount, type, reason } = parseResult.data;

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
    });
    if (!student || student.softDeleted) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const adjustment = await prisma.adjustment.create({
      data: {
        studentId: student.id,
        amount,
        type,
        reason,
        authorizedByUserId: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'FINANCIAL_ADJUSTMENT_RECORDED',
      entityType: 'Adjustment',
      entityId: adjustment.id,
      details: {
        studentId: student.studentId,
        amount,
        type,
        reason,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return res.status(201).json({
      message: `Adjustment of ₹${amount.toFixed(2)} (${type}) recorded for ${
        student.fullName
      }`,
      adjustment,
    });
  } catch (error) {
    console.error('Record adjustment error:', error);
    return res.status(500).json({ error: 'Failed to record adjustment' });
  }
});

export default router;
