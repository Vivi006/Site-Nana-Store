/**
 * ==============================================================================
 * NANA STORE - SCRIPT GOOGLE SHEETS & NOTIFICATIONS EMAIL AUTOMATIQUES
 * ==============================================================================
 * 
 * Ce script est à coller directement dans votre Google Sheets :
 * Menu haut > Extensions > Apps Script
 *
 * Fonctionnalités automatiques :
 * 1. Insère chaque commande du site web sur une nouvelle ligne du tableau
 * 2. Envoie une alerte e-mail instantanée à vous ET à votre amie
 * 3. Envoie un e-mail de confirmation élégant au client (s'il a saisi son adresse e-mail)
 */

// ==============================================================================
// 1. ADRESSES E-MAILS DE RÉCEPTION DES COMMANDES
// ==============================================================================
// Vous pouvez ajouter, modifier ou supprimer des adresses e-mails à tout moment ici :
const NOTIFICATION_EMAILS = [
  "vitianacharles28@gmail.com",
  "kouadiothalmas@gmail.com",
];

// Paramètres de la boutique
const NOM_BOUTIQUE = "Nana Store";
const WHATSAPP_CONTACT = "+225 05 45 15 31 93";
const PRODUITS_SHEET_NAME = "Produits";
const PRODUITS_HEADERS = ["id", "nom", "categorie", "prix", "description", "image", "stock", "nouveau", "tailles"];
const ADMIN_TOKEN_TTL_SECONDS = 21600;

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function productSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUITS_SHEET_NAME)
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet(PRODUITS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, PRODUITS_HEADERS.length).setValues([PRODUITS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function productFromRow(row) {
  const stock = Math.max(0, Number(row[6]) || 0);
  return {
    id: String(row[0] || ""),
    nom: String(row[1] || ""),
    categorie: String(row[2] || ""),
    prix: Number(row[3]) || 0,
    description: String(row[4] || ""),
    image: String(row[5] || ""),
    stock: stock,
    disponibilite: stock > 0 ? "en_stock" : "epuise",
    nouveau: row[7] === true || String(row[7]).toLowerCase() === "true" || String(row[7]) === "1",
    tailles: String(row[8] || "").split(/[,;\/]/).map(function (size) { return size.trim(); }).filter(Boolean)
  };
}

function listProducts() {
  const sheet = productSheet();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, PRODUITS_HEADERS.length)
    .getValues().filter(function (row) { return row[0]; }).map(productFromRow);
}

function isAdminTokenValid(token) {
  return token && CacheService.getScriptCache().get(token) === "admin";
}

function handleProductAction(data) {
  const action = data.action;
  if (action === "list") return { ok: true, products: listProducts() };
  if (action === "login") {
    const password = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
    if (!password || data.password !== password) return { ok: false, error: "Identifiants invalides." };
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(token, "admin", ADMIN_TOKEN_TTL_SECONDS);
    return { ok: true, token: token };
  }
  if (!isAdminTokenValid(data.token)) return { ok: false, error: "Session administrateur expirée." };
  const sheet = productSheet();
  if (action === "delete") {
    const id = String(data.id || "");
    const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === id) { sheet.deleteRow(i + 2); return { ok: true }; }
    }
    return { ok: false, error: "Produit introuvable." };
  }
  if (action === "save") {
    const product = data.product || {};
    const id = String(product.id || Utilities.getUuid());
    const row = [id, String(product.nom || ""), String(product.categorie || ""), Number(product.prix) || 0,
      String(product.description || ""), String(product.image || ""), Math.max(0, Number(product.stock) || 0),
      product.nouveau === true || product.nouveau === "true", Array.isArray(product.tailles) ? product.tailles.join(", ") : String(product.tailles || "")];
    const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) { sheet.getRange(i + 2, 1, 1, row.length).setValues([row]); return { ok: true, product: productFromRow(row) }; }
    }
    sheet.appendRow(row);
    return { ok: true, product: productFromRow(row) };
  }
  return { ok: false, error: "Action inconnue." };
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "list") return jsonResponse({ ok: true, products: listProducts() });
    return jsonResponse({ ok: false, error: "Action requise." });
  } catch (error) { return jsonResponse({ ok: false, error: error.toString() }); }
}

