# Enregistrer les commandes Nana Store dans Google Sheets

Google Sheets fonctionne ici comme un second canal indépendant de Netlify Forms. Le site envoie la commande à Netlify pour l'e-mail et, séparément, à votre application Web Google Apps Script pour l'enregistrement dans le tableau.

## 1. Créer le Google Sheet

1. Ouvrez [Google Sheets](https://sheets.google.com) et créez une feuille vierge.
2. Renommez-la par exemple **Nana Store - Commandes**.
3. Dans la première ligne, placez exactement ces colonnes, dans cet ordre :

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Date | Numéro commande | Client | Téléphone | Commune | Adresse | Récapitulatif | Total | Mode de paiement | Statut paiement | Note livraison | Statut commande |

La colonne **Statut commande** est volontairement laissée à votre équipe. Utilisez manuellement : `Nouvelle`, `En livraison`, `Livrée` ou `Annulée`.

## 2. Créer le script Apps Script

1. Dans le Sheet, allez dans **Extensions → Apps Script**.
2. Supprimez le contenu de `Code.gs`.
3. Collez ce code complet :

```javascript
const NOM_FEUILLE = "Feuille 1";
const NOTIFICATION_EMAILS = [
  "votre-email-interne@example.com",
  // "email-de-votre-associee@example.com",
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Aucune donnée JSON reçue.");
    }

    const commande = JSON.parse(e.postData.contents);
    const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOM_FEUILLE);

    if (!feuille) {
      throw new Error(`La feuille "${NOM_FEUILLE}" est introuvable.`);
    }

    feuille.appendRow([
      commande.date || new Date().toISOString(),
      commande.numero_commande || "",
      commande.nom_client || "",
      commande.telephone || "",
      commande.commune || "",
      commande.adresse || "",
      commande.recapitulatif_commande || "",
      commande.total || 0,
      commande.mode_paiement || "",
      commande.statut_paiement || "",
      commande.note_livraison || "",
      "Nouvelle"
    ]);

    if (NOTIFICATION_EMAILS.length) {
      MailApp.sendEmail({
        to: NOTIFICATION_EMAILS.join(","),
        subject: `Nouvelle commande Nana Store - ${commande.numero_commande || "sans numéro"}`,
        body: [
          `Commande : ${commande.numero_commande || ""}`,
          `Client : ${commande.nom_client || ""}`,
          `Téléphone : ${commande.telephone || ""}`,
          `Commune : ${commande.commune || ""}`,
          `Adresse : ${commande.adresse || ""}`,
          "",
          commande.recapitulatif_commande || "",
          "",
          `Total : ${commande.total || 0} FCFA`,
          `Paiement : ${commande.mode_paiement || ""}`,
          `Statut paiement : ${commande.statut_paiement || ""}`,
          `Livraison : ${commande.note_livraison || ""}`
        ].join("\n")
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (erreur) {
    console.error(erreur);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erreur: erreur.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

Si votre onglet porte un autre nom, remplacez `Feuille 1` dans `NOM_FEUILLE` par le nom exact de l'onglet.

4. Cliquez sur **Enregistrer**.

## 3. Déployer l'application Web

1. Dans Apps Script, cliquez sur **Déployer → Nouveau déploiement**.
2. Cliquez sur l'engrenage et choisissez **Application Web**.
3. Configurez :
   - **Exécuter en tant que** : Moi ;
   - **Qui a accès** : Tout le monde.
4. Cliquez sur **Déployer** et acceptez les autorisations Google.
5. Copiez l'URL qui se termine généralement par `/exec`.

## 4. Relier l'URL au site

Ouvrez [script.js](./script.js), puis renseignez l'URL dans `CONFIG` :

```javascript
const CONFIG = {
  googleSheetWebAppUrl: "https://script.google.com/macros/s/VOTRE_ID/exec",
  // ...
};
```

Tant que la valeur commence par `[URL_`, l'enregistrement Google Sheets est simplement désactivé. Netlify Forms continue alors de fonctionner seul.

Le site envoie à Google Sheets :

- `numero_commande` ;
- `date` ;
- `nom_client` ;
- `telephone` ;
- `commune` ;
- `adresse` ;
- `recapitulatif_commande` ;
- `total` hors livraison ;
- `mode_paiement` ;
- `statut_paiement` ;
- `note_livraison`.

Le récapitulatif contient un produit par ligne. Pour le paiement à la livraison, le statut est `À encaisser à la livraison`. Pour un paiement mobile, il est `Payé - à vérifier`.

Les deux envois sont indépendants : le site tente l'envoi Google Sheets sans attendre sa réponse, puis traite Netlify Forms séparément. Une panne Google Sheets ne bloque donc pas la commande et une panne Netlify n'empêche pas l'enregistrement dans le Sheet.

## 5. Mise en forme conditionnelle

Pour colorer les commandes nouvelles :

1. Sélectionnez la plage du tableau, par exemple `A2:L1000`.
2. Allez dans **Format → Mise en forme conditionnelle**.
3. Choisissez **La formule personnalisée est**.
4. Saisissez :

```text
=$L2="Nouvelle"
```

5. Choisissez un fond rouge clair et un texte rouge foncé.
6. Cliquez sur **OK**.

Vous pouvez créer d'autres règles :

```text
=$L2="En livraison"
=$L2="Livrée"
=$L2="Annulée"
```

Associez par exemple le bleu à `En livraison`, le vert à `Livrée` et le gris à `Annulée`.

## 6. Tester

1. Redéployez le dossier du site sur Netlify après avoir renseigné l'URL.
2. Ajoutez un produit au panier et envoyez une commande test.
3. Vérifiez la présence de la ligne dans Netlify Forms et dans le Google Sheet.
4. Si aucune ligne n'apparaît, vérifiez le nom de l'onglet, l'accès **Tout le monde** et l'URL `/exec`.
