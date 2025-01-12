# File Upload Documentation

## Overview

The file upload system allows users to attach files to their messages in the chat interface. It supports images, PDFs, and text files with a retro-styled UI that matches the application theme.

## Components

### FilePreview Component
Located in `frontend/src/components/chat/FilePreview/index.tsx`

**Props:**
```typescript
interface FilePreviewProps {
  filename: string;
  fileType: string;
  filePath: string;
}
```

**Features:**
- Displays file name and type
- Shows image previews for image files
- Provides download functionality
- Uses retro-style icons:
  - 🖼️ for images (jpg, png, gif)
  - 📄 for PDFs
  - 📝 for text files
  - 📎 for other types

### MessageInput Component
Located in `frontend/src/components/chat/MessageInput/index.tsx`

**File Upload Features:**
- File attachment button (📎)
- File size validation (50MB limit)
- File type validation
- Error handling with retry capability
- Progress indication
- File preview before sending

## API Service

### File Upload Service
Located in `frontend/src/services/api/files.ts`

**Interface:**
```typescript
interface FileResponse {
  id: string;
  filename: string;
  file_type: string;
  file_path: string;
  message_id?: string;
  created_at: string;
}
```

**Main Function:**
```typescript
uploadFile(file: File, messageId?: string): Promise<FileResponse>
```

## Error Handling

### FileUploadError Class
```typescript
class FileUploadError extends Error {
  constructor(message: string, public code: string)
}
```

**Error Codes:**
- `FILE_TOO_LARGE`: File exceeds 50MB limit
- `INVALID_FILE_TYPE`: Unsupported file type
- `NETWORK_ERROR`: Connection issues
- `SERVER_FILE_TOO_LARGE`: Server rejected file size
- `SERVER_INVALID_TYPE`: Server rejected file type
- `AUTH_ERROR`: Authentication failed
- `SERVER_ERROR`: Server unavailable
- `UPLOAD_FAILED`: Generic upload failure

### Error Recovery
- Warnings vs Errors distinction
- Retry functionality for recoverable errors
- State preservation during retries
- User-friendly error messages

## File Limitations

### Size Limits
- Maximum file size: 50MB
- Validated both client-side and server-side

### Supported File Types
- Images: jpg, jpeg, png, gif
- Documents: pdf
- Text: txt

## Usage Example

1. Click the paperclip icon (📎) or drag a file into the message input
2. Select a file to upload
3. Preview the file before sending
4. Type an optional message
5. Press Enter to send

```typescript
// Example of handling file upload
const handleFileUpload = async (file: File) => {
  try {
    const uploadedFile = await uploadFile(file);
    // File uploaded successfully
    return uploadedFile.id;
  } catch (error) {
    if (error instanceof FileUploadError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          // Handle network error
          break;
        case 'FILE_TOO_LARGE':
          // Handle file size error
          break;
        // ... handle other errors
      }
    }
  }
};
```

## Best Practices

1. **File Selection:**
   - Always validate files before upload attempt
   - Clear file input after failed validation
   - Show clear error messages for invalid files

2. **Error Handling:**
   - Use specific error codes for different scenarios
   - Provide retry options for recoverable errors
   - Show user-friendly error messages
   - Preserve state for retry attempts

3. **UI/UX:**
   - Show file preview before upload
   - Indicate upload progress
   - Allow file removal before sending
   - Disable upload during processing

4. **Security:**
   - Validate file types client-side and server-side
   - Enforce file size limits
   - Handle authentication errors appropriately
   - Sanitize file names and paths 