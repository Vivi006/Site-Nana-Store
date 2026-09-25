/* Toutes les informations à personnaliser sont regroupées ici. */
const CONFIG = {
  nom: "Nana Store",
  googleSheetWebAppUrl: "[URL_DU_SCRIPT_APPS_SCRIPT]",
  catalogueEndpointUrl: "[URL_DU_SCRIPT_APPS_SCRIPT]",
  // Remplissez une fiche par associée. La première reçoit les liens WhatsApp principaux.
  collaboratrices: [
    { nom: "Associé 1", whatsapp: "+225 05 45 15 31 93" },
    { nom: "Associée 2", whatsapp: "+225 01 60 30 76 85" }
  ],
  livraison: { actif: true, texteAffiche: "1 500 à 2 000 FCFA selon votre commune", livraisonPayeePar: "client" },
  paiements: {
    livraison: { actif: true, libelle: "Paiement à la livraison (espèces)" },
    wave: { actif: true, numeroMarchand: "", nomMarchand: "Nana Fit", lienPaiement: "https://pay.wave.com/m/M_ci_qEs-NLannd7p/c/ci/", qrCode: "images/qr-wave.png", whatsapp: "+225 05 45 15 31 93" },
    orangeMoney: { actif: false, numero: "", nom: "" },
    mtnMoney: { actif: false, numero: "", nom: "" },
    moovMoney: { actif: false, numero: "", nom: "" }
  }
};

const state = { products: [], category: "tous", query: "", sort: "default", cart: loadCart(), selectedProduct: null, orderNumber: "", receiptOpened: false };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
const paymentLabels = { wave: "Wave", orangeMoney: "Orange Money", mtnMoney: "MTN Money", moovMoney: "Moov Money" };

function loadCart() { try { return JSON.parse(localStorage.getItem("nana-store-cart")) || []; } catch (error) { return []; } }
function saveCart() { localStorage.setItem("nana-store-cart", JSON.stringify(state.cart)); updateCart(); }
function phoneNumber() { return CONFIG.collaboratrices[0].whatsapp.replace(/[^\d]/g, ""); }
function whatsappUrl(message) { return `https://wa.me/${phoneNumber()}?text=${encodeURIComponent(message)}`; }
function personWhatsappUrl(person, message) { return `https://wa.me/${person.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`; }
function deliveryText() { return !CONFIG.livraison.actif ? "" : CONFIG.livraison.livraisonPayeePar === "boutique" ? "Livraison offerte 🎉" : `Livraison : ${CONFIG.livraison.texteAffiche} (à confirmer sur WhatsApp)`; }
function deliveryNote() { return CONFIG.livraison.livraisonPayeePar === "boutique" ? "Livraison offerte 🎉" : `Livraison ${CONFIG.livraison.texteAffiche} à confirmer par WhatsApp`; }
function cartTotal() { return state.cart.reduce((total, item) => total + item.prix * item.quantite, 0); }
function cartSummary() { return state.cart.map((item) => `${item.nom}${item.taille ? ` — taille ${item.taille}` : ""} x${item.quantite} = ${money(item.prix * item.quantite)}`).join("\n"); }
function googleSheetPayload(form, mode) {
  return {
    numero_commande: state.orderNumber,
    date: new Date().toISOString(),
    nom_client: form.elements.nom.value.trim(),
    telephone: form.elements.telephone.value.trim(),
    commune: form.elements.commune.value.trim(),
    adresse: form.elements.adresse.value.trim(),
    recapitulatif_commande: $("#order-summary").value,
    total: Number($("#order-total").value),
    mode_paiement: mode === "livraison" ? "Paiement à la livraison (espèces)" : paymentLabels[mode],
    statut_paiement: mode === "livraison" ? "À encaisser à la livraison" : "Payé - à vérifier",
    note_livraison: deliveryNote()
  };
}
function sendToGoogleSheet(payload) {
  const url = CONFIG.googleSheetWebAppUrl;
  if (!url || url.startsWith("[")) return;
  fetch(url, { method: "POST", mode: "no-cors", body: JSON.stringify(payload), keepalive: true }).catch(() => {
    // L'enregistrement Google Sheets est indépendant de la commande Netlify.
  });
}
function reconcileCart() {
  state.cart = state.cart
    .map((item) => {
      const product = state.products.find((candidate) => candidate.id === item.id);
      if (!product || product.disponibilite !== "en_stock") return null;
      const taille = product.tailles?.includes(item.taille) ? item.taille : "";
      return { id: product.id, nom: product.nom, prix: product.prix, quantite: Math.max(1, Math.min(20, Number.parseInt(item.quantite, 10) || 1)), taille };
    })
    .filter(Boolean);
  saveCart();
}

