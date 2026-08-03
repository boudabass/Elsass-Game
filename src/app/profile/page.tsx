import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionUser } from "@/app/actions/auth"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect("/login?expired=1&next=/profile");

    return (
        <div className="container mx-auto py-8 animate-in fade-in duration-500">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-8">
                Mon Profil
            </h1>

            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle>Informations du compte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="font-bold text-lg">{user.name}</p>
                    <p className="text-sm text-slate-500">{user.username}</p>
                </CardContent>
            </Card>
        </div>
    )
}
