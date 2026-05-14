(function () {
  'use strict';

  var CART_STORAGE_KEY = 'menuai_cart';
  window.cartItems = loadCartFromStorage();
  var restaurantData = null;
  var productsData = null;

  function saveCartToStorage() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(window.cartItems));
    } catch (e) {
      console.error('Erro ao salvar carrinho:', e);
    }
  }

  function loadCartFromStorage() {
    try {
      var stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        var items = JSON.parse(stored);
        if (Array.isArray(items)) return items;
      }
    } catch (e) {
      console.error('Erro ao carregar carrinho:', e);
    }
    return [];
  }

  function filterCartForRestaurant(productIds) {
    var beforeCount = window.cartItems.length;
    window.cartItems = window.cartItems.filter(function (item) {
      return item.product && productIds.indexOf(item.product.id) !== -1;
    });
    if (beforeCount !== window.cartItems.length) {
      saveCartToStorage();
      renderCartDrawer();
      updateFabBadge();
    }
  }

  function clearCartStorage() {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {}
  }

  function getSlugFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('slug') || '';
  }

  function formatPrice(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  }

  function showToast(message) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  function showLoading() {
    var el = document.getElementById('loading-state');
    var err = document.getElementById('error-state');
    if (el) el.style.display = '';
    if (err) err.style.display = 'none';
  }

  function hideLoading() {
    var el = document.getElementById('loading-state');
    if (el) el.style.display = 'none';
  }

  function showError() {
    var loading = document.getElementById('loading-state');
    var error = document.getElementById('error-state');
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = '';
  }

  function trackAnalytics(eventType, data) {
    if (!restaurantData) return;
    var payload = {
      restaurant_id: restaurantData.id,
      event_type: eventType,
      metadata: data || {}
    };
    try {
      api.trackAnalytics(payload).catch(function (e) {
        console.warn('Analytics error:', e);
      });
    } catch (e) {
      console.warn('Analytics failed:', e);
    }
  }

  function renderMenuHeader(restaurant) {
    var container = document.createElement('div');
    container.className = 'menu-header';

    var shareBtn = document.createElement('button');
    shareBtn.className = 'menu-share-btn-fixed';
    shareBtn.textContent = 'Compartilhar';
    shareBtn.onclick = function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: restaurant.name, url: url }).catch(function() {});
      } else {
        navigator.clipboard.writeText(url).then(function () {
          showToast('Link copiado!');
        });
      }
    };
    container.appendChild(shareBtn);

    var banner = document.createElement('div');
    banner.className = 'menu-banner';
    if (restaurant.banner_url) {
      banner.style.backgroundImage = 'url(' + restaurant.banner_url + ')';
    } else {
      banner.style.background = 'linear-gradient(135deg, #0C0A07 0%, #2a1f0e 100%)';
    }

    var logoWrap = document.createElement('div');
    logoWrap.className = 'menu-logo-wrap';

    var logo = document.createElement('div');
    logo.className = 'menu-logo';

    if (restaurant.logo_url) {
      var logoImg = document.createElement('img');
      logoImg.src = restaurant.logo_url;
      logoImg.alt = restaurant.name || 'Logo';
      logoImg.className = 'menu-logo-img';
      logo.appendChild(logoImg);
    } else {
      logo.className += ' menu-logo-placeholder';
      logo.textContent = (restaurant.name || 'R').charAt(0).toUpperCase();
    }

    logoWrap.appendChild(logo);
    container.appendChild(banner);
    container.appendChild(logoWrap);

    var info = document.createElement('div');
    info.className = 'menu-info';

    var name = document.createElement('h1');
    name.className = 'menu-name';
    name.textContent = restaurant.name || 'Restaurante';

    var category = document.createElement('p');
    category.className = 'menu-category';
    category.textContent = restaurant.category || '';

    var badge = document.createElement('div');
    badge.className = 'menu-open-badge';
    var dot = document.createElement('span');
    dot.className = 'menu-open-dot';
    var label = document.createElement('span');
    label.textContent = 'Aberto agora';
    badge.appendChild(dot);
    badge.appendChild(label);

    info.appendChild(name);
    if (restaurant.category) info.appendChild(category);
    info.appendChild(badge);

    // Business hours
    if (restaurant.business_hours) {
      var hoursEl = document.createElement('div');
      hoursEl.className = 'business-hours';
      hoursEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + escapeHtml(restaurant.business_hours);
      info.appendChild(hoursEl);
    }

    container.appendChild(info);

    return container;
  }

  function renderCategoryFilter(products, activeCategory, onFilter) {
    var categories = ['Todas'];
    var seen = {};
    for (var i = 0; i < products.length; i++) {
      var cat = products[i].category || 'Sem categoria';
      if (!seen[cat]) {
        seen[cat] = true;
        categories.push(cat);
      }
    }

    var container = document.createElement('div');
    container.className = 'category-filter';

    for (var j = 0; j < categories.length; j++) {
      var btn = document.createElement('button');
      btn.className = 'category-btn';
      if (categories[j] === activeCategory) btn.classList.add('active');
      btn.textContent = categories[j];
      btn.dataset.category = categories[j];
      btn.addEventListener('click', function (e) {
        var cat = e.currentTarget.dataset.category;
        onFilter(cat);
      });
      container.appendChild(btn);
    }

    return container;
  }

  function renderProductCard(product, onAdd) {
    var card = document.createElement('div');
    card.className = 'product-card';
    if (product.is_highlight) card.classList.add('product-card-highlight');

    if (product.is_highlight) {
      var highlightBar = document.createElement('div');
      highlightBar.className = 'product-highlight-bar';
      highlightBar.textContent = 'DESTAQUE';
      card.appendChild(highlightBar);
    }

    var imgWrap = document.createElement('div');
    imgWrap.className = 'product-img-wrap';

    if (product.image_url) {
      var img = document.createElement('img');
      img.className = 'product-img';
      img.src = product.image_url;
      img.alt = product.name || '';
      img.loading = 'lazy';
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
        ov.addEventListener('click', function () { ov.remove(); });
        var fi = document.createElement('img');
        fi.src = img.src;
        fi.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:12px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
        ov.appendChild(fi);
        document.body.appendChild(ov);
      });
      img.addEventListener('error', function () {
        imgWrap.innerHTML = '<div class="product-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
      });
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = '<div class="product-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
    }

    card.appendChild(imgWrap);

    var body = document.createElement('div');
    body.className = 'product-body';

    var name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = product.gourmet_name || product.name || 'Produto';
    body.appendChild(name);

    if (product.description) {
      var desc = document.createElement('p');
      desc.className = 'product-desc';
      desc.textContent = product.description;
      body.appendChild(desc);
    }

    var foot = document.createElement('div');
    foot.className = 'product-foot';

    var priceWrap = document.createElement('div');
    priceWrap.className = 'product-price-wrap';
    if (product.is_promotion && product.old_price) {
      var oldPrice = document.createElement('span');
      oldPrice.className = 'product-old-price';
      oldPrice.textContent = formatPrice(product.old_price);
      priceWrap.appendChild(oldPrice);
    }
    var price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = formatPrice(product.price);
    priceWrap.appendChild(price);
    foot.appendChild(priceWrap);

    var addBtn = document.createElement('button');
    addBtn.className = 'product-add-btn';
    addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.setAttribute('aria-label', 'Adicionar ' + (product.name || ''));
    addBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      onAdd(product);
    });
    foot.appendChild(addBtn);

    body.appendChild(foot);
    card.appendChild(body);

    return card;
  }

  function renderProductGrid(products, activeCategory) {
    var container = document.createElement('div');
    container.className = 'product-grid';

    var filtered = products;
    if (activeCategory && activeCategory !== 'Todas') {
      filtered = products.filter(function (p) {
        return (p.category || 'Sem categoria') === activeCategory;
      });
    }

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'product-grid-empty';
      empty.textContent = 'Nenhum produto encontrado';
      container.appendChild(empty);
      return container;
    }

    for (var i = 0; i < filtered.length; i++) {
      var card = renderProductCard(filtered[i], function (product) {
        addToCart(product);
      });
      container.appendChild(card);
    }

    return container;
  }

  function renderCartDrawer() {
    var list = document.getElementById('cart-items');
    var footer = document.getElementById('cart-footer');
    var totalEl = document.getElementById('cart-total-value');
    if (!list) return;

    if (window.cartItems.length === 0) {
      list.innerHTML = '<div class="cart-empty"><p>Seu carrinho está vazio</p></div>';
      if (footer) footer.style.display = 'none';
      return;
    }

    var html = '';
    for (var i = 0; i < window.cartItems.length; i++) {
      var item = window.cartItems[i];
      var p = item.product;
      var name = p.gourmet_name || p.name || 'Produto';
      var unitPrice = formatPrice(p.price);
      var lineTotal = formatPrice(p.price * item.quantity);
      var prodId = p.id;

      html += '<div class="cart-item">';
      html += '<div class="cart-item-info">';
      html += '<span class="cart-item-name">' + escapeHtml(name) + '</span>';
      html += '<span class="cart-item-unit">' + unitPrice + '</span>';
      html += '</div>';
      html += '<div class="cart-item-qty">';
      html += '<button class="cart-qty-btn" data-product-id="' + prodId + '" data-delta="-1">-</button>';
      html += '<span class="cart-qty-value">' + item.quantity + '</span>';
      html += '<button class="cart-qty-btn" data-product-id="' + prodId + '" data-delta="1">+</button>';
      html += '</div>';
      html += '<span class="cart-item-total">' + lineTotal + '</span>';
      html += '</div>';
    }

    list.innerHTML = html;

    var qtyBtns = list.querySelectorAll('.cart-qty-btn');
    for (var j = 0; j < qtyBtns.length; j++) {
      qtyBtns[j].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var pid = btn.dataset.productId;
        var delta = parseInt(btn.dataset.delta, 10);
        updateQuantity(pid, delta);
      });
    }

    if (footer) {
      footer.style.display = '';
      totalEl.textContent = formatPrice(getCartTotal());
    }
  }

  function addToCart(product) {
    if (!product || !product.id) return;
    for (var i = 0; i < window.cartItems.length; i++) {
      if (window.cartItems[i].product.id === product.id) {
        window.cartItems[i].quantity += 1;
        renderCartDrawer();
        updateFabBadge();
        saveCartToStorage();
        showToast((product.gourmet_name || product.name) + ' +1');
        return;
      }
    }
    window.cartItems.push({ product: product, quantity: 1 });
    renderCartDrawer();
    updateFabBadge();
    saveCartToStorage();
    showToast((product.gourmet_name || product.name) + ' (adicionado ao carrinho)');
  }

  function removeFromCart(productId) {
    for (var i = 0; i < window.cartItems.length; i++) {
      if (window.cartItems[i].product.id === productId) {
        window.cartItems.splice(i, 1);
        break;
      }
    }
    renderCartDrawer();
    updateFabBadge();
    saveCartToStorage();
  }

  function updateQuantity(productId, delta) {
    for (var i = 0; i < window.cartItems.length; i++) {
      if (window.cartItems[i].product.id === productId) {
        window.cartItems[i].quantity += delta;
        if (window.cartItems[i].quantity <= 0) {
          window.cartItems.splice(i, 1);
        }
        renderCartDrawer();
        updateFabBadge();
        saveCartToStorage();
        return;
      }
    }
  }

  function getCartTotal() {
    var total = 0;
    for (var i = 0; i < window.cartItems.length; i++) {
      total += window.cartItems[i].product.price * window.cartItems[i].quantity;
    }
    return total;
  }

  function getCartCount() {
    var count = 0;
    for (var i = 0; i < window.cartItems.length; i++) {
      count += window.cartItems[i].quantity;
    }
    return count;
  }

  function clearCart() {
    window.cartItems = [];
    renderCartDrawer();
    updateFabBadge();
    clearCartStorage();
  }

  function updateFabBadge() {
    var badge = document.getElementById('cart-fab-badge');
    var fab = document.getElementById('cart-fab');
    var count = getCartCount();
    if (badge) badge.textContent = count;
    if (fab) {
      if (count > 0) {
        fab.style.display = '';
      } else {
        fab.style.display = 'none';
      }
    }
  }

  function openCart() {
    var drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    var drawer = document.getElementById('cart-drawer');
    if (drawer) drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function sendWhatsAppOrder(restaurant) {
    if (window.cartItems.length === 0) {
      showToast('Carrinho vazio');
      return;
    }

    var phone = restaurant.whatsapp || restaurant.phone || '';
    if (!phone) {
      showToast('WhatsApp não disponível');
      return;
    }

    var cleaned = phone.replace(/\D/g, '');
    
    // Garantir formato internacional para WhatsApp
    if (cleaned.length <= 11 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    var table = document.getElementById('cart-table');
    var obs = document.getElementById('cart-obs');
    var tableNum = table ? table.value.trim() : '';
    var obsText = obs ? obs.value.trim() : '';

    var lines = [];
    lines.push('*Pedido - ' + (restaurant.name || 'Restaurante') + '*');
    if (tableNum) lines.push('*Mesa:* ' + tableNum);
    if (obsText) lines.push('*Obs:* ' + obsText);
    lines.push('');

    for (var i = 0; i < window.cartItems.length; i++) {
      var item = window.cartItems[i];
      var name = item.product.gourmet_name || item.product.name || 'Produto';
      var total = item.product.price * item.quantity;
      lines.push(item.quantity + 'x ' + name + ' - ' + formatPrice(total));
    }

    lines.push('');
    lines.push('*Total: ' + formatPrice(getCartTotal()) + '*');

    // Also save order to server if API available
    try {
      api.saveOrder({
        restaurant_id: restaurant.id,
        table: tableNum,
        observations: obsText,
        items: window.cartItems.map(function (item) {
          return { product_id: item.product.id, name: item.product.name, quantity: item.quantity, price: item.product.price };
        }),
        total: getCartTotal()
      }).catch(function (e) { console.warn('Order save failed:', e); });
    } catch (e) { console.warn('Order save error:', e); }

    var message = encodeURIComponent(lines.join('\n'));
    var url = 'https://wa.me/' + cleaned + '?text=' + message;
    window.open(url, '_blank');

    clearCart();
    closeCart();

    trackAnalytics('whatsapp_click', {
      restaurant_id: restaurant.id,
      item_count: getCartCount(),
      total: getCartTotal()
    });
  }

  function initMenu() {
    var root = document.getElementById('menu-root');
    if (!root) return;

    var slug = getSlugFromUrl();
    if (!slug) {
      showError();
      return;
    }

    showLoading();

    api.fetchRestaurantBySlug(slug).then(function (r) {
      if (!r || !r.data) {
        var errorDiv = document.getElementById('error-state');
        if (errorDiv) {
          errorDiv.querySelector('h2').textContent = 'Cardápio não encontrado';
          errorDiv.querySelector('p').textContent = 'Verifique o link ou tente novamente.';
        }
        showError();
        return null;
      }
      restaurantData = r.data;
      // Load business hours from admin settings
      return api.fetchAdminSettings().then(function (settings) {
        if (settings && settings.data && settings.data.business_hours) {
          restaurantData.business_hours = settings.data.business_hours;
        }
        // Load schedules for auto period detection
        return api.fetchSchedules(restaurantData.id);
      }).then(function (schedulesResult) {
        var schedules = schedulesResult && schedulesResult.data ? schedulesResult.data : [];
        // Auto-detect current period
        var now = new Date();
        var currentHour = now.getHours();
        var currentMin = now.getMinutes();
        var currentTime = ('0' + currentHour).slice(-2) + ':' + ('0' + currentMin).slice(-2);
        var activePeriod = 'todos';
        for (var i = 0; i < schedules.length; i++) {
          var s = schedules[i];
          if (currentTime >= s.start_time && currentTime <= s.end_time) {
            activePeriod = s.period.toLowerCase();
            if (activePeriod === 'café da manhã') activePeriod = 'cafe';
            else if (activePeriod === 'almoço') activePeriod = 'almoço';
            else if (activePeriod === 'jantar') activePeriod = 'jantar';
            break;
          }
        }
        // Only auto-select if schedules exist — otherwise show ALL products
        // (the period buttons are still available for manual filtering)
        if (schedules.length === 0) activePeriod = 'todos';
        restaurantData._activePeriod = activePeriod;
        return api.fetchProducts(restaurantData.id);
      });
    }).catch(function (e) {
      console.error('Erro ao carregar cardápio:', e);
      var errorDiv = document.getElementById('error-state');
      if (errorDiv) {
        errorDiv.querySelector('h2').textContent = 'Erro de conexão';
        errorDiv.querySelector('p').textContent = 'Verifique sua internet e tente novamente.';
      }
      showError();
      return null;
    }).then(function (r) {
      if (!r) return;
      productsData = r.data || [];
      productsData.sort(function (a, b) {
        var aOrder = a.sort_order || 0;
        var bOrder = b.sort_order || 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
      hideLoading();

      var productIds = (r.data || []).map(function (p) { return p.id; });
      filterCartForRestaurant(productIds);

      renderFullMenu(restaurantData, productsData);
      trackAnalytics('view', {
        path: window.location.pathname,
        referrer: document.referrer,
        viewport: window.innerWidth + 'x' + window.innerHeight
      });
    }).catch(function (err) {
      hideLoading();
      showError();
      console.error('Menu error:', err);
    });
  }

  function renderFullMenu(restaurant, products) {
    var root = document.getElementById('menu-root');
    if (!root) return;

    root.innerHTML = '';

    var header = renderMenuHeader(restaurant);
    root.appendChild(header);

    var activeCategory = 'Todas';
    var searchTerm = '';
    var activePeriod = restaurant._activePeriod || 'todos';
    var allProducts = products;

    function getFiltered() {
      var filtered = allProducts;
      // Period filter
      if (activePeriod !== 'todos') {
        var periodCategories = {
          cafe: ['Café', 'Café da Manhã', 'Bebidas Quentes', 'Cafeteria'],
          almoço: ['Pratos Principais', 'Entradas', 'Massas', 'Sobremesas', 'Saladas'],
          jantar: ['Pratos Principais', 'Entradas', 'Massas', 'Bebidas', 'Combos', 'Porções']
        };
        var cats = periodCategories[activePeriod] || [];
        if (cats.length) {
          filtered = filtered.filter(function (p) { return cats.indexOf(p.category || '') !== -1; });
        }
      }
      // Search
      if (searchTerm) {
        var term = searchTerm.toLowerCase();
        filtered = filtered.filter(function (p) {
          return (p.name || '').toLowerCase().indexOf(term) !== -1 ||
                 (p.description || '').toLowerCase().indexOf(term) !== -1 ||
                 (p.gourmet_name || '').toLowerCase().indexOf(term) !== -1;
        });
      }
      return filtered;
    }

    function reRenderContent(category) {
      var existingContent = root.querySelector('.menu-content');
      if (existingContent) existingContent.remove();

      var content = document.createElement('div');
      content.className = 'menu-content';

      // Period filter
      var periodBar = document.createElement('div');
      periodBar.className = 'period-filter';
      var periods = [
        { id: 'todos', label: 'Todos' },
        { id: 'cafe', label: '☕ Café' },
        { id: 'almoço', label: '🍽️ Almoço' },
        { id: 'jantar', label: '🌙 Jantar' }
      ];
      periods.forEach(function (p) {
        var btn = document.createElement('button');
        btn.className = 'period-btn' + (p.id === activePeriod ? ' active' : '');
        btn.textContent = p.label;
        btn.dataset.period = p.id;
        btn.addEventListener('click', function () {
          activePeriod = this.dataset.period;
          reRenderContent(activeCategory);
        });
        periodBar.appendChild(btn);
      });
      content.appendChild(periodBar);

      // Search bar
      var searchWrap = document.createElement('div');
      searchWrap.className = 'menu-search-wrap menu-search-icon';
      var searchInput = document.createElement('input');
      searchInput.className = 'menu-search-input';
      searchInput.type = 'text';
      searchInput.placeholder = 'Buscar no cardápio...';
      searchInput.value = searchTerm;
      searchInput.addEventListener('input', function () {
        searchTerm = this.value;
        var filtered = getFiltered();
        var oldGrid = content.querySelector('.product-grid');
        if (oldGrid) oldGrid.remove();
        var newGrid = renderProductGrid(filtered, activeCategory);
        content.appendChild(newGrid);
      });
      searchWrap.appendChild(searchInput);
      content.appendChild(searchWrap);

      var filter = renderCategoryFilter(getFiltered(), category, function (cat) {
        activeCategory = cat;
        var btns = content.querySelectorAll('.category-btn');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('active', btns[i].dataset.category === cat);
        }
        var oldGrid = content.querySelector('.product-grid');
        if (oldGrid) oldGrid.remove();
        var newGrid = renderProductGrid(getFiltered(), cat);
        content.appendChild(newGrid);
      });

      content.appendChild(filter);

      var grid = renderProductGrid(getFiltered(), category);
      content.appendChild(grid);

      root.appendChild(content);
    }

    reRenderContent(activeCategory);

    var submitBtn = document.getElementById('cart-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        sendWhatsAppOrder(restaurant);
      });
    }
  }

  function validateImageUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fab = document.getElementById('cart-fab');
    var closeBtn = document.getElementById('cart-close-btn');
    var backdrop = document.querySelector('.cart-backdrop');

    if (fab) fab.addEventListener('click', openCart);
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (backdrop) backdrop.addEventListener('click', closeCart);

    // Auto-fill table number from URL
    var mesaParam = getQueryParam('mesa');
    if (mesaParam) {
      var tableInput = document.getElementById('cart-table');
      if (tableInput) tableInput.value = mesaParam;
    }

    updateFabBadge();
    initMenu();
  });
})();
