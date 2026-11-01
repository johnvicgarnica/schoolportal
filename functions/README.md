# Excel to Google Sheets Cloud Function

Node.js Google Cloud Function using the official Google Drive API (`@googleapis/drive`) and Firebase Admin SDK (`firebase-admin`) to convert uploaded `.xlsx` files into editable Google Sheets.

## Prerequisites & Permissions

1. **Enable Google Drive API**:
   In your Google Cloud Console, enable the **Google Drive API** for your project.
2. **Service Account Permissions**:
   The Cloud Function's Service Account requires:
   - **Cloud Datastore User** or **Firebase Admin** (to write to Cloud Firestore).
   - **Storage Object Viewer** (to stream files from Firebase Storage).
   - If writing into a Shared Drive / Google Workspace folder, grant the Service Account email address editor access to the target Google Drive folder.

---

## Deployment Commands

### Option A: Deploy via Google Cloud CLI (`gcloud`)

```bash
cd functions

gcloud functions deploy convertExcelToGoogleSheet \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-southeast1 \
  --source=. \
  --entry-point=convertExcelToGoogleSheet \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=60s
```

### Option B: Deploy via Firebase CLI

If integrated with Firebase Functions:

```bash
firebase deploy --only functions:convertExcelToGoogleSheet
```

---

## Usage Examples

### 1. From Firebase Storage Reference (JSON)

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/convertExcelToGoogleSheet \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "doc_sf2_grade11_diamond",
    "storagePath": "faculty_uploads/SF 2 Grade 11 Diamond.xlsx",
    "fileName": "SF 2 Grade 11 Diamond.xlsx"
  }'
```

### 2. Direct Multipart File Upload (Form Data)

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/convertExcelToGoogleSheet \
  -F "documentId=doc_sf2_grade11_diamond" \
  -F "file=@/path/to/attendance.xlsx"
```

### 3. Base64 JSON Upload

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/convertExcelToGoogleSheet \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "doc_sf2_grade11_diamond",
    "fileName": "SF 2 Grade 11 Diamond.xlsx",
    "fileBase64": "UEsDBBQAAAAIA..."
  }'
```

---

## Response Format

```json
{
  "success": true,
  "documentId": "doc_sf2_grade11_diamond",
  "googleSheetId": "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ",
  "googleSheetUrl": "https://docs.google.com/spreadsheets/d/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ/edit?usp=sharing",
  "title": "SF 2 Grade 11 Diamond",
  "message": "Excel file successfully uploaded, converted to Google Sheets, set to public edit, and linked in Firestore."
}
```
