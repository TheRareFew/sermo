import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { API_URL } from '../../../services/api/utils';

interface FilePreviewProps {
  filename: string;
  fileType: string;
  filePath: string;
  fileSize?: number;
  fileId: number;
}

const PreviewContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: ${props => props.theme.colors.inputBackground};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  margin-top: 4px;
  max-width: 400px;
`;

const FileIcon = styled.span`
  font-family: monospace;
  font-size: 24px;
`;

const FileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const FileName = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileType = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: ${props => props.theme.colors.textLight};
`;

const FileSize = styled(FileType)`
  color: ${props => props.theme.colors.textDim};
`;

const DownloadLink = styled.a`
  font-family: monospace;
  font-size: 16px;
  color: ${props => props.theme.colors.text};
  text-decoration: none;
  padding: 4px 8px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  background: none;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const ImagePreview = styled.img`
  max-width: 300px;
  max-height: 200px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  margin-top: 4px;
`;

const FilePreview: React.FC<FilePreviewProps> = ({ filename, fileType, filePath, fileSize, fileId }) => {
  const isImage = fileType.startsWith('image/');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No authentication token found - please log in again');
    }
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    let mounted = true;

    if (isImage) {
      const loadImage = async () => {
        try {
          const response = await fetch(`${API_URL}/files/download/${fileId}`, {
            headers: getAuthHeaders()
          });

          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Please log in again to view this image');
            }
            throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          if (mounted) {
            setImageUrl(url);
            setError('');
          }
        } catch (error) {
          console.error('Error loading image preview:', error);
          if (mounted) {
            setError(error instanceof Error ? error.message : 'Failed to load image');
            setImageUrl('');
          }
        }
      };

      loadImage();
    }

    // Cleanup function
    return () => {
      mounted = false;
      if (imageUrl) {
        window.URL.revokeObjectURL(imageUrl);
      }
    };
  }, [fileId, isImage]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/files/download/${fileId}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in again to download this file');
        }
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setError('');
    } catch (error) {
      console.error('Error downloading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download file';
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  const getFileIcon = () => {
    switch (fileType) {
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        return '🖼️';
      case 'application/pdf':
        return '📄';
      case 'text/plain':
        return '📝';
      default:
        return '📎';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <PreviewContainer>
      <FileIcon>{getFileIcon()}</FileIcon>
      <FileInfo>
        <FileName>{filename}</FileName>
        <FileType>{fileType}</FileType>
        {fileSize && <FileSize>{formatFileSize(fileSize)}</FileSize>}
        {error && <FileType style={{ color: 'red' }}>{error}</FileType>}
        {isImage && imageUrl && <ImagePreview src={imageUrl} alt={filename} />}
      </FileInfo>
      <DownloadLink onClick={handleDownload} href="#" title="Download file">
        ⬇️
      </DownloadLink>
    </PreviewContainer>
  );
};

export default FilePreview; 