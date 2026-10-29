"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptTemplate = encryptTemplate;
exports.decryptTemplate = decryptTemplate;
exports.calculateEuclideanDistance = calculateEuclideanDistance;
exports.findBestFaceMatch = findBestFaceMatch;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../prisma");
const config_1 = require("../config");
// Ensure 32-byte key for AES-256-GCM
function getEncryptionKey() {
    const hex = config_1.config.biometricEncryptionKey;
    if (hex.length === 64) {
        return Buffer.from(hex, 'hex');
    }
    return crypto_1.default.createHash('sha256').update(hex).digest();
}
/**
 * Encrypt a 128-dimensional biometric template vector using AES-256-GCM
 */
function encryptTemplate(descriptor) {
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        throw new Error('Invalid face descriptor: Expected 128-dimensional vector');
    }
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
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
function decryptTemplate(encryptedTemplate, ivHex, authTagHex) {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedTemplate, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}
/**
 * Computes standard Euclidean distance between two 128-D embedding vectors
 */
function calculateEuclideanDistance(a, b) {
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
/**
 * Authoritatively matches a probe face descriptor vector against all active enrolled student templates
 */
async function findBestFaceMatch(probeDescriptor, customThreshold) {
    const threshold = customThreshold ?? config_1.config.faceMatchThreshold;
    // Retrieve active, non-deleted students with enrolled biometrics
    const enrolledRecords = await prisma_1.prisma.faceBiometric.findMany({
        include: {
            student: {
                include: {
                    user: true,
                },
            },
        },
    });
    const candidates = [];
    for (const record of enrolledRecords) {
        // Only check active, non-softDeleted students
        if (record.student.softDeleted || !record.student.user.isActive) {
            continue;
        }
        try {
            const enrolledVector = decryptTemplate(record.encryptedTemplate, record.iv, record.authTag);
            const distance = calculateEuclideanDistance(probeDescriptor, enrolledVector);
            candidates.push({
                studentProfileId: record.student.id,
                studentId: record.student.id,
                studentName: record.student.fullName,
                collegeStudentId: record.student.studentId,
                distance,
            });
        }
        catch (err) {
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
        const confidenceScore = Math.max(0.5, Math.min(0.99, Number((1 - best.distance / (threshold * 1.5)).toFixed(4))));
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