// ==============================================================================
// 2. RÉCEPTION ET TRAITEMENT DE LA COMMANDE (Méthode POST)
// ==============================================================================
function doPost(e) {
  try {
    let incoming = {};
    if (e && e.postData && e.postData.contents) incoming = JSON.parse(e.postData.contents);
    if (incoming.action) return jsonResponse(handleProductAction(incoming));
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName("Commandes");
    
    // Si l'onglet "Commandes" n'existe pas, on le crée ou on prend le premier
    if (!sheet) {
      sheet = spreadsheet.getActiveSheet();
      sheet.setName("Commandes");
    }

    // Création automatique de la ligne d'en-tête si la feuille est neuve
    if (sheet.getLastRow() === 0) {
      const headers = [
        "Date & Heure",
        "N° Commande",
        "Nom du Client",
        "Téléphone / WhatsApp",
        "E-mail",
        "Commune / Destination",
        "Adresse / Repère",
        "Formule Ivoire Livraison",
        "Frais Livraison",
        "Mode de Paiement",
        "Total Net (FCFA)",
        "Détail des Articles",
        "Instructions Client",
        "Statut de Livraison",
        "N° Course Ivoire Livraison"
      ];
      sheet.appendRow(headers);
      
      // Style luxueux et lisible pour la ligne d'en-tête
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#22201E");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    // Extraction des données transmises par le site
    let data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = incoming;
      } catch (err) {
        data = e.parameter || {};
      }
    } else {
      data = e.parameter || {};
    }

    // Formatage de la date en heure locale
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, "GMT", "dd/MM/yyyy HH:mm:ss");

    // Données de la commande
    const orderId = data.orderId || ("#CMD-" + Math.floor(1000 + Math.random() * 9000));
    const nom = data.nom || "Client";
    const telephone = data.telephone || "Non renseigné";
    const email = data.email || "";
    const commune = data.commune || "";
    const adresse = data.adresse || "";
    const delivery_mode = data.delivery_mode || "🚀 Ivoire Livraison Standard (24h)";
    const delivery_fee = data.delivery_fee || "1 500 FCFA";
    const paiement = data.paiement || "Paiement à la livraison";
    const total = data.total || "0 FCFA";
    const recapitulatif = data.recapitulatif || "";
    const note = data.note || "Aucune note particulière";
    const statut = "À expédier via Ivoire Livraison";
    const courseId = "En attente coursier";

    // 1. Écriture de la nouvelle ligne dans Google Sheets
    sheet.appendRow([
      formattedDate,
      orderId,
      nom,
      telephone,
      email,
      commune,
      adresse,
      delivery_mode,
      delivery_fee,
      paiement,
      total,
      recapitulatif,
      note,
      statut,
      courseId
    ]);

    // 2. Envoi de l'e-mail d'alerte pour vous et votre amie
    sendAdminNotification({
      date: formattedDate,
      orderId: orderId,
      nom: nom,
      telephone: telephone,
      email: email,
      commune: commune,
      adresse: adresse,
      delivery_mode: delivery_mode,
      delivery_fee: delivery_fee,
      paiement: paiement,
      total: total,
      recapitulatif: recapitulatif,
      note: note
    });

    // 3. Envoi de l'e-mail de confirmation au client s'il a renseigné son adresse
    if (email && email.indexOf("@") !== -1) {
      sendCustomerConfirmation({
        orderId: orderId,
        nom: nom,
        email: email,
        total: total,
        recapitulatif: recapitulatif,
        commune: commune,
        adresse: adresse
      });
    }

    // Réponse positive renvoyée au site
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Commande enregistrée avec succès",
      orderId: orderId 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// 3. MODÈLE D'E-MAIL ADMINISTRATEURS (Vous + Votre Amie)
