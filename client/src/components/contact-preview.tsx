import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import type { Contact } from "@/types";

interface ContactPreviewProps {
  contacts: Contact[];
  validCount: number;
  invalidCount: number;
  totalCount: number;
}

export default function ContactPreview({ contacts, validCount, invalidCount, totalCount }: ContactPreviewProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden mt-4" data-testid="contact-preview">
      <div className="bg-muted px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Contact Preview</h3>
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <span>Valid: <span className="text-green-600 font-medium" data-testid="valid-count">{validCount}</span></span>
            <span>Invalid: <span className="text-red-600 font-medium" data-testid="invalid-count">{invalidCount}</span></span>
            <span>Total: <span className="font-medium" data-testid="total-count">{totalCount}</span></span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.map((contact, index) => (
              <tr key={contact.id} className={index % 2 === 1 ? 'bg-muted/30' : ''} data-testid={`contact-row-${index}`}>
                <td className="px-4 py-3 text-foreground" data-testid={`contact-name-${index}`}>{contact.name}</td>
                <td className="px-4 py-3 text-foreground" data-testid={`contact-email-${index}`}>{contact.email}</td>
                <td className="px-4 py-3">
                  <Badge 
                    variant={contact.isValid ? "default" : "destructive"}
                    className={contact.isValid ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                    data-testid={`contact-status-${index}`}
                  >
                    {contact.isValid ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Valid
                      </>
                    ) : (
                      <>
                        <X className="mr-1 h-3 w-3" />
                        Invalid
                      </>
                    )}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground">
        Showing first {Math.min(contacts.length, 10)} of {totalCount} contacts
      </div>
    </div>
  );
}
