import { getSessionUser } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { ProfileMenu } from "@/components/profile-menu"

export default async function ProfilePage() {
    // Session signée (HMAC) : invalide ou expirée -> retour au login.
    const user = await getSessionUser();
    if (!user) redirect("/login?expired=1&next=/profile");

    const isAdmin = !!process.env.ADMIN_UID && String(user.uid) === process.env.ADMIN_UID;
    const displayName = user.name || user.username?.split("@")[0] || "Joueur";
    const initiale = displayName.charAt(0).toUpperCase();

    return (
        // Colonne centrée à toutes les largeurs : choix délibéré pour CET
        // écran (un profil se lit bien en colonne, comme /login) — pas un
        // plafond hérité par défaut, les autres pages du shell utilisent
        // toute la largeur disponible.
        <div className="mx-auto max-w-md animate-in fade-in duration-500">
            <div className="mb-8 flex flex-col items-center text-center">
                <div className="mb-3 flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-elsass-black font-heading text-2xl text-elsass-gold">
                    {initiale}
                </div>
                <p className="text-lg font-semibold text-elsass-ink">{displayName}</p>
                <p className="text-sm text-elsass-ink/55">{user.username}</p>
            </div>

            <ProfileMenu isAdmin={isAdmin} />
        </div>
    )
}
