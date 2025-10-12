import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Sparkles, Download, RotateCcw } from "lucide-react";

export default function ImageGenerator() {
  const [imageDescription, setImageDescription] = useState('Students studying in modern classroom');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const pollImageStatus = async (taskId: string, originalPrompt: string) => {
    const maxAttempts = 40;
    const baseDelay = 2000;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResult = await api.checkImageStatus(taskId);

        if (statusResult.status === 'COMPLETED' && statusResult.imageUrl) {
          // Use enhanced prompt from status response (generated during lazy initialization)
          setOriginalPrompt(originalPrompt);
          setEnhancedPrompt(statusResult.enhancedPrompt || originalPrompt);
          setImageUrl(statusResult.imageUrl);
          setIsGenerating(false);

          toast({
            title: "Image Generated",
            description: "Your AI-powered marketing image is ready",
          });
          return;
        } else if (statusResult.status === 'FAILED') {
          throw new Error(statusResult.error || 'Image generation failed');
        } else if (statusResult.status === 'RATE_LIMITED') {
          const retryAfter = parseInt(statusResult.retryAfter || '30') * 1000;
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          attempts++;
          continue;
        }

        // Exponential backoff with max 8 seconds
        const delay = Math.min(baseDelay * Math.pow(1.5, attempts), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
      } catch (error) {
        setIsGenerating(false);
        throw error;
      }
    }

    throw new Error('Image generation timed out. Please try again.');
  };

  const handleGenerate = async () => {
    if (!imageDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an image description",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Step 1: Start image generation
      const startResult = await api.startImageGeneration({
        imageDescription
      });

      if (!startResult.taskId) {
        throw new Error('No task ID received from server');
      }

      // Step 2: Poll for completion (enhanced prompt will be fetched during polling)
      await pollImageStatus(
        startResult.taskId,
        startResult.originalPrompt
      );

    } catch (error) {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate image",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `elite-iit-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: "Your image is being downloaded",
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="imageDescription" className="block text-sm font-medium text-foreground mb-2">
            Image Description
          </Label>
          <Textarea
            id="imageDescription"
            rows={3}
            placeholder="Describe the image you want to create... e.g., 'Students studying in modern classroom' or 'Teacher explaining physics on whiteboard'"
            value={imageDescription}
            onChange={(e) => setImageDescription(e.target.value)}
            className="resize-none"
            data-testid="image-description-textarea"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Keep it simple - AI will enhance your description with professional details
          </p>
        </div>

        <Button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="generate-image-button"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating AI Image..." : "Generate AI Image"}
        </Button>
      </div>

      {imageUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Generated Image</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="regenerate-image-button"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Regenerate
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                className="bg-green-600 text-white hover:bg-green-700"
                data-testid="download-image-button"
              >
                <Download className="mr-1 h-3 w-3" />
                Download Image
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
            <img 
              src={imageUrl} 
              alt="Generated marketing visual" 
              className="w-full h-auto"
              data-testid="generated-image"
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-foreground">Original Prompt</Label>
              <div className="mt-1 border border-border rounded-lg p-3 bg-muted/30">
                <p className="text-sm text-foreground" data-testid="original-prompt">{originalPrompt}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">AI-Enhanced Prompt</Label>
              <div className="mt-1 border border-border rounded-lg p-3 bg-muted/30">
                <p className="text-sm text-foreground" data-testid="enhanced-prompt">{enhancedPrompt}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
