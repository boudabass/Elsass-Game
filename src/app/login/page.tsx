"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { signInAction } from "@/app/actions/auth";
import { Loader2, Lock, Mail, AlertCircle } from "lucide-react";
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
    // -mx-4 sm:-mx-6 -my-6 sm:-my-8 : reprend tout l'espace laissé par
    // LayoutWrapper pour centrer la carte, mobile-first (min-h-dvh évite
    // le décalage du clavier virtuel sur téléphone).
    <div className="-mx-4 sm:-mx-6 -my-6 sm:-my-8 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden border-elsass-line shadow-sm">
        {/* Liseré tricolore, clin d'œil au bandeau du site principal */}
        <div className="h-1.5 w-full flex">
          <div className="flex-1 bg-elsass-black" />
          <div className="flex-1 bg-elsass-gold" />
          <div className="flex-1 bg-elsass-red" />
        </div>

        <CardHeader className="text-center pt-8 pb-2">
          <CardTitle className="font-heading font-normal text-3xl text-elsass-ink">
            Connexion
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            Avec vos identifiants The Elsassisch
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pb-8">
          {sessionExpired && (
            <div className="flex items-start gap-3 rounded-lg border border-elsass-gold/40 bg-elsass-gold/10 p-3 text-sm text-elsass-ink">
              <AlertCircle className="h-5 w-5 shrink-0 text-elsass-gold" />
              <p>Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-elsass-red hover:bg-elsass-red/90 text-white font-medium"
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
