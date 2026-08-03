/*
 * Client Odoo réduit à l'AUTHENTIFICATION uniquement.
 *
 * Depuis la migration PostgreSQL (07/2026), Odoo ne sert plus qu'à vérifier
 * les identifiants portail au moment du login. Catalogue, scores et
 * sauvegardes vivent dans PostgreSQL (src/lib/db.ts) ; l'identité entre deux
 * logins est portée par le cookie signé (src/lib/session.ts).
 */
export class OdooClient {
  private url: string;
  private db: string;

  constructor() {
    // On s'assure d'enlever le slash final s'il y en a un
    const rawUrl = process.env.ODOO_URL || "";
    this.url = rawUrl.replace(/\/$/, "");
    this.db = process.env.ODOO_DB || "";
  }

  /**
   * Vérifie les identifiants portail auprès d'Odoo.
   * Renvoie l'objet session Odoo (uid, name, username, ...).
   */
  async authenticate(login: string, password: string) {
    if (!this.url || !this.db) {
      throw new Error("Configuration manquante : définir ODOO_URL et ODOO_DB (voir .env.example).");
    }

    const response = await fetch(`${this.url}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { db: this.db, login, password },
        id: Math.floor(Math.random() * 1000000000),
      }),
    });

    if (!response.ok) {
      throw new Error(`Odoo API Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Odoo RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const user = data.result;
    if (!user || !user.uid) {
      throw new Error("Identifiants incorrects ou échec de l'authentification");
    }
    return { user };
  }
}

// Export a singleton instance
export const odooClient = new OdooClient();
