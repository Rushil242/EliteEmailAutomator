import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Edit } from "lucide-react";
import FileUpload from "./file-upload";
import ContactPreview from "./contact-preview";
import EmailComposer from "./email-composer";
import CampaignProgress from "./campaign-progress";
import type { Contact } from "@/types";

export default function EmailMarketing() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showContacts, setShowContacts] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<'idle' | 'sending' | 'completed'>('idle');

  const handleFileUpload = (data: { contacts: Contact[], contactIds: string[], valid: number, invalid: number, total: number }) => {
    setContacts(data.contacts);
    setContactIds(data.contactIds);
    setValidCount(data.valid);
    setInvalidCount(data.invalid);
    setTotalCount(data.total);
    setShowContacts(true);
  };

  const handleCampaignStart = (campaignId: string) => {
    setCurrentCampaign(campaignId);
    setCampaignStatus('sending');
  };

  const handleCampaignComplete = () => {
    setCampaignStatus('completed');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mail className="text-primary text-lg" />
            </div>
            <div>
              <span className="text-xl font-semibold text-foreground">Bulk Email Marketing</span>
              <p className="text-sm text-muted-foreground font-normal">Send personalized emails to your student database</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload onUpload={handleFileUpload} />
          
          {showContacts && (
            <ContactPreview 
              contacts={contacts}
              validCount={validCount}
              invalidCount={invalidCount}
              totalCount={totalCount}
            />
          )}
        </CardContent>
      </Card>

      {showContacts && campaignStatus === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Edit className="text-primary text-lg" />
              </div>
              <div>
                <span className="text-xl font-semibold text-foreground">Compose Email</span>
                <p className="text-sm text-muted-foreground font-normal">Create personalized email campaigns</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmailComposer 
              contactIds={contactIds}
              onCampaignStart={handleCampaignStart}
            />
          </CardContent>
        </Card>
      )}

      {currentCampaign && campaignStatus !== 'idle' && (
        <CampaignProgress 
          campaignId={currentCampaign}
          totalContacts={validCount}
          onComplete={handleCampaignComplete}
        />
      )}
    </div>
  );
}
