import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { CloudUpload, FolderOpen } from "lucide-react";
import type { Contact } from "@/types";

interface FileUploadProps {
  onUpload: (data: { contacts: Contact[], contactIds: string[], valid: number, invalid: number, total: number }) => void;
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await api.uploadContacts(file);
      setUploadProgress(100);
      
      toast({
        title: "File uploaded successfully",
        description: `Processed ${result.total} contacts (${result.valid} valid, ${result.invalid} invalid)`,
      });

      onUpload(result);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  if (isUploading) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Processing file...</span>
          <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
        </div>
        <Progress value={uploadProgress} className="w-full" />
      </div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive 
          ? 'border-primary bg-primary/10' 
          : 'border-border hover:border-primary/50'
      }`}
      data-testid="file-upload-zone"
    >
      <input {...getInputProps()} data-testid="file-input" />
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <CloudUpload className="text-2xl text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">Upload Contact List</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop your Excel (.xlsx, .xls) or CSV file here
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Required columns: Name, Email
          </p>
        </div>
        <div className="flex items-center justify-center space-x-4">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="browse-files-button">
            <FolderOpen className="mr-2 h-4 w-4" />
            Browse Files
          </Button>
          <span className="text-xs text-muted-foreground">or drag and drop</span>
        </div>
      </div>
    </div>
  );
}
