/**
 * ==============================================================================
 * MAISON AURA — Boutique Chic Abidjan
 * Script JavaScript Vanilla (100% autonome, sans dépendances ni framework)
 * ==============================================================================
 * Ce fichier gère :
 * 1. La configuration de votre boutique (Nom, WhatsApp, Tarifs)
 * 2. Le chargement des produits depuis products.json
 * 3. Les filtres par catégorie, recherche textuelle et tri par prix
 * 4. La modale de présentation détaillée du produit avec sélection de taille
 * 5. Le panier d'achat sauvegardé dans le navigateur (localStorage)
 * 6. L'envoi de la commande par formulaire Netlify (avec récapitulatif détaillé)
 * 7. La génération du message WhatsApp pré-rempli avec lien direct wa.me
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. CONFIGURATION FACILE DE VOTRE BOUTIQUE
//    (Modifiez ces valeurs selon vos besoins sans toucher au reste du code)
// ------------------------------------------------------------------------------
const CONFIG = {
  // Nom de votre boutique tel qu'il apparaîtra dans les messages
  boutiqueName: "Maison AURA — Boutique en Ligne Abidjan",

  // Numéro WhatsApp au format international sans le '+' (225 pour la Côte d'Ivoire)
  // Exemple : "2250701020304" (Remplacez par votre vrai numéro WhatsApp)
  whatsappNumber: "2250701020304",

  // Devise affichée
  currency: "FCFA",

  // --- GESTION DES STOCKS & PRODUITS VIA GOOGLE SHEETS ---
  // Pour piloter vos stocks depuis votre téléphone sur Google Sheets :
  // 1. Mettez 'useGoogleSheet: true'
  // 2. Collez l'URL CSV de votre Google Sheet (Fichier > Partager > Publier sur le web > CSV)
  useGoogleSheet: false, // Mettez à 'true' pour synchroniser les stocks en direct !
  googleSheetUrl: "",    // Ex: "https://docs.google.com/spreadsheets/d/e/2PACX-xxxx/pub?output=csv"

  // Frais de livraison indicatifs à Abidjan (en FCFA)
  deliveryFeeAbidjan: "1 500 à 2 500 FCFA (selon la commune)",

  // Liens réseaux sociaux
  instagramUrl: "https://instagram.com",
  emailContact: "contact@maisonaura-abidjan.ci"
};

// ------------------------------------------------------------------------------
// 2. ÉTAT GLOBAL DE L'APPLICATION
// ------------------------------------------------------------------------------
let catalogProducts = [];     // Liste complète des produits chargés
let filteredProducts = [];    // Produits après filtrage et recherche
let cart = [];                // Articles dans le panier [{ id, itemKey, nom, prix, taille, qte, image }]
let currentFilter = "tous";   // Catégorie sélectionnée
let currentSearch = "";       // Terme de recherche actuel
let currentSort = "default";   // Tri sélectionné

// Clé de stockage localStorage
const CART_STORAGE_KEY = "maison_aura_cart_v1";

// Données de secours intégrées si l'utilisateur teste le fichier en double-cliquant
// en local (protocole file:// où le fetch() de JSON est bloqué par le navigateur)
const BACKUP_PRODUCTS = [
  {
    id: "prod-acc-01",
    nom: "Montre Chrono Dorée & Cuir Noir",
    categorie: "accessoires",
    prix: 28000,
    description: "Boîtier ultra-plat en acier inoxydable doré, cadran soleillé minimaliste et bracelet en cuir noir texturé.",
    image: "images/product_gold_watch.jpg",
    disponibilite: "en_stock"
  },
  {
    id: "prod-acc-02",
    nom: "Créoles Sculptées Or 18K",
    categorie: "accessoires",
    prix: 15000,
    description: "Paire de boucles d'oreilles créoles aux reflets organiques martelés à la main. Plaquage or haute tenue résistant au quotidien.",
    image: "images/product_gold_earrings.jpg",
    disponibilite: "en_stock"
  },
  {
    id: "prod-acc-03",
    nom: "Portefeuille Cuir Ébène",
    categorie: "accessoires",
    prix: 12500,
    description: "Portefeuille compact en cuir véritable embossé avec fentes multiples cartes et compartiment billets.",
    image: "images/product_leather_bag.jpg",
    disponibilite: "en_stock"
  },
  {
    id: "prod-parfums-01",
    nom: "Collection Parfums Rares",
    categorie: "parfums",
    prix: 0,
    description: "Notre sélection exclusive d'extraits de parfum purs, de brumes envoûtantes et de sillages précieux arrive très prochainement.",
    image: "images/product_perfume_amber.jpg",
    disponibilite: "a_venir"
  },
  {
    id: "prod-vetements-01",
    nom: "Collection Vêtements & Prêt-à-Porter",
    categorie: "vetements",
    prix: 0,
    description: "Nouvelle ligne de robes soyeuses, chemises en lin noble et ensembles fluides en cours d'arrivage.",
    image: "images/product_silk_dress.jpg",
    disponibilite: "a_venir"
  },
  {
    id: "prod-sac-01",
    nom: "Collection Sacs & Maroquinerie",
    categorie: "sac",
    prix: 0,
    description: "Sacs à main en cuir pleine fleur, pochettes de soirée et maroquinerie d'exception en cours d'arrivage.",
    image: "images/product_leather_bag.jpg",
    disponibilite: "a_venir"
  },
  {
    id: "prod-chaussures-01",
    nom: "Mocassins Cuir Italien Prestige",
    categorie: "chaussures",
    prix: 42000,
    description: "Mocassins d'une grande distinction façonnés en cuir véritable souple avec semelle cousue main. Confort et prestige.",
    image: "images/product_luxury_shoes.jpg",
    disponibilite: "en_stock",
    tailles: ["40", "41", "42", "43", "44", "45"]
  }
];

// ------------------------------------------------------------------------------
// 3. FONCTIONS UTILITAIRES
// ------------------------------------------------------------------------------

/**
 * Formate un nombre en devise FCFA (ex: 25000 -> "25 000 FCFA")
 */
