import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEXTURES_DIR = path.join(__dirname, '..', 'client', 'public', 'textures');

const TEXTURES = [
  {
    name: 'earth_day.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
    description: 'NASA Blue Marble (Day)',
  },
  {
    name: 'earth_night.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg',
    description: 'NASA Black Marble (Night/City Lights)',
  },
  {
    name: 'earth_clouds.png',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg',
    description: 'NASA Cloud Layer',
  },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function downloadFile(url, destPath, description) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(destPath);
    
    if (fs.existsSync(destPath)) {
      console.log(`✓ ${fileName} already exists, skipping...`);
      resolve();
      return;
    }

    console.log(`⬇ Downloading ${description}...`);
    console.log(`  URL: ${url}`);

    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`  Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath, description).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${fileName}: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      const file = fs.createWriteStream(destPath);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${percent}%`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`\n✓ Downloaded ${fileName}`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${fileName}`));
    });
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   SENTRY Texture Downloader                ║');
  console.log('║   Downloading NASA Earth textures...       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  ensureDir(TEXTURES_DIR);

  let successCount = 0;
  let failCount = 0;

  for (const texture of TEXTURES) {
    const destPath = path.join(TEXTURES_DIR, texture.name);
    try {
      await downloadFile(texture.url, destPath, texture.description);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to download ${texture.name}: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`Downloads complete: ${successCount} succeeded, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\nSome textures failed to download. You can manually download them from:');
    TEXTURES.forEach((t) => {
      const destPath = path.join(TEXTURES_DIR, t.name);
      if (!fs.existsSync(destPath)) {
        console.log(`  ${t.name}: ${t.url}`);
      }
    });
  }

  console.log(`\nTextures saved to: ${TEXTURES_DIR}`);
}

main().catch(console.error);
