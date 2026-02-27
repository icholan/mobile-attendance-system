const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const faceapi = require('face-api.js');
const napiCanvas = require('@napi-rs/canvas');

// Patch face-api.js to work with @napi-rs/canvas
faceapi.env.monkeyPatch({
    Canvas: napiCanvas.Canvas,
    Image: napiCanvas.Image,
    ImageData: napiCanvas.ImageData,
    createCanvasElement: () => napiCanvas.createCanvas(1, 1),
    createImageElement: () => new napiCanvas.Image(),
});

const app = express();
const PORT = 3000;

// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const FACES_DB_PATH = path.join(__dirname, 'data', 'faces.json');
const MODELS_PATH = path.join(__dirname, 'models');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize faces database
function loadFaces() {
    if (fs.existsSync(FACES_DB_PATH)) {
        const data = fs.readFileSync(FACES_DB_PATH, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

function saveFaces(faces) {
    fs.writeFileSync(FACES_DB_PATH, JSON.stringify(faces, null, 2));
}

// Load face-api.js models
async function loadModels() {
    console.log('🔄 Loading face-api.js models...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
    console.log('✅ Models loaded successfully!');
}

// Extract face descriptor from base64 image using napiCanvas.Image
async function extractFaceDescriptor(base64Image) {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create an Image element using @napi-rs/canvas
    const img = await napiCanvas.loadImage(buffer);

    try {
        // Pass the Image element directly to face-api.js
        const detection = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

        return detection;
    } catch (e) {
        console.error('Face detection error:', e);
        return null;
    }
}

// Calculate euclidean distance between two descriptors
function euclideanDistance(desc1, desc2) {
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += Math.pow(desc1[i] - desc2[i], 2);
    }
    return Math.sqrt(sum);
}

// ─── API Routes ───────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Face Recognition Server is running' });
});

// Extract face descriptor from image (used by mobile app)
// Returns 128-float descriptor array for HRMS API
app.post('/api/extract-descriptor', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Image is required',
            });
        }

        console.log('🔍 Extracting face descriptor...');

        const detection = await extractFaceDescriptor(image);

        if (!detection) {
            return res.status(400).json({
                success: false,
                message: 'No face detected in the image. Please try again with a clear face photo.',
            });
        }

        const descriptor = Array.from(detection.descriptor);
        console.log(`  ✅ Descriptor extracted (${descriptor.length} floats)`);

        res.json({
            success: true,
            descriptor: descriptor,
            message: 'Face descriptor extracted successfully',
        });
    } catch (error) {
        console.error('❌ Extraction error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error during face extraction',
            error: error.message,
        });
    }
});

// Register a new face
app.post('/api/register', async (req, res) => {
    try {
        const { name, image } = req.body;

        if (!name || !image) {
            return res.status(400).json({
                success: false,
                message: 'Name and image are required',
            });
        }

        console.log(`📝 Registering face for: ${name}`);

        const detection = await extractFaceDescriptor(image);

        if (!detection) {
            return res.status(400).json({
                success: false,
                message: 'No face detected in the image. Please try again with a clear face photo.',
            });
        }

        const faces = loadFaces();

        // Check if name already exists
        const existingIndex = faces.findIndex(
            (f) => f.name.toLowerCase() === name.toLowerCase()
        );

        const faceRecord = {
            name: name.trim(),
            descriptor: Array.from(detection.descriptor),
            registeredAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
            faces[existingIndex] = faceRecord;
            console.log(`  ↻ Updated existing record for: ${name}`);
        } else {
            faces.push(faceRecord);
            console.log(`  ✓ New face registered for: ${name}`);
        }

        saveFaces(faces);

        res.json({
            success: true,
            message: `Face registered successfully for ${name}`,
            totalRegistered: faces.length,
        });
    } catch (error) {
        console.error('❌ Registration error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message,
        });
    }
});

// Mark attendance via face recognition
app.post('/api/attendance', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Image is required',
            });
        }

        console.log('🔍 Processing attendance scan...');

        const detection = await extractFaceDescriptor(image);

        if (!detection) {
            return res.status(400).json({
                success: false,
                message: 'No face detected in the image. Please try again.',
            });
        }

        const faces = loadFaces();

        if (faces.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No faces registered yet. Please register first.',
            });
        }

        // Find the best match
        let bestMatch = null;
        let bestDistance = Infinity;
        const THRESHOLD = 0.6;

        for (const face of faces) {
            const distance = euclideanDistance(
                detection.descriptor,
                new Float32Array(face.descriptor)
            );
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = face;
            }
        }

        if (bestMatch && bestDistance < THRESHOLD) {
            // Record attendance
            const attendanceRecord = {
                name: bestMatch.name,
                timestamp: new Date().toISOString(),
                confidence: Math.round((1 - bestDistance) * 100),
            };

            // Save attendance log
            const attendanceLogPath = path.join(__dirname, 'data', 'attendance.json');
            let attendanceLog = [];
            if (fs.existsSync(attendanceLogPath)) {
                attendanceLog = JSON.parse(fs.readFileSync(attendanceLogPath, 'utf8'));
            }
            attendanceLog.push(attendanceRecord);
            fs.writeFileSync(attendanceLogPath, JSON.stringify(attendanceLog, null, 2));

            console.log(
                `  ✅ Attendance marked for: ${bestMatch.name} (confidence: ${attendanceRecord.confidence}%)`
            );

            res.json({
                success: true,
                matched: true,
                name: bestMatch.name,
                confidence: attendanceRecord.confidence,
                timestamp: attendanceRecord.timestamp,
                message: `Attendance marked for ${bestMatch.name}`,
            });
        } else {
            console.log(
                `  ❌ No match found (best distance: ${bestDistance.toFixed(3)})`
            );
            res.json({
                success: true,
                matched: false,
                message: 'Face not recognized. Please register first.',
            });
        }
    } catch (error) {
        console.error('❌ Attendance error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error during attendance check',
            error: error.message,
        });
    }
});

// Get all registered faces (names only)
app.get('/api/faces', (req, res) => {
    const faces = loadFaces();
    res.json({
        success: true,
        count: faces.length,
        faces: faces.map((f) => ({
            name: f.name,
            registeredAt: f.registeredAt,
        })),
    });
});

// Get attendance log
app.get('/api/attendance', (req, res) => {
    const attendanceLogPath = path.join(__dirname, 'data', 'attendance.json');
    let attendanceLog = [];
    if (fs.existsSync(attendanceLogPath)) {
        attendanceLog = JSON.parse(fs.readFileSync(attendanceLogPath, 'utf8'));
    }
    res.json({
        success: true,
        count: attendanceLog.length,
        records: attendanceLog,
    });
});

// Start server
async function start() {
    await loadModels();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Face Recognition Server running on http://0.0.0.0:${PORT}`);
        console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });
}

start().catch(console.error);
