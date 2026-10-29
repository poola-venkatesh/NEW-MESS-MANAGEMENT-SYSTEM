import crypto from 'crypto';
import { prisma } from '../prisma';
import { config } from '../config';

// Ensure 32-byte key for AES-256-GCM
function getEncryptionKey(): Buffer {
  const hex = config.biometricEncryptionKey;
  if (hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }
  return crypto.createHash('sha256').update(hex).digest();
}

/**
 * Encrypt a 128-dimensional biometric template vector using AES-256-GCM
 */
export function encryptTemplate(descriptor: number[]): {
  encryptedTemplate: string;
  iv: string;
  authTag: string;
} {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error('Invalid face descriptor: Expected 128-dimensional vector');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const serialized = JSON.stringify(descriptor);
  let encrypted = cipher.update(serialized, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedTemplate: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag,
  };
}

/**
 * Decrypt a stored biometric template into a 128-dimensional vector
 */
export function decryptTemplate(
  encryptedTemplate: string,
  ivHex: string,
  authTagHex: string
): number[] {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedTemplate, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Computes standard Euclidean distance between two 128-D embedding vectors
 */
export function calculateEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Descriptor length mismatch for Euclidean distance calculation');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export interface FaceMatchResult {
  studentId: string;
  studentProfileId: string;
  studentName: string;
  collegeStudentId: string;
  distance: number;
  confidenceScore: number;
}

/**
 * Authoritatively matches a probe face descriptor vector against all active enrolled student templates
 */
export async function findBestFaceMatch(
  probeDescriptor: number[],
  customThreshold?: number
): Promise<FaceMatchResult | null> {
  const threshold = customThreshold ?? config.faceMatchThreshold;

  // Retrieve active, non-deleted students with enrolled biometrics
  const enrolledRecords = await prisma.faceBiometric.findMany({
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
  });

  const candidates: Array<{
    studentProfileId: string;
    studentId: string;
    studentName: string;
    collegeStudentId: string;
    distance: number;
  }> = [];

  for (const record of enrolledRecords) {
    // Only check active, non-softDeleted students
    if (record.student.softDeleted || !record.student.user.isActive) {
      continue;
    }

    try {
      const enrolledVector = decryptTemplate(
        record.encryptedTemplate,
        record.iv,
        record.authTag
      );
      const distance = calculateEuclideanDistance(probeDescriptor, enrolledVector);
      candidates.push({
        studentProfileId: record.student.id,
        studentId: record.student.id,
        studentName: record.student.fullName,
        collegeStudentId: record.student.studentId,
        distance,
      });
    } catch (err) {
      console.error(`Failed to decrypt template for student ${record.studentId}:`, err);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by ascending distance (closest match first)
  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];

  // Check if closest distance satisfies threshold
  if (best.distance <= threshold) {
    // Check margin if multiple candidates exist
    if (candidates.length > 1) {
      const runnerUp = candidates[1];
      // If runner up is nearly identical, flag ambiguity
      if (runnerUp.distance - best.distance < 0.02 && runnerUp.distance <= threshold) {
        console.warn(`Ambiguous match between ${best.collegeStudentId} and ${runnerUp.collegeStudentId}`);
        return null; // Ambiguous recognition rejected
      }
    }

    // Normalized confidence score (higher is better, 0.0 to 1.0)
    const confidenceScore = Math.max(
      0.5,
      Math.min(0.99, Number((1 - best.distance / (threshold * 1.5)).toFixed(4)))
    );

    return {
      studentId: best.studentProfileId,
      studentProfileId: best.studentProfileId,
      studentName: best.studentName,
      collegeStudentId: best.collegeStudentId,
      distance: Number(best.distance.toFixed(4)),
      confidenceScore,
    };
  }

  return null;
}
