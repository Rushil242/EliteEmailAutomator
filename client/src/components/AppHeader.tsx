import { GraduationCap, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function AppHeader() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      setLocation('/login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      });
    }
  };

  return (
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
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-primary">17+ Years of Excellence</div>
              <div className="text-xs text-muted-foreground">35,000+ Students • Expert Faculty</div>
            </div>
            {user && (
              <div className="flex items-center space-x-3 border-l border-border pl-4">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-foreground flex items-center justify-end space-x-1">
                    <User className="h-3 w-3" />
                    <span data-testid="text-user-email">{user.email}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Logged In</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