// ==============================================================================
function sendAdminNotification(order) {
  // Filtre les adresses valides
  const recipients = NOTIFICATION_EMAILS.filter(function(mail) {
    return mail && mail.indexOf("@") !== -1 && !mail.includes("adresse_amie");
  }).join(",");

  if (!recipients) return;

  const subject = "🛎️ [Nouvelle Commande " + order.orderId + "] - " + order.nom + " (" + order.total + ")";

  const cleanPhone = order.telephone.replace(/[^0-9]/g, "");

  const htmlBody = 
    '<div style="font-family: \'Helvetica Neue\', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAF9F6; padding: 24px; border-radius: 8px; border: 1px solid #EAE6DF; color: #22201E;">' +
      '<div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #C4A47C;">' +
        '<h1 style="margin: 0; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; color: #22201E;">' + NOM_BOUTIQUE + '</h1>' +
        '<p style="margin: 4px 0 0; font-size: 13px; color: #736F6A;">Notification de Commande en Ligne</p>' +
      '</div>' +

      '<div style="background-color: #FFFFFF; border-radius: 6px; padding: 20px; margin-top: 20px; border: 1px solid #EAE6DF;">' +
        '<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #F0ECE1; padding-bottom: 12px; margin-bottom: 16px;">' +
          '<div>' +
            '<strong style="font-size: 16px; color: #C4A47C;">Commande : ' + order.orderId + '</strong>' +
            '<div style="font-size: 12px; color: #736F6A;">Reçue le ' + order.date + '</div>' +
          '</div>' +
          '<div style="text-align: right;">' +
            '<span style="font-size: 18px; font-weight: bold; color: #22201E;">' + order.total + '</span>' +
          '</div>' +
        '</div>' +

        '<h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #736F6A;">👤 Coordonnées du Client</h3>' +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Nom complet :</strong> ' + order.nom + '</p>' +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Téléphone / WhatsApp :</strong> <a href="tel:' + order.telephone + '" style="color: #128C7E; font-weight: bold; text-decoration: none;">' + order.telephone + '</a></p>' +
        (order.email ? '<p style="margin: 4px 0; font-size: 14px;"><strong>E-mail :</strong> <a href="mailto:' + order.email + '">' + order.email + '</a></p>' : '') +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Commune / Destination :</strong> ' + order.commune + '</p>' +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Adresse précise :</strong> ' + order.adresse + '</p>' +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Formule :</strong> ' + (order.delivery_mode || 'Standard') + ' (' + (order.delivery_fee || '1 500 FCFA') + ')</p>' +
        '<p style="margin: 4px 0; font-size: 14px;"><strong>Paiement choisi :</strong> ' + order.paiement + '</p>' +
        (order.note && order.note !== 'Aucune note particulière' ? '<p style="margin: 8px 0; font-size: 13px; background-color: #F8F5EE; padding: 10px; border-radius: 4px;"><strong>Note du client :</strong> ' + order.note + '</p>' : '') +

        '<div style="background-color: #F0F7FF; border-left: 4px solid #0284C7; padding: 10px 14px; margin: 14px 0; border-radius: 4px; font-size: 12px; color: #0369A1;">' +
          '<strong>📲 Course Ivoire Livraison :</strong> Copiez l\'adresse (' + order.adresse + ') et le numéro (' + order.telephone + ') directement dans votre application mobile Ivoire Livraison pour commander la course.' +
        '</div>' +

        '<h3 style="margin: 20px 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #736F6A; border-top: 1px solid #F0ECE1; padding-top: 16px;">🛍️ Pièces Commandées</h3>' +
        '<div style="background-color: #FAF9F6; border-radius: 6px; padding: 14px; font-size: 13px; line-height: 1.6; white-space: pre-line; border: 1px solid #EAE6DF;">' +
          order.recapitulatif +
        '</div>' +

        '<div style="margin-top: 24px; text-align: center;">' +
          '<a href="https://wa.me/' + cleanPhone + '?text=Bonjour%20' + encodeURIComponent(order.nom) + ',%20nous%20avons%20bien%20reçu%20votre%20commande%20' + order.orderId + '%20sur%20Maison%20AURA." ' +
             'style="display: inline-block; background-color: #128C7E; color: #FFFFFF; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">' +
            'Contacter le client sur WhatsApp' +
          '</a>' +
        '</div>' +
      '</div>' +

      '<div style="text-align: center; margin-top: 16px; font-size: 11px; color: #A09C96;">' +
        NOM_BOUTIQUE + ' · Système de commande synchronisé avec Google Sheets' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: recipients,
    subject: subject,
    htmlBody: htmlBody
  });
}

