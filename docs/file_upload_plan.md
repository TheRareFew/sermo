# File Upload Implementation Plan

## 1. Analyze Backend File Upload Endpoint Functions

- [x] **Endpoint**: `POST /api/files/upload`
  - Accepts multipart form data with:
    - `file`: The file data
    - `message_id`: Optional, ID of the message to attach the file to
  - Responds with the uploaded file object

- [x] **File Limitations**
  - Max size: 50MB
  - Supported types: jpg, png, gif, pdf, txt

## 2. Update Frontend API Service

- [x] **Create File Upload Service File**
  - Create new file `src/services/api/files.ts`
  - Add necessary imports from base API utilities

- [x] **Create File Upload Function**
  - Add `uploadFile` function to `src/services/api/files.ts`
  - Function accepts `file` and `messageId` parameters
  - Use `FormData` to send multipart form data

[CODE START]
export const uploadFile = async (file: File, messageId?: string): Promise<FileResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (messageId) {
    formData.append('message_id', messageId);
  }

  const response = await fetch(`${API_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('File upload failed');
  }

  return response.json();
};
[CODE END]

- [x] **Define FileResponse Interface**
  - Add interface to `src/services/api/files.ts`

[CODE START]
interface FileResponse {
  id: string;
  filename: string;
  file_type: string;
  file_path: string;
  message_id?: string;
  created_at: string;
}
[CODE END]

## 3. Update Message Input Component

- [x] **Add File Upload State**
  - Add state for managing attached file
  - Add loading state for upload progress
  - Add error state for upload failures

- [x] **Add File Input Elements**
  - Add hidden file input element
  - Add paperclip icon button using react-icons
  - Style to match existing emoji picker button

- [x] **Update Component Props Interface**
  - Update MessageInputProps to include file handling callbacks
  - Add optional onFileUpload callback

- [x] **Implement File Selection**
  - Add file input ref and click handler
  - Add file change handler
  - Add file removal handler

- [x] **Update Message Sending Logic**
  - Modify handleKeyPress to handle file uploads
  - Add error handling for failed uploads
  - Clear file state after successful send

## 4. Styling and UI Improvements

- [x] **Style File Upload Elements**
  - Match retro theme of application
  - Style file preview/name display
  - Add upload progress indicator
  - Style error messages

- [x] **Add File Preview**
  - Create FilePreview component
  - Handle different file types
  - Show appropriate icons/thumbnails

## 5. Error Handling

- [x] **File Service Errors**
  - Add FileUploadError class
  - Handle network errors
  - Handle server errors
  - Handle validation errors
  - Add specific error codes

- [x] **Component Error Handling**
  - Add error state management
  - Add retry functionality
  - Add warning vs error states
  - Add user-friendly error messages
  - Add error recovery options

## 6. Testing

- [ ] **Unit Tests**
  - Test file upload service
  - Test MessageInput with files
  - Test error scenarios

- [ ] **Integration Tests**
  - Test file upload flow
  - Test message sending with files
  - Test error handling

## 7. Documentation

- [x] **Update Component Documentation**
  - Document new props and interfaces
  - Document file upload limitations
  - Add usage examples

## 8. Deployment Considerations

- [ ] **Update Environment Config**
  - Add file upload endpoint URL
  - Add file size limits
  - Add supported file types

## 9. Rollout Plan

- [ ] **Staging Deployment**
  - Deploy to staging environment
  - Test with various file types
  - Monitor for issues

- [ ] **Production Release**
  - Plan gradual rollout
  - Monitor upload performance
  - Track error rates

## Progress Tracking

Current Status:
- Backend endpoint is ready ✅
- Frontend service has been created ✅
- MessageInput component has been updated ✅
- File display functionality added ✅
- Error handling implemented ✅
- Documentation completed ✅

Next Steps:
1. ~~Create files.ts service~~ ✅
2. ~~Update MessageInput component~~ ✅
3. ~~Add file preview functionality~~ ✅
4. ~~Implement error handling~~ ✅
5. ~~Update documentation~~ ✅
6. Configure deployment settings