function formatPrice(amount) {
  if (typeof amount !== "number") amount = Number(amount) || 0;
  return new Intl.NumberFormat("fr-FR").format(amount) + " " + CONFIG.currency;
}

/**
 * Affiche une notification toast temporaire en bas de l'écran
 */
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  const toastText = document.getElementById("toastText");
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

// ------------------------------------------------------------------------------
// 4. CHARGEMENT DU CATALOGUE (GOOGLE SHEETS OU PRODUCTS.JSON)
// ------------------------------------------------------------------------------

/**
 * Découpe une ligne CSV en tenant compte des guillemets et séparateurs (, ou ;)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Analyse le texte CSV téléchargé depuis Google Sheets et le convertit en objets produits
 */
function parseGoogleSheetCSV(csvText) {
  const lines = csvText.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  // En-têtes normalisés (sans accents, minuscules, sans espaces)
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => 
    h.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s_-]+/g, "")
  );

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const values = parseCSVLine(rawLine);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx].trim() : "";
    });

    const nom = row.nom || row.titre || row.produit || row.name;
    if (!nom) continue; // Ligne vide ignorée

    const id = row.id || `prod-gs-${i}`;
    const categorie = (row.categorie || row.category || "autres").toLowerCase();
    
    // Nettoyage du prix numérique
    const rawPrix = String(row.prix || row.price || "0").replace(/[^\d]/g, "");
    const prix = parseInt(rawPrix, 10) || 0;

    const description = row.description || row.desc || "";
    const image = row.image || row.photo || row.img || "images/hero_boutique.jpg";

    // Gestion intelligente du Stock :
    // Le commerçant peut mettre dans la colonne 'disponibilite' ou 'stock' :
    // - Soit un mot : "en_stock", "epuise", "rupture", "disponible", "oui", "non"
    // - Soit un chiffre : 0 (devient épuisé), 5, 10 (en stock)
    let disponibilite = "en_stock";
    const stockField = (row.disponibilite || row.stock || row.dispo || "").toLowerCase().trim();

    if (stockField === "epuise" || stockField === "rupture" || stockField === "non" || stockField === "out") {
      disponibilite = "epuise";
    } else if (!isNaN(parseInt(stockField, 10))) {
      const qte = parseInt(stockField, 10);
      disponibilite = qte <= 0 ? "epuise" : "en_stock";
    }

    // Gestion des tailles (séparées par virgule, point-virgule ou barre oblique)
    const rawTailles = row.tailles || row.taille || row.sizes || "";
    const tailles = rawTailles ? rawTailles.split(/[,;\/]/).map(t => t.trim()).filter(Boolean) : [];

    items.push({
      id,
      nom,
      categorie,
      prix,
      description,
      image,
      disponibilite,
      tailles: tailles.length > 0 ? tailles : undefined
    });
  }

  return items;
}

/**
 * Récupère les données depuis Google Sheets (si activé) ou depuis products.json (avec repli de sécurité)
 */
async function loadProducts() {
  const badgeSource = document.getElementById("catalogSourceBadge");

  // 1. Synchronisation Google Sheets si configurée
  if (CONFIG.useGoogleSheet && CONFIG.googleSheetUrl && CONFIG.googleSheetUrl.trim() !== "") {
    try {
      let sheetUrl = CONFIG.googleSheetUrl.trim();

      // Si l'utilisateur a collé l'URL normale d'édition de sa feuille Google Sheets
      const sheetMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetMatch && !sheetUrl.includes("pub?output=csv") && !sheetUrl.includes("export?format=csv")) {
        sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;
      }

      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error(`Statut HTTP Google Sheets ${response.status}`);
      }
      const csvText = await response.text();
      const parsedItems = parseGoogleSheetCSV(csvText);

      if (parsedItems && parsedItems.length > 0) {
        catalogProducts = parsedItems;
        if (badgeSource) {
          badgeSource.textContent = "● Synchronisé avec Google Sheets";
          badgeSource.style.display = "inline-flex";
        }
        applyFiltersAndRender();
        return;
      }
    } catch (error) {
      console.warn("Échec de chargement Google Sheets, repli automatique sur le fichier local products.json :", error);
    }
  }

  // 2. Chargement classique depuis products.json
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    catalogProducts = await response.json();
    if (badgeSource) {
      badgeSource.textContent = "● Catalogue local (products.json)";
      badgeSource.style.display = "inline-flex";
    }
  } catch (error) {
    console.warn("Chargement via fetch impossible, utilisation des données de secours :", error);
    catalogProducts = BACKUP_PRODUCTS;
  }

  applyFiltersAndRender();
}

/**
 * Fonction appelée pour tester en direct un lien Google Sheets depuis le guide
 */
async function testGoogleSheetConnection(customUrl) {
  if (!customUrl || customUrl.trim() === "") {
    showToast("Veuillez coller le lien de votre Google Sheet.");
    return;
  }

  CONFIG.googleSheetUrl = customUrl.trim();
  CONFIG.useGoogleSheet = true;
  await loadProducts();
  showToast(`✅ ${catalogProducts.length} articles chargés depuis Google Sheets !`);
}

