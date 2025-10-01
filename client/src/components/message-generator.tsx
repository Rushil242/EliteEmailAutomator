import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Wand2, RotateCcw, Copy } from "lucide-react";
import ComplianceChecker from "./compliance-checker";
import type { AiMessage, ComplianceCheck } from "@/types";

export default function MessageGenerator() {
  const [messageType, setMessageType] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [promotionalIdea, setPromotionalIdea] = useState('20% off Navodhaya coaching for students who register by month end. Special batch starting January 15th with expert faculty.');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [characterCount, setCharacterCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [compliance, setCompliance] = useState<ComplianceCheck | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!promotionalIdea.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a promotional idea",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result: AiMessage & { compliance: ComplianceCheck } = await api.generateAiMessage({
        messageType,
        promotionalIdea
      });

      setGeneratedMessage(result.generatedMessage);
      setCharacterCount(result.characterCount);
      setWordCount(result.wordCount);
      setCompliance(result.compliance);

      toast({
        title: "Message Generated",
        description: `Generated ${messageType} message with ${result.characterCount} characters`,
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate message",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      toast({
        title: "Copied to clipboard",
        description: "Message is ready to paste in Interakt",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the message manually",
        variant: "destructive",
      });
    }
  };

  const maxCharacters = messageType === 'sms' ? 160 : 200;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="messageType" className="block text-sm font-medium text-foreground mb-2">
            Message Type
          </Label>
          <Select value={messageType} onValueChange={(value: 'whatsapp' | 'sms') => setMessageType(value)}>
            <SelectTrigger data-testid="message-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp (Max 200 characters)</SelectItem>
              <SelectItem value="sms">SMS (Max 160 characters)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="promotionalIdea" className="block text-sm font-medium text-foreground mb-2">
            Promotional Campaign Idea
          </Label>
          <Textarea
            id="promotionalIdea"
            rows={4}
            placeholder="Describe your promotion idea here... e.g., '20% off Navodhaya coaching for students who register by month end. Special batch starting January 15th with expert faculty.'"
            value={promotionalIdea}
            onChange={(e) => setPromotionalIdea(e.target.value)}
            className="resize-none"
            data-testid="promotional-idea-textarea"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Include details like discount percentage, course names, deadlines, and target audience for better results
          </p>
        </div>

        <Button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="generate-message-button"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {isGenerating ? "Generating AI Message..." : "Generate AI Message"}
        </Button>
      </div>

      {generatedMessage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Generated Message</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="regenerate-button"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Regenerate
              </Button>
              <Button
                size="sm"
                onClick={handleCopy}
                className="bg-green-600 text-white hover:bg-green-700"
                data-testid="copy-message-button"
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy for Interakt
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <div className="whitespace-pre-wrap text-sm text-foreground" data-testid="generated-message">
              {generatedMessage}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground" data-testid="message-character-count">{characterCount}</div>
              <div className="text-xs text-muted-foreground">Characters</div>
              <div className={`text-xs ${characterCount <= maxCharacters ? 'text-green-600' : 'text-red-600'}`}>
                {characterCount <= maxCharacters ? `Within ${messageType} limit` : `Exceeds ${messageType} limit`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground" data-testid="message-word-count">{wordCount}</div>
              <div className="text-xs text-muted-foreground">Words</div>
              <div className="text-xs text-green-600">Optimal length</div>
            </div>
          </div>

          {compliance && (
            <ComplianceChecker compliance={compliance} />
          )}

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="copy-success-notification">
              <div className="flex items-center">
                <Copy className="text-green-600 mr-2 h-4 w-4" />
                <span className="text-sm text-green-800">Message copied to clipboard! Ready to paste in Interakt.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
