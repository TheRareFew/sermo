import { apiRequest, API_URL } from './utils';
import { getAuthToken } from './auth';
import { Attachment } from '../../types';

export interface FileResponse {
  id: number;
  filename: string;
  file_type: string;
  file_path: string;
  message_id?: number;
  created_at: string;
}

export class FileUploadError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/**
 * Uploads a file to the server
 * @param file The file to upload
 * @param messageId Optional message ID to attach the file to
 * @returns Promise<FileResponse>
 * @throws {FileUploadError} When upload fails with specific error details
 */
export const uploadFile = async (file: File, messageId?: number): Promise<FileResponse> => {
  console.log(`Uploading file ${file.name}...`);
  
  // Validate file size
  if (file.size > 50 * 1024 * 1024) {
    throw new FileUploadError(
      'File size exceeds 50MB limit',
      'FILE_TOO_LARGE'
    );
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
  if (!allowedTypes.includes(file.type)) {
    throw new FileUploadError(
      'File type not supported. Allowed types: jpg, png, gif, pdf, txt',
      'INVALID_FILE_TYPE'
    );
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Always send message_id as a string in form data
    formData.append('message_id', messageId ? messageId.toString() : '');

    const token = getAuthToken();
    if (!token) {
      throw new FileUploadError(
        'Authentication required. Please log in.',
        'AUTH_ERROR'
      );
    }

    // Send the upload request
    const response = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      mode: 'cors',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || 'Unknown error occurred';
      } catch {
        errorMessage = await response.text() || 'Unknown error occurred';
      }
      console.error('Upload failed:', errorMessage);
      
      if (response.status === 413) {
        throw new FileUploadError(
          'File size too large for server. Maximum size: 50MB',
          'SERVER_FILE_TOO_LARGE'
        );
      }
      if (response.status === 415) {
        throw new FileUploadError(
          'File type not accepted by server',
          'SERVER_INVALID_TYPE'
        );
      }
      if (response.status === 401) {
        throw new FileUploadError(
          'Authentication error. Please try logging in again.',
          'AUTH_ERROR'
        );
      }
      if (response.status === 503) {
        throw new FileUploadError(
          'Server is temporarily unavailable. Please try again later.',
          'SERVER_ERROR'
        );
      }
      if (response.status === 500) {
        throw new FileUploadError(
          `Server error: ${errorMessage}`,
          'SERVER_ERROR'
        );
      }

      throw new FileUploadError(
        `Upload failed: ${errorMessage}`,
        'UPLOAD_FAILED'
      );
    }

    const responseData = await response.json();
    console.log('File uploaded successfully:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error uploading file:', error);
    
    if (error instanceof FileUploadError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('NetworkError')) {
      throw new FileUploadError(
        'Network error occurred. Please check your connection and try again.',
        'NETWORK_ERROR'
      );
    }

    // Generic error case
    throw new FileUploadError(
      'Failed to upload file. Please try again.',
      'UPLOAD_FAILED'
    );
  }
}; 

/**
 * Updates a file's message ID
 * @param fileId The ID of the file to update
 * @param messageId The ID of the message to associate with the file
 * @returns Promise<FileResponse>
 */
export const updateFileMessage = async (fileId: number, messageId: number): Promise<FileResponse> => {
  try {
    const response = await apiRequest<FileResponse>(`/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ message_id: messageId }),
    });
    console.log('File updated successfully:', response);
    return response;
  } catch (error) {
    console.error('Error updating file:', error);
    throw new FileUploadError(
      'Failed to update file. Please try again.',
      'UPDATE_FAILED'
    );
  }
}; 

/**
 * Gets all files attached to a message
 * @param messageId The ID of the message
 * @returns Promise<Attachment[]>
 */
export const getMessageFiles = async (messageId: string): Promise<Attachment[]> => {
  try {
    const response = await apiRequest<Attachment[]>(`/files/messages/${messageId}/files`);
    console.log('Message files retrieved successfully:', response);
    return response;
  } catch (error) {
    console.error('Error getting message files:', error);
    throw new FileUploadError(
      'Failed to get message files. Please try again.',
      'GET_FILES_FAILED'
    );
  }
}; 