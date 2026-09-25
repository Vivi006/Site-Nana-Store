# Enregistrer les commandes Nana Store dans Google Sheets

## Catalogue et administration (Produits)

Le fichier `google-apps-script.js` gère maintenant les commandes **et** un onglet
`Produits` dans le même classeur. Créez cet onglet (ou laissez le script le créer)
avec ces colonnes, dans cet ordre :

`id | nom | categorie | prix | description | image | stock | nouveau | tailles`

`prix` et `stock` sont numériques. `image` est une URL publique (l'interface peut
générer une URL Google Drive). `tailles` contient des valeurs séparées par des virgules. La disponibilité
est calculée côté serveur : `stock > 0` donne `en_stock`, sinon `epuise`.

### Déploiement et mot de passe admin

1. Collez **la totalité** de `google-apps-script.js` dans Apps Script, puis
   déployez-le comme **Application Web**, exécuté en tant que vous et accessible
   à « Tout le monde ». Redéployez après chaque modification du script.
2. Dans Apps Script, ouvrez **Paramètres du projet → Propriétés du script** et
   ajoutez `ADMIN_PASSWORD` avec un mot de passe long et unique. Le mot de passe
   est stocké côté serveur, jamais dans `admin.html`.
3. Dans `script.js`, renseignez `catalogueEndpointUrl` avec l'URL `/exec`.
   Dans `admin.html`, renseignez également `ENDPOINT` avec cette même URL.
4. Ouvrez `/admin.html` pour vous connecter. La page appelle les actions serveur
   `login`, `list`, `save` et `delete`; une protection frontend seule ne serait
   pas une sécurité suffisante.

### Images produit dans Google Drive

L'interface `/admin.html` propose aussi une galerie d'images. Les actions
`listImages`, `uploadImage` et `deleteImage` exigent le même token de session
administrateur. Les téléversements sont limités à 5 Mo et aux formats JPEG,
PNG, GIF, WebP et AVIF.

1. Dans **Paramètres du projet → Propriétés du script**, vous pouvez ajouter
   `PRODUCT_IMAGES_FOLDER_ID` avec l'identifiant d'un dossier Drive existant.
   Le compte qui exécute le déploiement doit pouvoir y écrire.
2. Si cette propriété est absente, le premier chargement de la galerie crée
   automatiquement **Nana Store - Images** à la racine de votre Drive, enregistre
   son identifiant dans la propriété et l'affiche clairement dans l'interface.
   Vous pouvez ensuite remplacer la propriété par l'ID d'un autre dossier si
   nécessaire.
3. Connectez-vous à `/admin.html`, sélectionnez un fichier local (5 Mo maximum),
   puis cliquez sur **Téléverser**. Google Drive rend le fichier lisible par
   lien et la galerie permet de le **Choisir** pour renseigner automatiquement
   l'URL du champ image du produit. **Supprimer** demande confirmation et place
   le fichier à la corbeille Drive.
4. Pour migrer les images historiques du dépôt une seule fois, ouvrez le
   dossier d'images (`images/`), téléversez ses fichiers dans le dossier Drive
   configuré (glisser-déposer dans Drive ou via la galerie), puis choisissez
   chaque image dans l'administration et enregistrez le produit. Les anciennes
   URLs `images/...` restent valides : aucune migration n'est obligatoire.

Les fichiers Drive sont configurés « accessible à toute personne disposant du
lien » afin que la boutique publique puisse afficher les URLs retournées.
N'utilisez pas ce dossier pour des documents confidentiels.

La boutique demande `?action=list` à l'endpoint. En cas d'indisponibilité ou
d'URL non configurée, elle conserve automatiquement le repli sur `products.json`.
Ne modifiez pas `googleSheetWebAppUrl` : il reste utilisé pour enregistrer les
commandes et les notifications e-mail existantes.

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
3. Ouvrez [google-apps-script.js](./google-apps-script.js) dans ce projet.
4. Copiez **la totalité du fichier** et collez-la dans `Code.gs`.
5. Cliquez sur **Enregistrer**.

N'utilisez pas l'ancien bloc de code de commande qui figurait précédemment dans ce guide. Le fichier complet actuel gère ensemble :

- l'enregistrement des commandes dans l'onglet `Commandes` ;
- les notifications e-mail aux administrateurs ;
- la confirmation e-mail au client ;
- le catalogue dans l'onglet `Produits` ;
- les actions de l'interface `admin.html`.

Les deux fonctions restent séparées : une commande normale est enregistrée dans `Commandes`, tandis que les requêtes de l'administration utilisent `Produits`.

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
