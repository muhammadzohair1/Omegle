import fs from 'fs';
import path from 'path';
import https from 'https';

const MODEL_BASE_URL = 'https://s3.amazonaws.com/ir_public/nsfwjscdn/tfjs_quant_nsfw_mobilenet/';
const DEST_DIR = path.join(process.cwd(), 'public', 'model');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const run = async () => {
  try {
    const modelJsonPath = path.join(DEST_DIR, 'model.json');
    await downloadFile(`${MODEL_BASE_URL}model.json`, modelJsonPath);
    
    const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
    const weightsManifest = modelJson.weightsManifest;
    
    for (const group of weightsManifest) {
      for (const path of group.paths) {
        await downloadFile(`${MODEL_BASE_URL}${path}`, path.join(DEST_DIR, path));
      }
    }
    console.log('Model downloaded successfully to public/model!');
  } catch (err) {
    console.error('Error downloading model:', err);
  }
};

run();
