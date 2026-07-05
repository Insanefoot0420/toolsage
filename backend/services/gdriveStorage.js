/**
 * Google Drive cloud storage for ToolSage.
 * Ukládá data do Google Drive jako JSON soubory.
 * Struktura:
 *   - tools.json (všechny nástroje)
 *   - users.json (uživatelé)
 *   - agents.json (AI agenti)
 *   - reviews.json (recenze)
 *   - audit_log.json (auditní logy)
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', '..', 'gdrive_key.json');
const DATA_FILE_PREFIX = 'toolsage_';

// Cache for Drive service instance
let driveService = null;
// Local cache for data (to avoid re-reading Drive on every request)
let dataCache = {
  tools: null,
  users: null,
  agents: null,
  reviews: null,
  auditLog: null,
  lastFetch: 0
};
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Initialize Google Drive API client
 */
async function getDriveClient() {
  if (!driveService) {
    try {
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive.file']
      );
      driveService = google.drive({ version: 'v3', auth });
      console.log('[GDrive] Google Drive client initialized');
    } catch (err) {
      console.error('[GDrive] Failed to initialize Google Drive:', err.message);
      console.log('[GDrive] Falling back to local file storage');
      return null;
    }
  }
  return driveService;
}

/**
 * Find or create a ToolSage data folder in Google Drive
 */
async function getOrCreateDataFolder(drive) {
  try {
    // Search for existing folder
    const res = await drive.files.list({
      q: "name='ToolSage_Data' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      console.log('[GDrive] Found existing ToolSage_Data folder:', res.data.files[0].id);
      return res.data.files[0].id;
    }

    // Create new folder
    const folder = await drive.files.create({
      requestBody: {
        name: 'ToolSage_Data',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    console.log('[GDrive] Created ToolSage_Data folder:', folder.data.id);
    return folder.data.id;
  } catch (err) {
    console.error('[GDrive] Folder error:', err.message);
    throw err;
  }
}

/**
 * Read a JSON file from Google Drive (or local fallback)
 */
async function readDataFile(fileName) {
  const localPath = path.join(__dirname, '..', 'data', fileName);

  try {
    const drive = await getDriveClient();
    if (drive) {
      const folderId = await getOrCreateDataFolder(drive);
      const res = await drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (res.data.files && res.data.files.length > 0) {
        const fileId = res.data.files[0].id;
        const content = await drive.files.get({
          fileId: fileId,
          alt: 'media'
        });
        return content.data;
      }
    }
  } catch (err) {
    console.warn(`[GDrive] Read error for ${fileName}: ${err.message}, using local fallback`);
  }

  // Fallback to local file
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  return null;
}

/**
 * Write a JSON file to Google Drive (or local fallback)
 */
async function writeDataFile(fileName, data) {
  const localPath = path.join(__dirname, '..', 'data', fileName);
  
  // Ensure data directory exists
  const dataDir = path.dirname(localPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Always write local copy
  fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');

  try {
    const drive = await getDriveClient();
    if (drive) {
      const folderId = await getOrCreateDataFolder(drive);
      
      // Check if file already exists
      const res = await drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(data)
      };

      if (res.data.files && res.data.files.length > 0) {
        // Update existing file
        await drive.files.update({
          fileId: res.data.files[0].id,
          media: media
        });
        console.log(`[GDrive] Updated ${fileName} in Drive`);
      } else {
        // Create new file
        await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [folderId]
          },
          media: media
        });
        console.log(`[GDrive] Created ${fileName} in Drive`);
      }
    }
  } catch (err) {
    console.warn(`[GDrive] Write error for ${fileName}: ${err.message}, saved locally only`);
  }
}

// ─── Data access methods ─────────────────────────────────────

async function getAllTools() {
  if (dataCache.tools && (Date.now() - dataCache.lastFetch) < CACHE_TTL_MS) {
    return dataCache.tools;
  }
  const data = await readDataFile(`${DATA_FILE_PREFIX}tools.json`);
  const tools = data?.tools || getDefaultTools();
  dataCache.tools = tools;
  dataCache.lastFetch = Date.now();
  return tools;
}

function getDefaultTools() {
  return [
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Android Studio', description: 'Oficiální IDE pro vývoj Android aplikací.',
      categories: ['Vývoj', 'IDE'], tags: ['Android', 'Kotlin', 'Jetpack'],
      pricing_model: 'free', average_rating: 4.5, review_count: 1280,
      status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'], architectures: ['x86', 'ARM'] }
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Firebase', description: 'Platforma Google pro vývoj backendu a cloudových funkcí.',
      categories: ['Vývoj', 'Backend'], tags: ['Cloud', 'Database', 'Auth'],
      pricing_model: 'freemium', average_rating: 4.2, review_count: 2150,
      status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      compatibility: { os: ['Web'], platforms: ['Web', 'Mobile'], architectures: [] }
    },
    {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      name: 'Figma', description: 'Kolaborativní nástroj pro design UI a prototypování.',
      categories: ['Design', 'UI/UX'], tags: ['Design', 'Prototyping'],
      pricing_model: 'freemium', average_rating: 4.6, review_count: 4560,
      status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Web', 'Desktop'], architectures: ['x86', 'ARM'] }
    },
    {
      id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      name: 'Docker Desktop', description: 'Platforma pro kontejnerizaci aplikací.',
      categories: ['Vývoj', 'DevOps'], tags: ['Containers', 'Docker'],
      pricing_model: 'freemium', average_rating: 4.1, review_count: 1890,
      status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'], architectures: ['x86', 'ARM'] }
    },
    {
      id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      name: 'GitHub Copilot', description: 'AI-asistované programování s podporou více jazyků.',
      categories: ['Vývoj', 'AI/ML'], tags: ['AI', 'Code Assistant', 'GitHub'],
      pricing_model: 'freemium', average_rating: 4.3, review_count: 3420,
      status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'], architectures: ['x86', 'ARM'] }
    }
  ];
}

