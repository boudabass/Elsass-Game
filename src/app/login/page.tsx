"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { signInAction } from "@/app/actions/auth";
import { Gamepad2, Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // ?expired=1 : la session Odoo a expiré, on explique pourquoi on est là.
  const sessionExpired = searchParams?.get("expired") === "1";
  // ?next=/games : page à réouvrir après connexion (chemins internes uniquement).
  const rawNext = searchParams?.get("next") || "";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await signInAction(formData);

      if (res.success) {
        toast.success("Connexion réussie !");
        await refreshAuth();
        router.push(nextPath);
      } else {
        toast.error(res.error || "Identifiants incorrects.");
      }
    } catch (err) {
      toast.error("Une erreur est survenue lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[800px] bg-slate-950 text-white flex items-center justify-center p-6 selection:bg-indigo-500/30 relative overflow-hidden">
      {/* Arrière-plan dégradé dynamique */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 z-0"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>

      <Card className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-indigo-500/10 relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 animate-pulse">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            ARCADE.OS
          </CardTitle>
          <CardDescription className="text-slate-400 mt-2 font-medium">
            Connectez-vous avec vos identifiants Odoo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">

          {sessionExpired && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              <p>Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <Input 
                  id="email" 
                  name="email"
                  type="email" 
                  placeholder="votre@email.com" 
                  required 
                  className="pl-10 bg-slate-950/50 border-white/10 focus:border-indigo-500 text-white placeholder:text-slate-600"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Mot de passe</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <Input 
                  id="password" 
                  name="password"
                  type="password" 
                  required 
                  className="pl-10 bg-slate-950/50 border-white/10 focus:border-indigo-500 text-white"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/20 shadow-lg shadow-indigo-900/20 h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="text-center">
            <span className="text-xs text-slate-600 bg-slate-950/50 px-3 py-1.5 rounded-full border border-white/5 font-mono">
              Odoo Secure Auth
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams impose une frontière Suspense en Next 15.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