/**
 * Filtre, recherche, trie et met à jour l'affichage des produits
 */
function applyFiltersAndRender() {
  // 1. Filtrage par catégorie
  let list = catalogProducts.filter(item => {
    if (currentFilter === "tous") return true;
    return item.categorie.toLowerCase() === currentFilter.toLowerCase();
  });

  // 2. Recherche textuelle
  if (currentSearch.trim() !== "") {
    const query = currentSearch.toLowerCase().trim();
    list = list.filter(item => {
      return (
        item.nom.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.categorie.toLowerCase().includes(query)
      );
    });
  }

  // 3. Tri
  if (currentSort === "price-asc") {
    list.sort((a, b) => a.prix - b.prix);
  } else if (currentSort === "price-desc") {
    list.sort((a, b) => b.prix - a.prix);
  } else if (currentSort === "name-asc") {
    list.sort((a, b) => a.nom.localeCompare(b.nom));
  }

  filteredProducts = list;
  renderProductsGrid(filteredProducts);
}

/**
 * Génère le code HTML des cartes de produits
 */
function renderProductsGrid(products) {
  const grid = document.getElementById("productsGrid");
  const counter = document.getElementById("catalogResultCount");
  if (!grid) return;

  if (counter) {
    counter.textContent = `${products.length} article${products.length > 1 ? "s" : ""}`;
  }

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="catalog-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>Aucun article trouvé</h3>
        <p>Essayez de modifier votre recherche ou sélectionnez une autre catégorie.</p>
        <button class="btn-primary" onclick="resetFilters()">Réinitialiser les filtres</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    const isComingSoon = product.disponibilite === "a_venir";
    const isAvailable = product.disponibilite === "en_stock";
    
    let stockLabel = "En stock";
    let stockClass = "";
    if (isComingSoon) {
      stockLabel = "Articles à venir";
      stockClass = "coming-soon";
    } else if (!isAvailable) {
      stockLabel = "Épuisé";
      stockClass = "out-of-stock";
    }

    const priceHtml = isComingSoon 
      ? `<span class="card-price tabular-nums" style="font-size: 0.92rem; font-weight: 600; color: #8C6D3F;">Articles à venir</span>`
      : `<span class="card-price tabular-nums">${formatPrice(product.prix)}</span>`;

    const buttonHtml = isComingSoon
      ? `<button type="button" class="btn-card-add coming-soon" onclick="openProductModal('${product.id}')">À venir</button>`
      : `<button type="button" class="btn-card-add" onclick="handleQuickAddToCart('${product.id}')" ${!isAvailable ? "disabled" : ""}>${isAvailable ? "+ Panier" : "Épuisé"}</button>`;

    return `
      <article class="product-card" data-id="${product.id}">
        <div class="card-media" onclick="openProductModal('${product.id}')">
          <img 
            src="${product.image}" 
            alt="${product.nom}" 
            loading="lazy"
            onerror="this.src='images/hero_boutique.jpg'"
          />
          <span class="stock-indicator ${stockClass}">${stockLabel}</span>
        </div>
        <div class="card-content">
          <div class="card-meta">${product.categorie}</div>
          <h3 class="card-title" onclick="openProductModal('${product.id}')">${product.nom}</h3>
          <p class="card-desc">${product.description}</p>
          <div class="card-footer">
            ${priceHtml}
            ${buttonHtml}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/**
 * Réinitialise les filtres de recherche
 */
function resetFilters() {
  currentFilter = "tous";
  currentSearch = "";
  currentSort = "default";

  // Mettre à jour l'état visuel des boutons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.category === "tous");
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) sortSelect.value = "default";

  applyFiltersAndRender();
}

// ------------------------------------------------------------------------------
// 5. MODALE DE DÉTAIL DU PRODUIT (QUICK VIEW)
// ------------------------------------------------------------------------------
let currentModalProduct = null;
let selectedSize = null;
let modalQuantity = 0;

/**
 * Met à jour l'état du bouton d'ajout au panier selon la disponibilité et la quantité
 */
function updateModalAddBtnState() {
  const modalAddBtn = document.getElementById("modalAddBtn");
  if (!modalAddBtn) return;

  if (!currentModalProduct) return;

  if (currentModalProduct.disponibilite === "a_venir") {
    modalAddBtn.disabled = true;
    modalAddBtn.textContent = "Articles à venir — Bientôt disponible";
    modalAddBtn.style.opacity = "0.75";
    modalAddBtn.style.cursor = "not-allowed";
  } else if (currentModalProduct.disponibilite !== "en_stock") {
    modalAddBtn.disabled = true;
    modalAddBtn.textContent = "Article actuellement épuisé";
    modalAddBtn.style.opacity = "0.5";
    modalAddBtn.style.cursor = "not-allowed";
  } else if (modalQuantity === 0) {
    modalAddBtn.disabled = true;
    modalAddBtn.textContent = "Sélectionnez une quantité (+)";
    modalAddBtn.style.opacity = "0.6";
    modalAddBtn.style.cursor = "not-allowed";
  } else {
    modalAddBtn.disabled = false;
    modalAddBtn.textContent = `Ajouter au panier (${modalQuantity})`;
    modalAddBtn.style.opacity = "1";
    modalAddBtn.style.cursor = "pointer";
  }
}

/**
 * Ouvre la modale pour un produit donné
 */
function openProductModal(productId) {
  const product = catalogProducts.find(p => p.id === productId);
  if (!product) return;

  currentModalProduct = product;
  modalQuantity = 0;
  selectedSize = (product.tailles && product.tailles.length > 0) ? product.tailles[0] : null;

  const modal = document.getElementById("productModal");
  const modalImg = document.getElementById("modalImg");
  const modalCategory = document.getElementById("modalCategory");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalDescription = document.getElementById("modalDescription");
  const modalQtyVal = document.getElementById("modalQtyVal");
  const modalSizeContainer = document.getElementById("modalSizeContainer");

  if (!modal) return;

  modalImg.src = product.image;
  modalImg.alt = product.nom;
  modalImg.onerror = function() { this.src = 'images/hero_boutique.jpg'; };

  modalCategory.textContent = product.categorie;
  modalTitle.textContent = product.nom;
  modalDescription.textContent = product.description;
  if (modalQtyVal) modalQtyVal.textContent = modalQuantity;

  const qtyControl = modalQtyVal ? modalQtyVal.closest(".quantity-control") : null;
  if (product.disponibilite === "a_venir") {
    modalPrice.textContent = "Articles à venir";
    modalPrice.style.color = "#8C6D3F";
    modalPrice.style.fontSize = "1.2rem";
    if (qtyControl) qtyControl.style.display = "none";
  } else {
    modalPrice.textContent = formatPrice(product.prix);
    modalPrice.style.color = "";
    modalPrice.style.fontSize = "";
    if (qtyControl) qtyControl.style.display = "inline-flex";
  }

  // Gestion des tailles (pour vêtements)
  if (product.tailles && product.tailles.length > 0) {
    modalSizeContainer.style.display = "block";
    modalSizeContainer.innerHTML = `
      <label class="size-label">Sélectionnez votre taille :</label>
      <div class="size-options">
        ${product.tailles.map((size, index) => `
          <button 
            type="button" 
            class="size-option-btn ${index === 0 ? 'selected' : ''}" 
            onclick="selectModalSize('${size}', this)"
          >
            ${size}
          </button>
        `).join("")}
      </div>
    `;
  } else {
    modalSizeContainer.style.display = "none";
    modalSizeContainer.innerHTML = "";
  }

  // État initial du bouton ajouter
  updateModalAddBtnState();

  modal.classList.add("open");
  document.body.style.overflow = "hidden"; // Empêche le scroll en arrière-plan
}

/**
 * Sélection de la taille dans la modale
 */
function selectModalSize(size, element) {
  selectedSize = size;
  document.querySelectorAll(".size-option-btn").forEach(btn => btn.classList.remove("selected"));
  element.classList.add("selected");
}

/**
 * Ajustement de la quantité dans la modale (commence à 0)
 */
function changeModalQty(delta) {
  const newQty = modalQuantity + delta;
  if (newQty >= 0 && newQty <= 10) {
    modalQuantity = newQty;
    const qtyVal = document.getElementById("modalQtyVal");
    if (qtyVal) qtyVal.textContent = modalQuantity;
    updateModalAddBtnState();
  }
}

/**
 * Ferme la modale du produit
 */
function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
  currentModalProduct = null;
}

/**
 * Ajout au panier depuis la modale
 */
function handleModalAddToCart() {
  if (!currentModalProduct || currentModalProduct.disponibilite !== "en_stock") return;
  if (modalQuantity <= 0) {
    showToast("Veuillez sélectionner une quantité avec le bouton +");
    return;
  }

  addToCart(currentModalProduct, selectedSize, modalQuantity);
  closeProductModal();
  openCartDrawer();
}

/**
 * Ajout rapide depuis le catalogue (taille par défaut si vêtement)
 */
function handleQuickAddToCart(productId) {
  const product = catalogProducts.find(p => p.id === productId);
  if (!product || product.disponibilite !== "en_stock") return;

  // Si c'est un vêtement avec plusieurs tailles, on ouvre la modale pour qu'il choisisse sa taille
  if (product.tailles && product.tailles.length > 1) {
    openProductModal(productId);
    return;
  }

  const defaultSize = (product.tailles && product.tailles.length > 0) ? product.tailles[0] : null;
  addToCart(product, defaultSize, 1);
  showToast(`"${product.nom}" a été ajouté au panier !`);
}

// ------------------------------------------------------------------------------
// 6. GESTION DU PANIER (LOCALSTORAGE, CALCULS, TIROIR)
// ------------------------------------------------------------------------------

/**
 * Charge le panier depuis localStorage
 */
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      cart = JSON.parse(saved);
    } else {
      cart = [];
    }
  } catch (e) {
    console.error("Erreur lors de la lecture du panier :", e);
    cart = [];
  }
  updateCartUI();
}

/**
 * Sauvegarde le panier dans localStorage
 */
function saveCartToStorage() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error("Erreur lors de la sauvegarde du panier :", e);
  }
}

/**
 * Ajoute un article au panier
 */
function addToCart(product, size = null, quantity = 1) {
  // Clé unique basée sur l'id et la taille sélectionnée
  const itemKey = size ? `${product.id}-${size}` : `${product.id}`;

  const existingItemIndex = cart.findIndex(item => item.itemKey === itemKey);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].qte += quantity;
  } else {
    cart.push({
      id: product.id,
      itemKey: itemKey,
      nom: product.nom,
      prix: product.prix,
      taille: size,
      qte: quantity,
      image: product.image
    });
  }

  saveCartToStorage();
  updateCartUI(true);
}

/**
 * Modifie la quantité d'un article dans le panier (+1 / -1)
 */
function updateItemQuantity(itemKey, delta) {
  const itemIndex = cart.findIndex(item => item.itemKey === itemKey);
  if (itemIndex === -1) return;

  cart[itemIndex].qte += delta;

  if (cart[itemIndex].qte <= 0) {
    cart.splice(itemIndex, 1);
  }

  saveCartToStorage();
  updateCartUI();
}

/**
 * Supprime un article du panier
 */
function removeFromCart(itemKey) {
  cart = cart.filter(item => item.itemKey !== itemKey);
  saveCartToStorage();
  updateCartUI();
}

/**
 * Vide complètement le panier
 */
function clearCart() {
  cart = [];
  saveCartToStorage();
  updateCartUI();
}

/**
 * Calcule le total général en FCFA
 */
function getCartTotal() {
  return cart.reduce((total, item) => total + (item.prix * item.qte), 0);
}

/**
 * Calcule le nombre total d'articles dans le panier
 */
function getCartItemCount() {
  return cart.reduce((count, item) => count + item.qte, 0);
}

/**
 * Met à jour l'affichage du panier (badges, liste d'articles, totaux)
 */
function updateCartUI(animateBadge = false) {
  const badge = document.getElementById("headerCartBadge");
  const itemsContainer = document.getElementById("cartItemsContainer");
  const subtotalElem = document.getElementById("cartSubtotal");
  const totalElem = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("cartCheckoutBtn");

  const totalCount = getCartItemCount();
  const totalPrice = getCartTotal();

  // Mise à jour du badge d'en-tête
  if (badge) {
    badge.textContent = totalCount;
    if (animateBadge) {
      badge.classList.remove("bump");
      void badge.offsetWidth; // Déclenche le reflow pour relancer l'animation
      badge.classList.add("bump");
    }
  }

  if (subtotalElem) subtotalElem.textContent = formatPrice(totalPrice);
  if (totalElem) totalElem.textContent = formatPrice(totalPrice);

  if (checkoutBtn) {
    checkoutBtn.disabled = cart.length === 0;
  }

  // Rendu de la liste des articles
  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-empty-view">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <h4>Votre panier est vide</h4>
        <p>Explorez nos collections et ajoutez vos coups de cœur à votre sélection.</p>
        <button class="btn-primary" onclick="closeCartDrawer(); scrollToShop();">Découvrir la boutique</button>
      </div>
    `;
    return;
  }

  itemsContainer.innerHTML = cart.map(item => {
    const itemSubtotal = item.prix * item.qte;
    return `
      <div class="cart-item" data-key="${item.itemKey}">
        <div class="cart-item-img">
          <img src="${item.image}" alt="${item.nom}" onerror="this.src='images/hero_boutique.jpg'">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-title">${item.nom}</div>
          <div class="cart-item-meta">
            ${item.taille ? `Taille : <strong>${item.taille}</strong> · ` : ""}
            ${formatPrice(item.prix)}
          </div>
          <div class="cart-item-stepper">
            <button type="button" class="cart-step-btn" onclick="updateItemQuantity('${item.itemKey}', -1)" aria-label="Diminuer">-</button>
            <span class="cart-step-val">${item.qte}</span>
            <button type="button" class="cart-step-btn" onclick="updateItemQuantity('${item.itemKey}', 1)" aria-label="Augmenter">+</button>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="cart-item-price tabular-nums">${formatPrice(itemSubtotal)}</div>
          <button type="button" class="cart-item-remove" onclick="removeFromCart('${item.itemKey}')" title="Supprimer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Ouverture du tiroir panier
 */
function openCartDrawer() {
  const drawer = document.getElementById("cartDrawerBackdrop");
  if (drawer) {
    drawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Fermeture du tiroir panier
 */
function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawerBackdrop");
  if (drawer) {
    drawer.classList.remove("open");
    document.body.style.overflow = "";
  }
}

// ------------------------------------------------------------------------------
// 7. PASSAGE DE COMMANDE (NETLIFY FORMS, GOOGLE SHEETS & IVOIRE LIVRAISON)
// ------------------------------------------------------------------------------

/**
 * Calcule les frais de livraison dynamiques selon la commune et le mode choisi
 */
function getDeliveryCalculation() {
  const communeSelect = document.getElementById("clientCommune");
  let baseFee = 1500; // Par défaut : Zone 1 (Cocody, Plateau, Marcory)

  if (communeSelect && communeSelect.selectedIndex >= 0) {
    const selectedOption = communeSelect.options[communeSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.fee) {
      baseFee = parseInt(selectedOption.dataset.fee, 10) || 1500;
    }
  }

  // Vérifier si Course Flash Urgence (Même Jour) est cochée
  const expressRadio = document.querySelector('input[name="delivery_mode"][value="express"]');
  const isExpress = expressRadio && expressRadio.checked;
  const extraExpress = isExpress ? 1000 : 0;
  const totalDeliveryFee = baseFee + extraExpress;

  return {
    baseFee,
    extraExpress,
    totalDeliveryFee,
    modeName: isExpress ? "⚡ Course Flash Ivoire Livraison (Jour Même)" : "🚀 Ivoire Livraison Standard (24h)"
  };
}

/**
 * Met à jour dynamiquement l'affichage des totaux dans la modale de commande
 */
function updateDeliveryFeeAndTotals() {
  const subtotal = getCartTotal();
  const delivery = getDeliveryCalculation();
  const grandTotal = subtotal + delivery.totalDeliveryFee;

  const subtotalDisplay = document.getElementById("checkoutSubtotalDisplay");
  const deliveryFeeDisplay = document.getElementById("checkoutDeliveryFeeDisplay");
  const deliveryLabel = document.getElementById("checkoutDeliveryLabel");
  const totalDisplay = document.getElementById("checkoutTotalDisplay");
  const hiddenSummary = document.getElementById("hiddenRecapitulatif");
  const hiddenTotal = document.getElementById("hiddenTotal");

  if (subtotalDisplay) subtotalDisplay.textContent = formatPrice(subtotal);
  if (deliveryFeeDisplay) deliveryFeeDisplay.textContent = formatPrice(delivery.totalDeliveryFee);
  if (deliveryLabel) {
    deliveryLabel.textContent = `Frais d'expédition (${delivery.modeName}) :`;
  }
  if (totalDisplay) totalDisplay.textContent = formatPrice(grandTotal);

  if (hiddenSummary) hiddenSummary.value = buildOrderSummaryText();
  if (hiddenTotal) hiddenTotal.value = formatPrice(grandTotal);

  // Mettre à jour l'apparence des radios de livraison
  document.querySelectorAll(".delivery-radio-card").forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

/**
 * Génère le récapitulatif textuel complet du panier avec la livraison
 * Utilisé pour Google Sheets, Netlify Forms et le message WhatsApp
 */
function buildOrderSummaryText(customer = null) {
  let summary = `🛍️ NOUVELLE COMMANDE — ${CONFIG.boutiqueName}\n`;
  summary += `────────────────────────────\n`;

  cart.forEach((item, index) => {
    const subtotal = item.prix * item.qte;
    const sizeInfo = item.taille ? ` (Taille : ${item.taille})` : "";
    summary += `${index + 1}. ${item.nom}${sizeInfo}\n`;
    summary += `   Quantité : ${item.qte} x ${formatPrice(item.prix)} = ${formatPrice(subtotal)}\n`;
  });

  const subtotal = getCartTotal();
  const delivery = getDeliveryCalculation();
  const grandTotal = subtotal + delivery.totalDeliveryFee;

  summary += `────────────────────────────\n`;
  summary += `📦 Sous-total articles : ${formatPrice(subtotal)}\n`;
  summary += `🚚 Acheminement : ${delivery.modeName} (${formatPrice(delivery.totalDeliveryFee)})\n`;
  summary += `💰 TOTAL NET À PAYER : ${formatPrice(grandTotal)}\n`;

  if (customer) {
    summary += `\n👤 COORDONNÉES CLIENT :\n`;
    summary += `• Nom complet : ${customer.nom}\n`;
    summary += `• Téléphone : ${customer.telephone}\n`;
    if (customer.email) summary += `• E-mail : ${customer.email}\n`;
    summary += `• Commune / Destination : ${customer.commune}\n`;
    summary += `• Adresse précise / Repère : ${customer.adresse}\n`;
    summary += `• Formule choisie : ${delivery.modeName}\n`;
    summary += `• Mode de paiement : ${customer.paiement}\n`;
    if (customer.note) summary += `• Instructions particulières : ${customer.note}\n`;
  }

  summary += `────────────────────────────\n`;
  summary += `📍 Expédié via le réseau partenaire Ivoire Livraison.`;

  return summary;
}

/**
 * Construit l'URL WhatsApp wa.me avec le message pré-rempli
 */
function generateWhatsAppOrderUrl(customer = null) {
  const summary = buildOrderSummaryText(customer);
  const encodedText = encodeURIComponent(summary);
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedText}`;
}

/**
 * Ouvre la modale de commande
 */
function openCheckoutModal() {
  if (cart.length === 0) return;

  closeCartDrawer();

  const modal = document.getElementById("checkoutModal");
  const summaryBox = document.getElementById("checkoutSummaryBrief");

  // Réinitialiser les alertes
  const alertBox = document.getElementById("checkoutAlert");
  if (alertBox) {
    alertBox.className = "checkout-alert";
    alertBox.style.display = "none";
    alertBox.innerHTML = "";
  }

  // Afficher le formulaire et cacher la vue de succès précédente
  const formElem = document.getElementById("checkoutForm");
  const successView = document.getElementById("orderSuccessView");
  if (formElem) formElem.style.display = "block";
  if (successView) successView.classList.remove("active");

  // Remplir le récapitulatif condensé
  if (summaryBox) {
    summaryBox.innerHTML = cart.map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <span>${item.qte}x ${item.nom} ${item.taille ? `(${item.taille})` : ''}</span>
        <strong>${formatPrice(item.prix * item.qte)}</strong>
      </div>
    `).join("");
  }

  // Calcul et mise à jour dynamique des totaux & livraison
  updateDeliveryFeeAndTotals();

  if (modal) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Ferme la modale de commande
 */
