import { Check, X, Shield } from "lucide-react";
import type { ComplianceCheck } from "@/types";

interface ComplianceCheckerProps {
  compliance: ComplianceCheck;
}

export default function ComplianceChecker({ compliance }: ComplianceCheckerProps) {
  const checks = [
    { key: 'hasOptOut', label: 'Has opt-out instruction', value: compliance.hasOptOut },
    { key: 'hasBusinessName', label: 'Includes business name', value: compliance.hasBusinessName },
    { key: 'withinLimit', label: 'Within character limit', value: compliance.withinLimit },
    { key: 'hasCTA', label: 'Contains call-to-action', value: compliance.hasCTA },
    { key: 'hasLocation', label: 'Includes location', value: compliance.hasLocation },
  ];

  return (
    <div className="bg-muted/50 rounded-lg p-4" data-testid="compliance-checker">
      <h4 className="text-sm font-medium text-foreground mb-3">Compliance Status</h4>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{check.label}</span>
            <span className={check.value ? "text-green-600" : "text-red-600"} data-testid={`compliance-${check.key}`}>
              {check.value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </span>
          </div>
        ))}
      </div>
      <div className={`mt-3 p-2 rounded text-xs ${
        compliance.isCompliant 
          ? 'bg-green-50 text-green-800' 
          : 'bg-red-50 text-red-800'
      }`} data-testid="compliance-status">
        <Shield className="inline mr-1 h-3 w-3" />
        {compliance.isCompliant 
          ? 'Message is fully compliant for WhatsApp marketing'
          : 'Message needs improvements for compliance'
        }
      </div>
    </div>
  );
}
