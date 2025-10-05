import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Mail, Lock, Sparkles, Award, Users } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Invalid email or password. Please try again.",
          });
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: "Please check your internet connection and try again.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "An error occurred during login.",
          });
        }
      } else {
        toast({
          title: "Login Successful",
          description: "Welcome back to Elite IIT Marketing Automation!",
        });
        setLocation('/email-campaigns');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"></div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <GraduationCap className="text-white text-4xl" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Elite IIT Coaching Institute
          </h1>
          <p className="text-sm text-muted-foreground mb-1">Yelahanka, Bangalore</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Marketing Automation</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your marketing dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="input-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline transition-colors"
                  onClick={(e) => e.preventDefault()}
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stats/Features */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/50 dark:border-slate-700/50">
            <Award className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">17+ Years</p>
            <p className="text-[10px] text-muted-foreground">Excellence</p>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/50 dark:border-slate-700/50">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">35,000+</p>
            <p className="text-[10px] text-muted-foreground">Students</p>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-xl p-3 text-center border border-slate-200/50 dark:border-slate-700/50">
            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expert</p>
            <p className="text-[10px] text-muted-foreground">Faculty</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            © 2024 Elite IIT Coaching Institute. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            IIT-JEE • NEET • CET • GATE • CAT Preparations
          </p>
        </div>
      </div>
    </div>
  );
}
