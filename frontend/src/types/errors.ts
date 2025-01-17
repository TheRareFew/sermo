export class FileUploadError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'FileUploadError';
  }
}

export interface ErrorState {
  message: string;
  code?: string;
  isWarning?: boolean;
} 