function renderCategories() {
  const labels = { tous: "Tous", accessoires: "Accessoires", parfums: "Parfums", vetements: "Vêtements", autres: "Autres" };
  $("#categories").innerHTML = Object.entries(labels).map(([key, label]) => `<button class="${state.category === key ? "active" : ""}" data-category="${key}" role="tab">${label}</button>`).join("");
  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; renderCategories(); renderProducts(); }));
}
function filteredProducts() {
  let products = state.products.filter((product) => (state.category === "tous" || product.categorie === state.category) && `${product.nom} ${product.description}`.toLowerCase().includes(state.query.toLowerCase()));
  if (state.sort === "asc") products.sort((a, b) => a.prix - b.prix);
  if (state.sort === "desc") products.sort((a, b) => b.prix - a.prix);
  return products;
}
function renderProducts() {
  const products = filteredProducts();
  $("#product-count").textContent = `${products.length} article${products.length > 1 ? "s" : ""}`;
  $("#product-grid").innerHTML = products.length ? products.map((product) => `<article class="product-card"><button class="product-open" data-product="${product.id}" aria-label="Voir ${product.nom}"><div class="product-image"><img src="${product.image}" alt="${product.nom}" loading="lazy">${product.nouveau ? '<span class="badge new">Nouveau</span>' : ""}${product.disponibilite !== "en_stock" ? '<span class="badge sold">Épuisé</span>' : ""}</div><div class="product-info"><p class="product-category">${product.categorie}</p><h3>${product.nom}</h3><strong>${product.prix ? money(product.prix) : "Bientôt disponible"}</strong></div></button><button class="quick-add" data-add="${product.id}" ${product.disponibilite !== "en_stock" ? "disabled" : ""}>${product.disponibilite === "en_stock" ? "Ajouter au panier" : "Indisponible"}</button></article>`).join("") : '<p class="empty">Aucun article ne correspond à votre recherche.</p>';
  document.querySelectorAll("[data-product]").forEach((button) => button.addEventListener("click", () => openProduct(button.dataset.product)));
  document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => {
    const product = state.products.find((item) => item.id === button.dataset.add);
    if (product?.tailles?.length) openProduct(product.id); else addToCart(button.dataset.add);
  }));
}
function openProduct(id) {
  const product = state.products.find((item) => item.id === id); if (!product) return;
  state.selectedProduct = product;
  $("#modal-content").innerHTML = `<div class="modal-product"><img src="${product.image}" alt="${product.nom}"><div><p class="eyebrow">${product.categorie}</p><h2 id="modal-title">${product.nom}</h2><p>${product.description}</p><strong class="modal-price">${money(product.prix)}</strong>${product.tailles ? `<label class="modal-field">Taille<select id="product-size">${product.tailles.map((size) => `<option>${size}</option>`).join("")}</select></label>` : ""}<label class="modal-field">Quantité<input id="product-quantity" type="number" min="1" max="20" value="1"></label><button class="button button-primary full" id="modal-add">Ajouter au panier</button></div></div>`;
  $("#product-modal").hidden = false; $("#modal-add").addEventListener("click", () => { addToCart(product.id, Number($("#product-quantity").value), $("#product-size")?.value || ""); closeModals(); });
}
function addToCart(id, quantity = 1, taille = "") {
  const product = state.products.find((item) => item.id === id); if (!product || product.disponibilite !== "en_stock") return;
  if (product.tailles?.length && !product.tailles.includes(taille)) { openProduct(id); return; }
  quantity = Math.max(1, Math.min(20, Number.parseInt(quantity, 10) || 1));
  const existing = state.cart.find((item) => item.id === id && item.taille === taille);
  if (existing) existing.quantite += quantity; else state.cart.push({ id, nom: product.nom, prix: product.prix, quantite: quantity, taille });
  saveCart(); openCart();
}
function updateCart() {
  const count = state.cart.reduce((total, item) => total + item.quantite, 0); $("#cart-count").textContent = count;
  $("#cart-total").textContent = money(cartTotal()); $("#delivery-note").textContent = CONFIG.livraison.actif ? deliveryText() : "";
  $("#cart-items").innerHTML = state.cart.length ? state.cart.map((item, index) => `<div class="cart-item"><div><strong>${item.nom}</strong><small>${item.taille ? `Taille ${item.taille} · ` : ""}${money(item.prix)}</small></div><div class="quantity"><button data-minus="${index}" aria-label="Diminuer">−</button><span>${item.quantite}</span><button data-plus="${index}" aria-label="Augmenter">+</button><button class="remove" data-remove="${index}" aria-label="Supprimer">×</button></div></div>`).join("") : '<p class="empty">Votre panier est encore vide ✧</p>';
  document.querySelectorAll("[data-minus]").forEach((button) => button.addEventListener("click", () => changeQuantity(Number(button.dataset.minus), -1)));
  document.querySelectorAll("[data-plus]").forEach((button) => button.addEventListener("click", () => changeQuantity(Number(button.dataset.plus), 1)));
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { state.cart.splice(Number(button.dataset.remove), 1); saveCart(); }));
}
function changeQuantity(index, delta) { state.cart[index].quantite += delta; if (state.cart[index].quantite < 1) state.cart.splice(index, 1); saveCart(); }
function openCart() { $("#cart-drawer").classList.add("open"); $("#cart-drawer").setAttribute("aria-hidden", "false"); }
function closeCart() { $("#cart-drawer").classList.remove("open"); $("#cart-drawer").setAttribute("aria-hidden", "true"); }
function closeModals() { document.querySelectorAll(".modal-backdrop").forEach((modal) => { modal.hidden = true; }); }
function orderId() { const date = new Date(), pad = (number) => String(number).padStart(2, "0"); return `CMD-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function renderPaymentOptions() {
  const configs = [["livraison", CONFIG.paiements.livraison], ["wave", CONFIG.paiements.wave], ["orangeMoney", CONFIG.paiements.orangeMoney], ["mtnMoney", CONFIG.paiements.mtnMoney], ["moovMoney", CONFIG.paiements.moovMoney]];
  $("#payment-options").innerHTML = configs.filter(([, config]) => config.actif).map(([key, config], index) => `<label class="radio-option"><input type="radio" name="paiement_choice" value="${key}" ${index === 0 ? "checked" : ""}><span>${key === "livraison" ? config.libelle : paymentLabels[key]}</span></label>`).join("");
  document.querySelectorAll("[name=paiement_choice]").forEach((radio) => radio.addEventListener("change", () => { state.receiptOpened = false; renderMobileFields(); })); renderMobileFields();
}
function renderMobileFields() {
  const mode = document.querySelector("[name=paiement_choice]:checked")?.value, mobile = mode && mode !== "livraison";
  $("#mobile-payment-fields").hidden = !mobile; if (!mobile) { $("#mobile-payment-fields").innerHTML = ""; return; }
  const config = CONFIG.paiements[mode]; const details = mode === "wave" ? [config.nomMarchand, config.numeroMarchand].filter(Boolean).join(" · ") : `${config.nom} · ${config.numero}`;
  const receiptMessage = `Bonjour Nana Store, voici le reçu de paiement de la commande ${state.orderNumber}.\n\n${cartSummary()}\nTotal : ${money(cartTotal())}`;
  const receiptUrl = `https://wa.me/${(config.whatsapp || CONFIG.collaboratrices[0].whatsapp).replace(/[^\d]/g, "")}?text=${encodeURIComponent(receiptMessage)}`;
  $("#mobile-payment-fields").innerHTML = `<div class="mobile-payment-card"><div class="mobile-payment-top"><div><span class="payment-kicker">Paiement mobile</span><h3>${paymentLabels[mode]}</h3></div><span class="payment-lock">🔒</span></div><div class="payment-amount"><span>Montant des articles</span><strong>${money(cartTotal())}</strong><small>Hors frais de livraison</small></div><div class="merchant-details"><div><span>Compte marchand</span><strong>${details}</strong></div>${mode === "wave" && config.lienPaiement ? `<a class="copy-button pay-link" href="${config.lienPaiement}" target="_blank" rel="noopener">Payer avec Wave</a>` : `<button type="button" class="copy-button" data-copy="${config.numero}">Copier le numéro</button>`}</div>${mode === "wave" && config.qrCode ? `<div class="qr-wrap"><img class="qr" src="${config.qrCode}" alt="QR code Wave" onerror="this.hidden=true"><span>Scannez avec Wave si vous le souhaitez</span></div>` : ""}<p class="payment-help">Après le paiement, l'envoi du reçu sur WhatsApp est obligatoire pour valider votre commande.</p><a class="button button-primary full receipt-button" id="send-receipt" href="${receiptUrl}" target="_blank" rel="noopener">Envoyer le reçu de paiement sur WhatsApp</a></div>`;
  $("#send-receipt").addEventListener("click", () => {
    state.receiptOpened = true;
    $("#send-receipt").classList.add("receipt-sent");
    $("#send-receipt").textContent = "Reçu envoyé sur WhatsApp ✓";
  });
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => { await navigator.clipboard?.writeText(button.dataset.copy); button.textContent = "Copié !"; }));
}
function startCheckout() {
  if (!state.cart.length) return; closeCart(); $("#checkout-view").hidden = false; $("#success-view").hidden = true; $("#order-form").reset(); $("#form-message").textContent = ""; $("#submit-order").disabled = false; $("#submit-order").textContent = "Confirmer ma commande"; state.orderNumber = orderId(); state.receiptOpened = false; $("#order-number").value = state.orderNumber; $("#order-summary").value = cartSummary(); $("#order-total").value = cartTotal(); $("#payment-mode").value = ""; $("#delivery-note-field").value = deliveryNote(); $("#checkout-summary").innerHTML = `<div><span>Votre sélection</span><strong>${state.cart.reduce((total, item) => total + item.quantite, 0)} article(s)</strong></div><p>${cartSummary().replace(/\n/g, "<br>")}</p><b>Total articles : ${money(cartTotal())}</b>`; renderPaymentOptions(); $("#checkout-modal").hidden = false;
}
function showSuccess() { const message = `Bonjour Nana Store ! Je viens de passer la commande ${state.orderNumber}.\n\n${cartSummary()}\nTotal articles : ${money(Number($("#order-total").value))}\n\nLe montant exact de la livraison sera confirmé avec moi par WhatsApp avant l'envoi du colis.`; $("#checkout-view").hidden = true; $("#success-view").hidden = false; $("#success-view").innerHTML = `<div class="success"><div class="success-icon">✓</div><h2>Merci !</h2><p>Votre commande <b>${state.orderNumber}</b> est enregistrée. Nous vous contactons très vite sur WhatsApp pour confirmer votre adresse et les frais de livraison.</p><a class="button button-primary full" href="${whatsappUrl(message)}" target="_blank" rel="noopener">Nous écrire sur WhatsApp</a></div>`; state.cart = []; saveCart(); }
async function submitOrder(event) {
  event.preventDefault(); const form = event.currentTarget, phone = $("#phone").value.replace(/[^\d+]/g, ""); if (phone.replace(/\D/g, "").length < 8) { $("#form-message").textContent = "Veuillez saisir un numéro de téléphone valide."; return; }
  const mode = document.querySelector("[name=paiement_choice]:checked")?.value; if (!mode) { $("#form-message").textContent = "Veuillez choisir un mode de paiement."; return; } if (mode !== "livraison" && !state.receiptOpened) { $("#form-message").textContent = "Veuillez d'abord envoyer le reçu de paiement sur WhatsApp."; $("#send-receipt")?.focus(); return; } $("#payment-mode").value = mode; const file = form.querySelector("[name=capture]")?.files[0]; if (file && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) { $("#form-message").textContent = "La capture doit être une image de 5 Mo maximum."; return; }
  sendToGoogleSheet(googleSheetPayload(form, mode));
  $("#order-summary").value = cartSummary();
  const button = $("#submit-order"); button.disabled = true; button.textContent = "Envoi en cours…"; $("#form-message").textContent = "";
  try { const response = await fetch("/", { method: "POST", body: new FormData(form) }); if (!response.ok) throw new Error("Netlify Forms"); showSuccess(); } catch (error) { $("#form-message").innerHTML = `L'envoi automatique a échoué. <a href="${whatsappUrl(`Bonjour Nana Store, je souhaite commander ${state.orderNumber}.\n\n${cartSummary()}`)}" target="_blank" rel="noopener">Commander par WhatsApp</a>`; button.disabled = false; button.textContent = "Réessayer"; }
}
async function init() {
  const year = $("#year"); if (year) year.textContent = new Date().getFullYear();
  const contactWhatsapp = $("#contact-whatsapp"); if (contactWhatsapp) contactWhatsapp.href = whatsappUrl("Bonjour Nana Store, j'aimerais avoir un renseignement.");
  const floatingWhatsapp = $("#floating-whatsapp"); if (floatingWhatsapp) floatingWhatsapp.href = whatsappUrl("Bonjour Nana Store, j'aimerais avoir un renseignement.");
  const contactPeople = $("#top-contact-people");
  if (contactPeople) contactPeople.innerHTML = CONFIG.collaboratrices.map((person) => {
    const phone = person.whatsapp.replace(/[^\d+]/g, "");
    return `<article class="top-contact-card"><strong>${person.nom}</strong><div><a class="contact-action contact-action-whatsapp" href="${personWhatsappUrl(person, `Bonjour ${person.nom}, j'aimerais avoir un renseignement.`)}" target="_blank" rel="noopener">💬 WhatsApp</a><a class="contact-action contact-action-call" href="tel:${phone}">☎ Appeler</a></div></article>`;
  }).join("");
  if (!$("#product-grid")) return;
  try {
    let products = null;
    const endpoint = CONFIG.catalogueEndpointUrl;
    if (endpoint && !endpoint.startsWith("[")) {
      const response = await fetch(`${endpoint}?action=list`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload.ok && Array.isArray(payload.products)) products = payload.products;
      }
    }
    if (!products) {
      const response = await fetch("products.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Catalogue introuvable");
      products = await response.json();
    }
    state.products = products.map((product) => ({
      ...product,
      stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : (product.disponibilite === "en_stock" ? 1 : 0),
      disponibilite: Number(product.stock) > 0 || (!("stock" in product) && product.disponibilite === "en_stock") ? "en_stock" : "epuise"
    }));
    reconcileCart(); renderCategories(); renderProducts(); updateCart();
  } catch (error) { $("#product-grid").innerHTML = '<p class="empty">Le catalogue est momentanément indisponible. Réessayez dans un instant.</p>'; }
  $("#search").addEventListener("input", (event) => { state.query = event.target.value; renderProducts(); }); $("#sort").addEventListener("change", (event) => { state.sort = event.target.value; renderProducts(); }); $("#open-cart").addEventListener("click", openCart); $("#close-cart").addEventListener("click", closeCart); $("#continue-shopping").addEventListener("click", closeCart); $("#checkout-button").addEventListener("click", startCheckout); $("#order-form").addEventListener("submit", submitOrder); document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeModals)); document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModals(); }));
}
init();
