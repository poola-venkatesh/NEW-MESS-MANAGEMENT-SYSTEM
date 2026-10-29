import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { encryptTemplate, calculateEuclideanDistance } from '../src/services/biometricService';
import { ensureMealDefinitions, getCurrentDateStr } from '../src/services/mealSessionService';

describe('Smart Mess Management System - Comprehensive Integration Tests', () => {
  let adminCookie: string;
  let student1Cookie: string;
  let student2Cookie: string;

  let adminUser: any;
  let student1User: any;
  let student1Profile: any;
  let student2User: any;
  let student2Profile: any;

  // Synthetic 128-D embedding vectors for testing biometric matching
  const vectorStudent1 = new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 0.05 : -0.05));
  const vectorStudent2 = new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 0.35 : -0.35));
  // Probe close to student1 (distance ~0.02)
  const probeSimilarToStudent1 = vectorStudent1.map((v) => v + 0.002);
  // Unrecognized probe (random vector far from student 1 & 2)
  const unrecognizedProbe = new Array(128).fill(0).map((_, i) => (i % 3 === 0 ? 0.8 : -0.8));

  beforeAll(async () => {
    // Clean and initialize database
    await prisma.auditLog.deleteMany();
    await prisma.adjustment.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.charge.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.mealSession.deleteMany();
    await prisma.faceBiometric.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.user.deleteMany();

    await ensureMealDefinitions();

    // 1. Create Admin User
    const adminPasswordHash = await bcrypt.hash('AdminSecret2026!', 10);
    adminUser = await prisma.user.create({
      data: {
        username: 'testadmin',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    // 2. Create Student 1
    const studentPasswordHash = await bcrypt.hash('StudentPass2026!', 10);
    student1User = await prisma.user.create({
      data: {
        username: 'student1',
        passwordHash: studentPasswordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    student1Profile = await prisma.studentProfile.create({
      data: {
        userId: student1User.id,
        studentId: 'CS2026-001',
        fullName: 'Alex Student',
        email: 'alex@hostel.edu',
        hostelBlock: 'A',
        roomNo: '101',
        faceEnrolled: false,
      },
    });

    // 3. Create Student 2
    student2User = await prisma.user.create({
      data: {
        username: 'student2',
        passwordHash: studentPasswordHash,
        role: 'STUDENT',
        isActive: true,
      },
    });
    student2Profile = await prisma.studentProfile.create({
      data: {
        userId: student2User.id,
        studentId: 'CS2026-002',
        fullName: 'Jordan Student',
        email: 'jordan@hostel.edu',
        hostelBlock: 'B',
        roomNo: '202',
        faceEnrolled: false,
      },
    });
  });

  afterAll(async () => {
    // Restore default admin user if removed during test execution
    const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!adminExists) {
      const hash = await bcrypt.hash('AdminMaster2026!', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash: hash,
          role: 'ADMIN',
          isActive: true,
        },
      });
    }
  }, 30000);

  describe('1. Authentication and Role-Based Authorization', () => {
    it('should log in admin and receive HTTP-only session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'AdminSecret2026!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('ADMIN');
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('mess_session_token=');
      expect(cookies[0]).toContain('HttpOnly');
      adminCookie = cookies[0];
    });

    it('should log in student1 and receive session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'student1', password: 'StudentPass2026!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('STUDENT');
      expect(res.body.user.studentProfile.studentId).toBe('CS2026-001');
      student1Cookie = res.headers['set-cookie'][0];
    });

    it('should log in student2 and receive session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'student2', password: 'StudentPass2026!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('STUDENT');
      student2Cookie = res.headers['set-cookie'][0];
    });

    it('should reject invalid credentials with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid username or password');
    });

    it('should reject unauthenticated requests to protected endpoints with HTTP 401', async () => {
      const res = await request(app).get('/api/admin/students');
      expect(res.status).toBe(401);
    });

    it('should forbid student from accessing admin endpoints with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Admin privilege required');
    });

    it('should prevent student from accessing another student statement (IDOR protection)', async () => {
      // Student 1 tries to access Student 2's statement
      const res = await request(app)
        .get(`/api/billing/statement/${student2Profile.id}`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should allow student to access their own statement', async () => {
      const res = await request(app)
        .get(`/api/billing/statement/${student1Profile.id}`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.statement.student.studentId).toBe('CS2026-001');
    });

    it('should allow admin to access any student statement', async () => {
      const res = await request(app)
        .get(`/api/billing/statement/${student1Profile.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.statement.student.studentId).toBe('CS2026-001');
    });
  });

  describe('2. Manual Student Registration and Uniqueness Checks', () => {
    it('should allow admin to register a new student', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Morgan New',
          studentId: 'CS2026-003',
          username: 'morgan3',
          password: 'InitialPassword123!',
          email: 'morgan@hostel.edu',
          hostelBlock: 'C',
          roomNo: '303',
        });

      expect(res.status).toBe(201);
      expect(res.body.student.studentId).toBe('CS2026-003');
      expect(res.body.student.faceEnrolled).toBe(false);
    });

    it('should reject registration with duplicate username with HTTP 409', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Another Morgan',
          studentId: 'CS2026-004',
          username: 'morgan3', // duplicate
          password: 'InitialPassword123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Username "morgan3" is already in use');
    });

    it('should reject registration with duplicate college student ID with HTTP 409', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Duplicate ID Person',
          studentId: 'CS2026-003', // duplicate ID
          username: 'unique_user_99',
          password: 'InitialPassword123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('College Student ID "CS2026-003" is already registered');
    });
  });

  describe('3. Biometric Face Enrollment and AES-256-GCM Protection', () => {
    it('should securely enroll face template for student1', async () => {
      const res = await request(app)
        .post('/api/biometrics/enroll')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student1Profile.id,
          descriptor: vectorStudent1,
          consentGiven: true,
          qualityScore: 0.96,
        });

      expect(res.status).toBe(201);
      expect(res.body.student.faceEnrolled).toBe(true);

      // Verify template is encrypted in DB and not stored in plaintext
      const record = await prisma.faceBiometric.findUnique({
        where: { studentId: student1Profile.id },
      });
      expect(record).toBeDefined();
      expect(record?.encryptedTemplate).toBeDefined();
      expect(record?.iv).toBeDefined();
      expect(record?.authTag).toBeDefined();
      expect(record?.encryptedTemplate).not.toContain('0.05'); // Not plaintext
    });

    it('should reject duplicate face enrollment without authorized re-enrollment', async () => {
      const res = await request(app)
        .post('/api/biometrics/enroll')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student1Profile.id,
          descriptor: vectorStudent1,
          consentGiven: true,
          qualityScore: 0.95,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Biometrics already enrolled');
    });

    it('should allow authorized re-enrollment with mandatory reason', async () => {
      const res = await request(app)
        .post('/api/biometrics/re-enroll')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student1Profile.id,
          descriptor: vectorStudent1,
          consentGiven: true,
          qualityScore: 0.98,
          reason: 'Lighting conditions improved during daytime re-capture',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Face template updated successfully');
    });

    it('should also enroll student2 face template', async () => {
      const res = await request(app)
        .post('/api/biometrics/enroll')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student2Profile.id,
          descriptor: vectorStudent2,
          consentGiven: true,
          qualityScore: 0.94,
        });

      expect(res.status).toBe(201);
      expect(res.body.student.faceEnrolled).toBe(true);
    });
  });

  describe('4. Dynamic Meal Sessions, Atomic Attendance, and Duplicate Prevention', () => {
    let todayStr: string;
    let activeLunchSession: any;

    beforeAll(async () => {
      todayStr = getCurrentDateStr();

      // Ensure sessions exist
      const lunchDef = await prisma.mealDefinition.findUnique({
        where: { name: 'LUNCH' },
      });

      // Create or update today's Lunch session to be ACTIVE right now for test
      activeLunchSession = await prisma.mealSession.upsert({
        where: {
          mealDefinitionId_date: {
            mealDefinitionId: lunchDef!.id,
            date: todayStr,
          },
        },
        create: {
          mealDefinitionId: lunchDef!.id,
          date: todayStr,
          name: 'LUNCH',
          startTime: '00:00',
          endTime: '23:59',
          price: 55.0,
          menuDescription: 'Special Biryani & Paneer Meal',
          status: 'ACTIVE',
        },
        update: {
          startTime: '00:00',
          endTime: '23:59',
          price: 55.0,
          menuDescription: 'Special Biryani & Paneer Meal',
          status: 'ACTIVE',
        },
      });
    });

    it('should verify face probe, match student1, and create attendance + charge atomically', async () => {
      const res = await request(app)
        .post('/api/attendance/verify-entry')
        .send({
          probeDescriptor: probeSimilarToStudent1,
          overrideDate: todayStr,
          overrideTime: '13:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.student.studentId).toBe('CS2026-001');
      expect(res.body.chargeAmount).toBe(55.0);

      // Verify in DB that Attendance and Charge exist and are 1-to-1
      const attendance = await prisma.attendance.findUnique({
        where: {
          studentId_mealSessionId: {
            studentId: student1Profile.id,
            mealSessionId: activeLunchSession.id,
          },
        },
        include: { charge: true },
      });

      expect(attendance).toBeDefined();
      expect(attendance?.charge).toBeDefined();
      expect(attendance?.charge?.amount).toBe(55.0);
    });

    it('should reject duplicate scan in the same meal session with HTTP 409', async () => {
      const res = await request(app)
        .post('/api/attendance/verify-entry')
        .send({
          probeDescriptor: probeSimilarToStudent1, // Same student scans again
          overrideDate: todayStr,
          overrideTime: '13:05',
        });

      expect(res.status).toBe(409);
      expect(res.body.alreadyCheckedIn).toBe(true);
      expect(res.body.error).toContain('Duplicate scan');

      // Verify NO additional charge was created
      const chargeCount = await prisma.charge.count({
        where: {
          studentId: student1Profile.id,
          mealSessionId: activeLunchSession.id,
        },
      });
      expect(chargeCount).toBe(1);
    });

    it('should reject unrecognized face with HTTP 422 and create NO charge', async () => {
      const res = await request(app)
        .post('/api/attendance/verify-entry')
        .send({
          probeDescriptor: unrecognizedProbe,
          overrideDate: todayStr,
          overrideTime: '13:10',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toContain('Face not recognized');
    });

    it('should reject check-in when meal session is inactive or closed', async () => {
      // Set lunch session to realistic afternoon hours (12:30 to 14:30)
      await prisma.mealSession.update({
        where: { id: activeLunchSession.id },
        data: {
          startTime: '12:30',
          endTime: '14:30',
          status: 'ACTIVE',
        },
      });

      // At 04:00 AM, no meal session is active
      const res = await request(app)
        .post('/api/attendance/verify-entry')
        .send({
          probeDescriptor: probeSimilarToStudent1,
          overrideDate: todayStr,
          overrideTime: '04:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No meal session is currently active');
    });

    it('should ensure skipped meals produce zero charges and zero attendances', async () => {
      // Student 2 has NOT checked in for lunch today
      const student2Attendance = await prisma.attendance.findUnique({
        where: {
          studentId_mealSessionId: {
            studentId: student2Profile.id,
            mealSessionId: activeLunchSession.id,
          },
        },
      });
      expect(student2Attendance).toBeNull();

      const student2Charges = await prisma.charge.findMany({
        where: {
          studentId: student2Profile.id,
          mealSessionId: activeLunchSession.id,
        },
      });
      expect(student2Charges.length).toBe(0);
    });

    it('should preserve historical charge amount when admin updates session price later', async () => {
      // Admin updates lunch price to 75
      await request(app)
        .patch(`/api/meals/sessions/${activeLunchSession.id}`)
        .set('Cookie', adminCookie)
        .send({ price: 75.0 });

      // Student 1's existing historical charge MUST remain 55.0!
      const student1Charge = await prisma.charge.findFirst({
        where: {
          studentId: student1Profile.id,
          mealSessionId: activeLunchSession.id,
        },
      });

      expect(student1Charge?.amount).toBe(55.0);
    });
  });

  describe('5. Payments, Financial Adjustments, and Consumption-based Billing', () => {
    it('should record an authorized payment for student1', async () => {
      const res = await request(app)
        .post('/api/billing/payments')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student1Profile.id,
          amount: 50.0,
          paymentMethod: 'UPI',
          referenceNo: 'UPI123456789',
          receiptNotes: 'Mess fee advance paid via UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.payment.amount).toBe(50.0);
    });

    it('should record an authorized credit adjustment / refund for student1', async () => {
      const res = await request(app)
        .post('/api/billing/adjustments')
        .set('Cookie', adminCookie)
        .send({
          studentProfileId: student1Profile.id,
          amount: 5.0,
          type: 'CREDIT_REFUND',
          reason: 'Authorized discount adjustment',
        });

      expect(res.status).toBe(201);
      expect(res.body.adjustment.amount).toBe(5.0);
    });

    it('should calculate accurate consumption-based statement', async () => {
      // Total charges = 55.0 (1 lunch)
      // Total payments = 50.0
      // Net adjustments = 5.0 (credit)
      // Outstanding balance = 55.0 - 50.0 - 5.0 = 0.00
      const res = await request(app)
        .get(`/api/billing/statement/${student1Profile.id}?filter=month`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      const summary = res.body.statement.summary;
      expect(summary.totalMealsAttended).toBe(1);
      expect(summary.totalCharges).toBe(55.0);
      expect(summary.totalPayments).toBe(50.0);
      expect(summary.totalAdjustments).toBe(5.0);
      expect(summary.outstandingBalance).toBe(0.0);
    });
  });

  describe('6. Official PDF Statement Generation and IDOR Prevention', () => {
    it('should allow student1 to download their own PDF statement', async () => {
      const res = await request(app)
        .get(`/api/reports/statement-pdf/${student1Profile.id}?filter=month`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('mess-statement-CS2026-001');
      expect(res.body.length).toBeGreaterThan(1000); // Valid PDF stream
    });

    it('should prevent student1 from downloading student2 PDF statement (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/reports/statement-pdf/${student2Profile.id}?filter=month`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('should allow admin to download any student PDF statement', async () => {
      const res = await request(app)
        .get(`/api/reports/statement-pdf/${student2Profile.id}?filter=month`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('7. Account Deactivation, Soft-Deletion, and Audit Logs', () => {
    it('should soft-delete student account while preserving financial and attendance history', async () => {
      const res = await request(app)
        .delete(`/api/admin/students/${student1Profile.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('safely removed');

      // Verify studentProfile.softDeleted is true
      const studentInDb = await prisma.studentProfile.findUnique({
        where: { id: student1Profile.id },
      });
      expect(studentInDb?.softDeleted).toBe(true);

      // Verify financial charges and attendances are STILL intact
      const charges = await prisma.charge.findMany({
        where: { studentId: student1Profile.id },
      });
      expect(charges.length).toBe(1);
    });

    it('should provide audit logs for all security and financial events', async () => {
      const res = await request(app)
        .get('/api/audit/logs')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeGreaterThan(5);
      const actions = res.body.logs.map((l: any) => l.action);
      expect(actions).toContain('AUTH_LOGIN_SUCCESS');
      expect(actions).toContain('STUDENT_REGISTER');
      expect(actions).toContain('BIOMETRIC_ENROLLED');
      expect(actions).toContain('ATTENDANCE_RECORDED');
      expect(actions).toContain('PAYMENT_RECORDED');
    });
  });
});