// ==============================================================================
// 4. CONFIRMATION E-MAIL AU CLIENT
// ==============================================================================
function sendCustomerConfirmation(order) {
  const subject = "Confirmation de votre commande " + order.orderId + " - " + NOM_BOUTIQUE;

  const htmlBody = 
    '<div style="font-family: \'Helvetica Neue\', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAF9F6; padding: 24px; border-radius: 8px; border: 1px solid #EAE6DF; color: #22201E;">' +
      '<div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #C4A47C;">' +
        '<h1 style="margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase; color: #22201E;">' + NOM_BOUTIQUE + '</h1>' +
        '<p style="margin: 6px 0 0; font-size: 13px; color: #736F6A;">L\'art du raffinement, de la mode & des parfums</p>' +
      '</div>' +

      '<div style="background-color: #FFFFFF; border-radius: 6px; padding: 24px; margin-top: 20px; border: 1px solid #EAE6DF;">' +
        '<h2 style="margin-top: 0; font-size: 18px; color: #22201E;">Merci pour votre commande, ' + order.nom + ' !</h2>' +
        '<p style="font-size: 14px; line-height: 1.6; color: #524E48;">' +
          'Nous vous confirmons l\'enregistrement de votre commande sous la référence <strong>' + order.orderId + '</strong>.<br>' +
          'Nos équipes préparent votre sélection avec soin.' +
        '</p>' +

        '<div style="background-color: #FAF9F6; border-radius: 6px; padding: 16px; margin: 20px 0; border: 1px solid #EAE6DF;">' +
          '<h4 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #736F6A;">Récapitulatif de votre panier :</h4>' +
          '<div style="font-size: 13px; line-height: 1.6; white-space: pre-line;">' + order.recapitulatif + '</div>' +
          '<div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #EAE6DF; font-size: 15px; font-weight: bold; text-align: right; color: #22201E;">' +
            'Total : ' + order.total +
          '</div>' +
        '</div>' +

        '<div style="border-left: 3px solid #C4A47C; padding-left: 12px; margin: 16px 0; font-size: 13px; color: #736F6A; line-height: 1.5;">' +
          '<strong>Lieu de livraison :</strong> ' + order.adresse + ', ' + order.commune + '.<br>' +
          'Notre livreur vous contactera par appel ou WhatsApp avant son passage pour convenir de l\'heure précise.' +
        '</div>' +

        '<p style="font-size: 13px; color: #736F6A; margin-top: 20px;">' +
          'Une question ? Répondez simplement à cet e-mail ou écrivez-nous sur WhatsApp au <strong>' + WHATSAPP_CONTACT + '</strong>.' +
        '</p>' +
      '</div>' +

      '<div style="text-align: center; margin-top: 16px; font-size: 11px; color: #A09C96;">' +
        NOM_BOUTIQUE + ' · Abidjan, Côte d\'Ivoire · Tous droits réservés.' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: order.email,
    subject: subject,
    htmlBody: htmlBody
  });
}
