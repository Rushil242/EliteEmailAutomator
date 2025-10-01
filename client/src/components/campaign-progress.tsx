import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface CampaignProgressProps {
  campaignId: string;
  totalContacts: number;
  onComplete: () => void;
}

export default function CampaignProgress({ campaignId, totalContacts, onComplete }: CampaignProgressProps) {
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const sendCampaign = async () => {
      try {
        const result = await api.sendCampaign(campaignId);
        
        setSentCount(result.sentCount);
        setFailedCount(result.failedCount);
        setProgress(100);
        setIsComplete(true);
        
        toast({
          title: "Campaign Completed",
          description: `Sent ${result.sentCount} emails successfully${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}`,
        });

        onComplete();
      } catch (error) {
        toast({
          title: "Campaign Failed",
          description: error instanceof Error ? error.message : "Failed to send campaign",
          variant: "destructive",
        });
      }
    };

    // Start sending campaign
    sendCampaign();

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 1000);

    return () => clearInterval(progressInterval);
  }, [campaignId, onComplete, toast]);

  return (
    <Card data-testid="campaign-progress">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {isComplete ? "Campaign Completed" : "Sending Campaign"}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {!isComplete && (
              <>
                <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm text-muted-foreground">In Progress</span>
              </>
            )}
            {isComplete && (
              <span className="text-sm text-green-600 font-medium">Completed</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground" data-testid="progress-text">
              {isComplete ? `${sentCount + failedCount} of ${totalContacts} processed` : `${Math.round(progress)}%`}
            </span>
          </div>
          <Progress value={progress} className="w-full" data-testid="progress-bar" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600" data-testid="sent-count">{sentCount}</div>
            <div className="text-xs text-green-700">Sent</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-600" data-testid="failed-count">{failedCount}</div>
            <div className="text-xs text-red-700">Failed</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-600" data-testid="remaining-count">
              {isComplete ? 0 : totalContacts - sentCount - failedCount}
            </div>
            <div className="text-xs text-gray-700">Remaining</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
