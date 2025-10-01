import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmailMarketing from "@/components/email-marketing";
import AiMessageCreator from "@/components/ai-message-creator";
import { GraduationCap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <GraduationCap className="text-primary-foreground text-xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Elite IIT Coaching Institute</h1>
                  <p className="text-sm text-muted-foreground">Yelahanka, Bangalore</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-primary">17+ Years of Excellence</div>
              <div className="text-xs text-muted-foreground">35,000+ Students • Expert Faculty</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <EmailMarketing />
          <AiMessageCreator />
        </div>

        {/* Instructions Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">ℹ️</span>
              </div>
              <span>Quick Instructions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">1</span>
              <span>Upload Excel/CSV file with Name and Email columns</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">2</span>
              <span>Compose email with {"{name}"} placeholder for personalization</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">3</span>
              <span>Generate AI messages and copy to Interakt for WhatsApp/SMS campaigns</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              © 2024 Elite IIT Coaching Institute, Yelahanka, Bangalore. All rights reserved.
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              IIT-JEE • NEET • CET • GATE • CAT Preparations | Online & Offline Classes
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
