const { Readable } = require('stream');
const functions = require('@google-cloud/functions-framework');
const { drive: driveFactory } = require('@googleapis/drive');
const { GoogleAuth } = require('google-auth-library');
const admin = require('firebase-admin');
const Busboy = require('busboy');

// Initialize Firebase Admin SDK (uses Application Default Credentials on GCP)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Initialize Google Drive API client with Drive full scope
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = driveFactory({
  version: 'v3',
  auth,
});

/**
 * Helper: Parse multipart/form-data request using Busboy into a memory buffer and fields
 */
function parseMultipartRequest(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    let fileBuffer = null;
    let fileName = 'Uploaded_Spreadsheet.xlsx';
    let fileMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    busboy.on('field', (name, val) => {
      fields[name] = val;
    });

    busboy.on('file', (name, fileStream, info) => {
      const { filename, mimeType } = info;
      fileName = filename || fileName;
      fileMimeType = mimeType || fileMimeType;

      const chunks = [];
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, fileBuffer, fileName, fileMimeType });
    });

    busboy.on('error', (err) => reject(err));

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}

/**
 * Cloud Function entry point: convertExcelToGoogleSheet
 * 
 * Supports two ingestion modes:
 * Mode 1: Direct HTTP multipart/form-data or Base64 JSON upload.
 * Mode 2: Firebase Storage reference stream (storagePath & bucketName).
 */
functions.http('convertExcelToGoogleSheet', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Send a POST request.' });
  }

  try {
    let documentId = null;
    let fileName = 'Spreadsheet.xlsx';
    let fileStream = null;
    let parentFolderId = null; // Optional: Google Drive folder destination

    const contentType = req.headers['content-type'] || '';

    // =========================================================================
    // 1. Resolve File Stream (From Firebase Storage OR Direct HTTP Upload)
    // =========================================================================

    if (contentType.includes('multipart/form-data')) {
      // Direct HTTP Multipart File Upload
      const { fields, fileBuffer, fileName: parsedFileName } = await parseMultipartRequest(req);
      documentId = fields.documentId;
      parentFolderId = fields.folderId || null;
      fileName = fields.fileName || parsedFileName || 'Converted_Sheet.xlsx';

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No file stream/data received in multipart upload.' });
      }

      fileStream = Readable.from(fileBuffer);
    } else if (req.body) {
      // JSON Payload Mode
      documentId = req.body.documentId;
      parentFolderId = req.body.folderId || null;
      fileName = req.body.fileName || fileName;

      if (req.body.storagePath) {
        // Stream directly from Firebase Storage bucket
        const bucket = req.body.bucketName 
          ? storage.bucket(req.body.bucketName) 
          : storage.bucket();

        const file = bucket.file(req.body.storagePath);
        const [exists] = await file.exists();

        if (!exists) {
          return res.status(404).json({
            error: `File not found in Firebase Storage at path: "${req.body.storagePath}"`,
          });
        }

        // Stream file directly from Firebase Storage into Google Drive API
        fileStream = file.createReadStream();
      } else if (req.body.fileBase64) {
        // Base64-encoded file payload
        const base64Data = req.body.fileBase64.includes(',')
          ? req.body.fileBase64.split(',')[1]
          : req.body.fileBase64;
        
        const fileBuffer = Buffer.from(base64Data, 'base64');
        fileStream = Readable.from(fileBuffer);
      }
    }

    // Validate requirements
    if (!documentId) {
      return res.status(400).json({
        error: 'Missing required field: "documentId". Provide the target Firestore document ID.',
      });
    }

    if (!fileStream) {
      return res.status(400).json({
        error: 'No file stream provided. Provide an uploaded file via multipart/form-data, "storagePath", or "fileBase64".',
      });
    }

    // Clean sheet title (strip .xlsx / .xls extension for clean display in Google Sheets)
    const cleanTitle = fileName.replace(/\.(xlsx|xls)$/i, '');

    // =========================================================================
    // 2. Upload to Google Drive and Convert to Google Sheets
    // =========================================================================
    // Setting `mimeType: 'application/vnd.google-apps.spreadsheet'` in requestBody
    // tells Google Drive to convert the binary Excel file into native Google Sheets!
    const driveUploadResponse = await drive.files.create({
      requestBody: {
        name: cleanTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet', // Converts .xlsx to Google Sheets
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: fileStream,
      },
      fields: 'id, name, webViewLink, webContentLink',
    });

    const googleSheetId = driveUploadResponse.data.id;
    let webViewLink = driveUploadResponse.data.webViewLink;

    if (!googleSheetId) {
      throw new Error('Google Drive API failed to return a file ID for the converted spreadsheet.');
    }

    // =========================================================================
    // 3. Set File Permissions to "anyone with the link can edit"
    // =========================================================================
    // role: 'writer' grants full editing rights; type: 'anyone' makes it link-shareable
    await drive.permissions.create({
      fileId: googleSheetId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
      fields: 'id',
    });

    // Fallback standard Google Sheets direct edit URL format
    if (!webViewLink) {
      webViewLink = `https://docs.google.com/spreadsheets/d/${googleSheetId}/edit?usp=sharing`;
    }

    // =========================================================================
    // 4 & 5. Save Generated Edit URL into Cloud Firestore: documents/{documentId}
    // =========================================================================
    const docRef = db.collection('documents').doc(documentId);
    
    const updatePayload = {
      googleSheetId,
      googleSheetUrl: webViewLink,
      googleSheetEditUrl: webViewLink,
      convertedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'converted',
      conversionDetails: {
        originalFileName: fileName,
        cleanTitle,
        sharingRole: 'writer',
        sharingType: 'anyone',
      },
    };

    await docRef.set(updatePayload, { merge: true });

    // =========================================================================
    // 6. Return the Google Sheet URL as a JSON Response
    // =========================================================================
    return res.status(200).json({
      success: true,
      documentId,
      googleSheetId,
      googleSheetUrl: webViewLink,
      title: cleanTitle,
      message: 'Excel file successfully uploaded, converted to Google Sheets, set to public edit, and linked in Firestore.',
    });

  } catch (error) {
    console.error('Error converting Excel file to Google Sheet:', error);
    return res.status(500).json({
      error: 'Failed to convert Excel file to Google Sheet',
      message: error.message,
    });
  }
});
