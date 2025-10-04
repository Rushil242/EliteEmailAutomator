import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Image } from "lucide-react";
import MessageGenerator from "./message-generator";
import ImageGenerator from "./image-generator";

export default function AiMessageCreator() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Bot className="text-primary text-lg" />
            </div>
            <div>
              <span className="text-xl font-semibold text-foreground">AI Message Creator</span>
              <p className="text-sm text-muted-foreground font-normal">Generate compliant WhatsApp & SMS marketing messages</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MessageGenerator />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Image className="text-primary text-lg" />
            </div>
            <div>
              <span className="text-xl font-semibold text-foreground">AI Image Generator</span>
              <p className="text-sm text-muted-foreground font-normal">Create professional marketing visuals with AI</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageGenerator />
        </CardContent>
      </Card>
    </div>
  );
}
