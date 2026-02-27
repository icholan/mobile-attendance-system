const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MODELS_DIR = path.join(__dirname, 'models');

const models = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(MODELS_DIR, filename);
    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${filename} (already exists)`);
      return resolve();
    }
    const url = `${MODELS_URL}/${filename}`;
    console.log(`  ↓ Downloading ${filename}...`);
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectRes) => {
          redirectRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('📦 Downloading face-api.js models...\n');
  for (const model of models) {
    await downloadFile(model);
  }
  console.log('\n✅ All models downloaded successfully!');
}

main().catch(console.error);