async function saveAllTools(tools) {
  dataCache.tools = tools;
  dataCache.lastFetch = Date.now();
  await writeDataFile(`${DATA_FILE_PREFIX}tools.json`, { tools });
}

// Users
async function getAllUsers() {
  const data = await readDataFile(`${DATA_FILE_PREFIX}users.json`);
  return data?.users || [];
}

async function saveAllUsers(users) {
  await writeDataFile(`${DATA_FILE_PREFIX}users.json`, { users });
}

// Agents
async function getAllAgents() {
  const data = await readDataFile(`${DATA_FILE_PREFIX}agents.json`);
  return data?.agents || [];
}

async function saveAllAgents(agents) {
  await writeDataFile(`${DATA_FILE_PREFIX}agents.json`, { agents });
}

// Reviews
async function getAllReviews() {
  const data = await readDataFile(`${DATA_FILE_PREFIX}reviews.json`);
  return data?.reviews || [];
}

async function saveAllReviews(reviews) {
  await writeDataFile(`${DATA_FILE_PREFIX}reviews.json`, { reviews });
}

// Audit log
async function appendAuditLog(entry) {
  const logs = await readDataFile(`${DATA_FILE_PREFIX}audit_log.json`);
  const auditLog = logs?.audit_log || [];
  auditLog.push({
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  // Keep last 1000 entries
  if (auditLog.length > 1000) auditLog.splice(0, auditLog.length - 1000);
  await writeDataFile(`${DATA_FILE_PREFIX}audit_log.json`, { audit_log: auditLog });
}

// Categories
const DEFAULT_CATEGORIES = [
  'Vývoj', 'AI/ML', 'Design', 'DevOps', 'Backend', 'Frontend',
  'Databáze', 'Bezpečnost', 'Nástroje', 'Cloud', 'Mobilní',
  'Analýza', 'Testování', 'Produktivita', 'API'
];

module.exports = {
  getAllTools, saveAllTools,
  getAllUsers, saveAllUsers,
  getAllAgents, saveAllAgents,
  getAllReviews, saveAllReviews,
  appendAuditLog,
  DEFAULT_CATEGORIES
};