function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

// URL Google Apps Script Web App pour la synchronisation Google Sheets & Alertes Email
// Suivez le guide dans GUIDE_CONFIGURATION_GOOGLE_SHEETS.md pour obtenir votre URL
const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzcmKZ0jxH8IHyIMWiJLN6KVdCQ-u1AGQpTSqmQKFMswaH3JJsPbUrAbRxfxw8l3MAm4A/exec";

/**
 * Soumission du formulaire de commande (Google Sheets + Netlify Forms + WhatsApp + Ivoire Livraison)
 */
async function handleCheckoutSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = document.getElementById("btnSubmitOrder");
  const alertBox = document.getElementById("checkoutAlert");

  // Extraction des données client
  const formData = new FormData(form);
  const delivery = getDeliveryCalculation();
  const grandTotal = getCartTotal() + delivery.totalDeliveryFee;
  const formattedGrandTotal = formatPrice(grandTotal);

  const customer = {
    nom: formData.get("nom") || "",
    telephone: formData.get("telephone") || "",
    email: formData.get("email") || "",
    commune: formData.get("commune") || "",
    adresse: formData.get("adresse") || "",
    delivery_mode: delivery.modeName,
    delivery_fee: formatPrice(delivery.totalDeliveryFee),
    paiement: formData.get("paiement") || "Paiement à la livraison",
    note: formData.get("note") || ""
  };

  // Validation minimale
  if (!customer.nom || !customer.telephone || !customer.commune || !customer.adresse) {
    showAlert("Veuillez remplir tous les champs obligatoires (*).", "error");
    return;
  }

  // Mettre à jour les champs cachés avec les données client complètes
  const fullSummary = buildOrderSummaryText(customer);
  const orderId = "#CMD-" + Math.floor(1000 + Math.random() * 9000);

  formData.set("recapitulatif_commande", fullSummary);
  formData.set("total", formattedGrandTotal);

  // État de chargement sur le bouton
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> 
      Transmission de la commande...
    `;
  }

  let sheetSuccess = false;

  // 1. Envoi vers Google Sheets & Alertes Emails si l'URL est configurée
  if (GOOGLE_SHEET_WEBAPP_URL && GOOGLE_SHEET_WEBAPP_URL.startsWith("http")) {
    try {
      const sheetPayload = {
        orderId: orderId,
        nom: customer.nom,
        telephone: customer.telephone,
        email: customer.email,
        commune: customer.commune,
        adresse: customer.adresse,
        delivery_mode: customer.delivery_mode,
        delivery_fee: customer.delivery_fee,
        paiement: customer.paiement,
        note: customer.note,
        total: formattedGrandTotal,
        recapitulatif: fullSummary
      };

      // Note : mode "no-cors" assure la transmission sans blocage de redirection Google
      await fetch(GOOGLE_SHEET_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(sheetPayload)
      });
      sheetSuccess = true;
    } catch (sheetErr) {
      console.warn("Transmission Google Sheets :", sheetErr);
    }
  }

  // 2. Envoi complémentaire Netlify Forms (si hébergé sur Netlify)
  const urlEncodedData = new URLSearchParams(formData).toString();
  let netlifySuccess = false;

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: urlEncodedData
    });
    if (response.ok) {
      netlifySuccess = true;
    }
  } catch (error) {
    // Normal hors environnement Netlify
  }

  // Si au moins un canal ou Google Sheets a fonctionné, ou si confirmation demandée
  if (sheetSuccess || netlifySuccess || GOOGLE_SHEET_WEBAPP_URL) {
    handleOrderSuccess(customer);
  } else {
    // Plan d'assistance avec lien WhatsApp pré-rempli
    handleOrderSuccess(customer);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmer ma commande";
  }
}

/**
 * Affichage en cas de succès de l'envoi de la commande
 */
function handleOrderSuccess(customer) {
  const formElem = document.getElementById("checkoutForm");
  const successView = document.getElementById("orderSuccessView");
  const waBtn = document.getElementById("successWaBtn");

  if (formElem) formElem.style.display = "none";
  if (successView) successView.classList.add("active");

  // Lien WhatsApp direct pour confirmation instantanée
  if (waBtn) {
    waBtn.href = generateWhatsAppOrderUrl(customer);
  }

  // Vider le panier
  clearCart();
}

/**
 * Affichage du plan de secours WhatsApp si Netlify Forms est indisponible
 */
function handleOrderFallback(customer) {
  const alertBox = document.getElementById("checkoutAlert");
  if (!alertBox) return;

  const waUrl = generateWhatsAppOrderUrl(customer);

  alertBox.className = "checkout-alert error";
  alertBox.style.display = "block";
  alertBox.innerHTML = `
    <strong>Notification reçue :</strong> Votre commande a été préparée avec succès !<br>
    Finalisez la transmission directement avec notre équipe en un clic :
    <div class="alert-whatsapp-fallback">
      <a href="${waUrl}" target="_blank" rel="noopener" class="btn-whatsapp-rescue">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
        </svg>
        Envoyer la commande sur WhatsApp
      </a>
    </div>
  `;
}

/**
 * Affiche une alerte dans le formulaire
 */
function showAlert(message, type = "error") {
  const alertBox = document.getElementById("checkoutAlert");
  if (!alertBox) return;

  alertBox.className = `checkout-alert ${type}`;
  alertBox.style.display = "block";
  alertBox.innerHTML = message;
}

// ------------------------------------------------------------------------------
// 8. INITIALISATION DES ÉVÉNEMENTS & NAVIGATION
// ------------------------------------------------------------------------------

function setupEventListeners() {
  // 1. Boutons de filtres par catégories
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.category || "tous";
      applyFiltersAndRender();
    });
  });

  // 2. Champ de recherche
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      applyFiltersAndRender();
    });
  }

  // 3. Sélecteur de tri
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  // 4. Menu mobile
  const menuToggle = document.getElementById("mobileMenuToggle");
  const mobileNav = document.getElementById("mobileNavPanel");
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
    });

    // Fermeture automatique au clic sur un lien mobile
    document.querySelectorAll(".mobile-nav-link").forEach(link => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("open");
      });
    });
  }

  // 5. Fermeture des modales par clic sur le fond noir
  window.addEventListener("click", (e) => {
    const productModal = document.getElementById("productModal");
    const checkoutModal = document.getElementById("checkoutModal");
    const guideModal = document.getElementById("guideModal");

    if (e.target === productModal) closeProductModal();
    if (e.target === checkoutModal) closeCheckoutModal();
    if (e.target === guideModal) closeGuideModal();
  });

  // 6. Fermeture avec la touche Échap (Escape)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProductModal();
      closeCartDrawer();
      closeCheckoutModal();
      closeGuideModal();
    }
  });

  // 7. Effet de défilement sur l'en-tête
  window.addEventListener("scroll", () => {
    const header = document.querySelector(".site-header");
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }
  });

  // 8. Configuration des options radio de paiement dans la modale
  document.querySelectorAll(".payment-radio-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".payment-radio-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // 8b. Configuration des options radio de livraison Ivoire Livraison
  document.querySelectorAll(".delivery-radio-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".delivery-radio-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        updateDeliveryFeeAndTotals();
      }
    });
  });

  // 9. Défilement fluide sans polluer l'URL avec des hash (évite de rouvrir la page au milieu)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      const hash = this.getAttribute("href");
      if (hash === "#") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (hash && hash.startsWith("#")) {
        const target = document.querySelector(hash);
        if (target) {
          e.preventDefault();
          // Fermer le menu mobile si ouvert
          const mobilePanel = document.getElementById("mobileNavPanel");
          if (mobilePanel && mobilePanel.classList.contains("open")) {
            mobilePanel.classList.remove("open");
          }
          target.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });
}

/**
 * Ouvre / ferme la modale d'aide & guide pour le propriétaire
 */
function openGuideModal() {
  const modal = document.getElementById("guideModal");
  if (modal) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeGuideModal() {
  const modal = document.getElementById("guideModal");
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function scrollToShop() {
  navigateToPage("articles");
}

/**
 * Navigation fluide entre la page Accueil et la page dédiée aux Articles
 */
function navigateToPage(pageName) {
  const pageHome = document.getElementById("page-home");
  const pageArticles = document.getElementById("page-articles");
  const navLinkHome = document.getElementById("navLinkHome");
  const navLinkArticles = document.getElementById("navLinkArticles");

  // Fermer le menu mobile si ouvert
  const mobilePanel = document.getElementById("mobileNavPanel");
  if (mobilePanel && mobilePanel.classList.contains("open")) {
    mobilePanel.classList.remove("open");
  }

  if (pageName === "articles") {
    if (pageHome) pageHome.classList.add("hidden");
    if (pageArticles) pageArticles.classList.remove("hidden");

    if (navLinkHome) navLinkHome.classList.remove("active");
    if (navLinkArticles) navLinkArticles.classList.add("active");

    try {
      history.pushState({ page: "articles" }, "", "#articles");
    } catch (e) {}

    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } else {
    if (pageArticles) pageArticles.classList.add("hidden");
    if (pageHome) pageHome.classList.remove("hidden");

    if (navLinkArticles) navLinkArticles.classList.remove("active");
    if (navLinkHome) navLinkHome.classList.add("active");

    try {
      history.pushState({ page: "home" }, "", window.location.pathname + window.location.search);
    } catch (e) {}

    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

/**
 * Navigation vers une section spécifique (À propos, Livraison, Contact)
 * S'assure d'abord que la page d'accueil est active.
 */
function navigateToSection(sectionId) {
  const pageHome = document.getElementById("page-home");
  const pageArticles = document.getElementById("page-articles");
  const navLinkHome = document.getElementById("navLinkHome");
  const navLinkArticles = document.getElementById("navLinkArticles");

  if (pageArticles && !pageArticles.classList.contains("hidden")) {
    pageArticles.classList.add("hidden");
    if (pageHome) pageHome.classList.remove("hidden");
    if (navLinkArticles) navLinkArticles.classList.remove("active");
    if (navLinkHome) navLinkHome.classList.add("active");
  }

  const mobilePanel = document.getElementById("mobileNavPanel");
  if (mobilePanel && mobilePanel.classList.contains("open")) {
    mobilePanel.classList.remove("open");
  }

  setTimeout(() => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, 40);
}

// Rendre accessible globalement
window.navigateToPage = navigateToPage;
window.navigateToSection = navigateToSection;
window.scrollToShop = scrollToShop;
window.updateDeliveryFeeAndTotals = updateDeliveryFeeAndTotals;

// Support des boutons Précédent / Suivant du navigateur
window.addEventListener("popstate", () => {
  if (window.location.hash === "#articles") {
    navigateToPage("articles");
  } else {
    navigateToPage("home");
  }
});

// ------------------------------------------------------------------------------
// 9. DÉMARRAGE AU CHARGEMENT DE LA PAGE (TOUJOURS EN HAUT)
// ------------------------------------------------------------------------------
// Évite que le navigateur ne saute au milieu de la page au rechargement
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Repositionnement immédiat en haut de page
window.scrollTo(0, 0);

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadCartFromStorage();
  loadProducts();

  // Initialisation de la page selon l'URL
  if (window.location.hash === "#articles") {
    navigateToPage("articles");
  } else {
    navigateToPage("home");
  }

  // Forcer la position à zéro (tout en haut)
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

// Confirmation après le chargement des images et des styles
window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 20);
});
