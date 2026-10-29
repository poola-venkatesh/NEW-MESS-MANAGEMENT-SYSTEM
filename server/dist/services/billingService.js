"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePeriodDateRange = resolvePeriodDateRange;
exports.getStudentBillStatement = getStudentBillStatement;
const prisma_1 = require("../prisma");
const mealSessionService_1 = require("./mealSessionService");
/**
 * Resolves start and end dates based on filter type
 */
async function resolvePeriodDateRange(filter, customStart, customEnd) {
    const todayStr = (0, mealSessionService_1.getCurrentDateStr)();
    const today = new Date(todayStr);
    switch (filter) {
        case 'today':
            return { startDate: todayStr, endDate: todayStr };
        case 'week': {
            // Past 7 days up to today
            const pastWeek = new Date(today);
            pastWeek.setDate(today.getDate() - 6);
            return {
                startDate: pastWeek.toISOString().split('T')[0],
                endDate: todayStr,
            };
        }
        case 'month': {
            // 1st of current month to current day
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            return {
                startDate: firstDay.toISOString().split('T')[0],
                endDate: todayStr,
            };
        }
        case 'semester': {
            // Check if an active semester is configured in AcademicCalendar
            const activeSemester = await prisma_1.prisma.academicCalendar.findFirst({
                where: { type: 'SEMESTER', isActive: true },
                orderBy: { startDate: 'desc' },
            });
            if (activeSemester) {
                return {
                    startDate: activeSemester.startDate,
                    endDate: activeSemester.endDate < todayStr ? activeSemester.endDate : todayStr,
                };
            }
            // Fallback: 120 days ago to today
            const fallback = new Date(today);
            fallback.setDate(today.getDate() - 120);
            return {
                startDate: fallback.toISOString().split('T')[0],
                endDate: todayStr,
            };
        }
        case 'year': {
            const activeYear = await prisma_1.prisma.academicCalendar.findFirst({
                where: { type: 'ACADEMIC_YEAR', isActive: true },
                orderBy: { startDate: 'desc' },
            });
            if (activeYear) {
                return {
                    startDate: activeYear.startDate,
                    endDate: activeYear.endDate < todayStr ? activeYear.endDate : todayStr,
                };
            }
            // Fallback: 365 days ago to today
            const fallback = new Date(today);
            fallback.setDate(today.getDate() - 365);
            return {
                startDate: fallback.toISOString().split('T')[0],
                endDate: todayStr,
            };
        }
        case 'custom':
            if (!customStart || !customEnd) {
                throw new Error('startDate and endDate are required for custom filter');
            }
            return { startDate: customStart, endDate: customEnd };
        default:
            return { startDate: todayStr, endDate: todayStr };
    }
}
/**
 * Calculates itemized, strictly consumption-based bill statement for a student
 */
async function getStudentBillStatement(studentProfileId, filter = 'month', customStart, customEnd) {
    const student = await prisma_1.prisma.studentProfile.findUnique({
        where: { id: studentProfileId },
        include: { user: true },
    });
    if (!student) {
        throw new Error('Student record not found');
    }
    const range = await resolvePeriodDateRange(filter, customStart, customEnd);
    // Retrieve valid charges within date range
    const charges = await prisma_1.prisma.charge.findMany({
        where: {
            studentId: studentProfileId,
            date: {
                gte: range.startDate,
                lte: range.endDate,
            },
            status: 'APPLIED',
        },
        include: {
            attendance: true,
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    // Retrieve payments within range
    // Convert startDate and endDate to Date boundaries
    const startDateTime = new Date(`${range.startDate}T00:00:00.000Z`);
    const endDateTime = new Date(`${range.endDate}T23:59:59.999Z`);
    const payments = await prisma_1.prisma.payment.findMany({
        where: {
            studentId: studentProfileId,
            createdAt: {
                gte: startDateTime,
                lte: endDateTime,
            },
        },
        orderBy: { createdAt: 'asc' },
    });
    // Retrieve adjustments within range
    const adjustments = await prisma_1.prisma.adjustment.findMany({
        where: {
            studentId: studentProfileId,
            createdAt: {
                gte: startDateTime,
                lte: endDateTime,
            },
        },
        orderBy: { createdAt: 'asc' },
    });
    const totalCharges = Number(charges.reduce((acc, c) => acc + Number(c.amount), 0).toFixed(2));
    const totalPayments = Number(payments.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2));
    // Credit refunds reduce the balance; debit corrections increase the balance
    const totalAdjustments = Number(adjustments.reduce((acc, a) => {
        return a.type === 'CREDIT_REFUND' ? acc + Number(a.amount) : acc - Number(a.amount);
    }, 0).toFixed(2));
    // Final outstanding balance = charges - payments - adjustments
    const outstandingBalance = Number((totalCharges - totalPayments - totalAdjustments).toFixed(2));
    return {
        student: {
            id: student.id,
            studentId: student.studentId,
            fullName: student.fullName,
            email: student.email,
            hostelBlock: student.hostelBlock,
            roomNo: student.roomNo,
        },
        period: {
            filter,
            startDate: range.startDate,
            endDate: range.endDate,
        },
        itemizedCharges: charges.map((c) => ({
            id: c.id,
            date: c.date,
            mealName: c.mealName,
            amount: Number(c.amount),
            verifiedAt: c.attendance?.verifiedAt || null,
            verificationMethod: c.attendance?.verificationMethod || null,
            status: c.status,
        })),
        payments: payments.map((p) => ({
            id: p.id,
            date: p.createdAt,
            amount: Number(p.amount),
            paymentMethod: p.paymentMethod,
            referenceNo: p.referenceNo,
            receiptNotes: p.receiptNotes,
        })),
        adjustments: adjustments.map((a) => ({
            id: a.id,
            date: a.createdAt,
            amount: Number(a.amount),
            type: a.type,
            reason: a.reason,
        })),
        summary: {
            totalMealsAttended: charges.length,
            totalCharges,
            totalPayments,
            totalAdjustments,
            outstandingBalance,
        },
    };
}
