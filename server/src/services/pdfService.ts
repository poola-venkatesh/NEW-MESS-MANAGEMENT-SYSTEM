import PDFDocument from 'pdfkit';
import { StudentBillStatement } from './billingService';
import { config } from '../config';

/**
 * Generates an official, vectorized PDF mess statement for a student
 */
export async function generateStudentBillPdf(
  statement: StudentBillStatement
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Mess Statement - ${statement.student.studentId}`,
          Author: config.hostelName,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Header ---
      doc
        .fillColor('#166534') // Dark green
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(config.hostelName.toUpperCase(), { align: 'center' });

      doc
        .fillColor('#4b5563') // Gray
        .fontSize(11)
        .font('Helvetica')
        .text('Official Consumption-Based Mess Attendance & Billing Statement', {
          align: 'center',
        });

      doc.moveDown(0.5);
      doc
        .strokeColor('#cbd5e1')
        .lineWidth(1)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();
      doc.moveDown(0.8);

      // --- Student & Period Information Block ---
      const infoTop = doc.y;

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Student Details:', 40, infoTop);
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Name: ${statement.student.fullName}`, 40, infoTop + 14)
        .text(`College Student ID: ${statement.student.studentId}`, 40, infoTop + 27)
        .text(
          `Hostel: ${statement.student.hostelBlock || 'N/A'} - Room: ${
            statement.student.roomNo || 'N/A'
          }`,
          40,
          infoTop + 40
        );

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Statement Period:', 340, infoTop);
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(`Period Type: ${statement.period.filter.toUpperCase()}`, 340, infoTop + 14)
        .text(
          `Date Range: ${statement.period.startDate} to ${statement.period.endDate}`,
          340,
          infoTop + 27
        )
        .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 340, infoTop + 40);

      doc.y = infoTop + 60;
      doc.moveDown(0.5);

      // --- Summary Highlights Box ---
      const summaryTop = doc.y;
      doc
        .rect(40, summaryTop, 515, 45)
        .fillAndStroke('#f0fdf4', '#86efac'); // Light green box with border

      doc
        .fillColor('#166534')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Meals Consumed', 55, summaryTop + 8)
        .text('Total Charges', 170, summaryTop + 8)
        .text('Payments Made', 300, summaryTop + 8)
        .text('Outstanding Balance', 420, summaryTop + 8);

      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(11)
        .text(`${statement.summary.totalMealsAttended}`, 55, summaryTop + 24)
        .text(`₹${statement.summary.totalCharges.toFixed(2)}`, 170, summaryTop + 24)
        .text(`₹${statement.summary.totalPayments.toFixed(2)}`, 300, summaryTop + 24);

      const balanceColor =
        statement.summary.outstandingBalance > 0 ? '#b91c1c' : '#15803d';
      doc
        .fillColor(balanceColor)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(`₹${statement.summary.outstandingBalance.toFixed(2)}`, 420, summaryTop + 24);

      doc.y = summaryTop + 55;
      doc.moveDown(0.8);

      // --- Itemized Attendance & Charges Table ---
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Itemized Meal Attendance & Charges');
      doc.moveDown(0.4);

      // Table Header
      let tableY = doc.y;
      doc.rect(40, tableY, 515, 20).fill('#e2e8f0');

      doc
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('#', 45, tableY + 5)
        .text('Date', 70, tableY + 5)
        .text('Meal Session', 170, tableY + 5)
        .text('Verification Method', 280, tableY + 5)
        .text('Charge (₹)', 480, tableY + 5, { width: 65, align: 'right' });

      tableY += 20;

      if (statement.itemizedCharges.length === 0) {
        doc
          .fillColor('#64748b')
          .font('Helvetica-Oblique')
          .fontSize(9)
          .text('No meals attended during this billing period.', 45, tableY + 8);
        tableY += 25;
      } else {
        statement.itemizedCharges.forEach((item, idx) => {
          // Check for page break
          if (tableY > 740) {
            doc.addPage();
            tableY = 40;
            doc.rect(40, tableY, 515, 20).fill('#e2e8f0');
            doc
              .fillColor('#1e293b')
              .font('Helvetica-Bold')
              .fontSize(9)
              .text('#', 45, tableY + 5)
              .text('Date', 70, tableY + 5)
              .text('Meal Session', 170, tableY + 5)
              .text('Verification Method', 280, tableY + 5)
              .text('Charge (₹)', 480, tableY + 5, { width: 65, align: 'right' });
            tableY += 20;
          }

          const isEven = idx % 2 === 0;
          if (isEven) {
            doc.rect(40, tableY, 515, 18).fill('#f8fafc');
          }

          doc
            .fillColor('#334155')
            .font('Helvetica')
            .fontSize(8.5)
            .text(`${idx + 1}`, 45, tableY + 4)
            .text(item.date, 70, tableY + 4)
            .text(item.mealName, 170, tableY + 4)
            .text(item.verificationMethod || 'FACE_BIOMETRIC', 280, tableY + 4)
            .text(`₹${item.amount.toFixed(2)}`, 480, tableY + 4, {
              width: 65,
              align: 'right',
            });

          tableY += 18;
        });
      }

      // --- Financial Reconciliation Table ---
      doc.y = tableY + 15;
      if (doc.y > 680) {
        doc.addPage();
      }

      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Financial Reconciliation');
      doc.moveDown(0.3);

      const reconY = doc.y;
      doc.rect(300, reconY, 255, 75).stroke('#cbd5e1');

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text('Total Consumed Meal Charges:', 310, reconY + 8)
        .text(`₹${statement.summary.totalCharges.toFixed(2)}`, 480, reconY + 8, {
          width: 65,
          align: 'right',
        })
        .text('Less: Recorded Payments:', 310, reconY + 23)
        .text(`- ₹${statement.summary.totalPayments.toFixed(2)}`, 480, reconY + 23, {
          width: 65,
          align: 'right',
        })
        .text('Less: Net Adjustments / Refunds:', 310, reconY + 38)
        .text(`- ₹${statement.summary.totalAdjustments.toFixed(2)}`, 480, reconY + 38, {
          width: 65,
          align: 'right',
        });

      doc
        .strokeColor('#e2e8f0')
        .moveTo(310, reconY + 54)
        .lineTo(545, reconY + 54)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(balanceColor)
        .text('Net Outstanding Balance:', 310, reconY + 58)
        .text(`₹${statement.summary.outstandingBalance.toFixed(2)}`, 480, reconY + 58, {
          width: 65,
          align: 'right',
        });

      // --- Footer ---
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#94a3b8')
        .text(
          'Notice: This hostel operates strictly on a Pay-Per-Meal consumption model. No fixed monthly charges are applied.',
          40,
          770,
          { align: 'center', width: 515 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
