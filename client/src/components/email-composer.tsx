import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { NotebookPen } from "lucide-react";

interface EmailComposerProps {
  contactIds: string[];
  onCampaignStart: (campaignId: string) => void;
}

export default function EmailComposer({ contactIds, onCampaignStart }: EmailComposerProps) {
  const [subject, setSubject] = useState("Welcome to Elite IIT, {name}!");
  const [message, setMessage] = useState(`Dear {name},

Welcome to Elite IIT Coaching Institute! We're excited to have you join our community of 35,000+ successful students.

With over 17 years of excellence in IIT-JEE, NEET, CET, GATE, and CAT preparations, our expert faculty is here to guide you towards success.

Get started with your preparation journey today!

Best regards,
Elite IIT Team`);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleSendCampaign = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both subject and message fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const campaign = await api.createCampaign({
        subject,
        message,
        contactIds
      });

      toast({
        title: "Campaign Created",
        description: "Starting email delivery...",
      });

      onCampaignStart(campaign.id);
    } catch (error) {
      toast({
        title: "Campaign Failed",
        description: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const characterCount = message.length;
  const wordCount = message.split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
          Subject Line
        </Label>
        <Input
          id="subject"
          type="text"
          placeholder="Welcome to Elite IIT, {name}!"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full"
          data-testid="email-subject-input"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Use {"{name}"} placeholder for personalization
        </p>
      </div>

      <div>
        <Label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
          Message Body
        </Label>
        <Textarea
          id="message"
          rows={12}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-none"
          data-testid="email-message-textarea"
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">
            Characters: <span className="font-medium" data-testid="character-count">{characterCount}</span> | 
            Words: <span className="font-medium" data-testid="word-count">{wordCount}</span>
          </p>
        </div>
      </div>

      <Button 
        onClick={handleSendCampaign}
        disabled={isCreating}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        data-testid="send-campaign-button"
      >
        <NotebookPen className="mr-2 h-4 w-4" />
        {isCreating ? "Creating Campaign..." : "Send Campaign"}
      </Button>
    </div>
  );
}
