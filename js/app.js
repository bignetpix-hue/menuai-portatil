var currentPage = 1;
var currentFilter = { search: '', status: 'all', categoria: 'all' };
var currentRestaurantId = null;
var adminEditingRestaurantId = null;
var dragSourceEl = null;
var aiGeneratedDescription = '';
var allProducts = [];
var adminAllProducts = [];
var adminCurrentPage = 1;

function initApp() {
  console.log('initApp starting...');
  requireAuth().then(function (user) {
    console.log('requireAuth returned:', !!user);
    if (!user) return;
    currentUser = user;
    console.log('currentUser set, loading restaurant...');
    return loadRestaurant();
  }).then(function (restaurant) {
    console.log('loadRestaurant returned:', !!restaurant, 'currentRestaurant:', !!currentRestaurant);
    checkAdminStatus();
    setupRouter();
    setupGlobalListeners();
    handleRoute();
  }).catch(function (e) {
    console.error('Init error:', e);
    console.error('Init error:', e);
    var appContent = document.getElementById('app-content');
    if (appContent) {
      appContent.innerHTML = '<div class="error-state"><h2>Erro ao carregar</h2><p>Tente novamente recarregando a página.</p></div>';
    }
  });
}

function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
  var hash = window.location.hash || '#/';
  console.log('handleRoute called, hash:', hash);
  var viewId = '';
  if (hash.startsWith('#/admin/config')) viewId = 'view-admin-config';
  else if (hash.startsWith('#/admin/restaurant')) viewId = 'view-admin-restaurant';
  else if (hash.startsWith('#/admin/staff')) viewId = 'view-admin-staff';
  else if (hash.startsWith('#/admin')) viewId = 'view-admin';
  else if (hash.startsWith('#/reports')) viewId = 'view-reports';
  else if (hash.startsWith('#/config')) viewId = 'view-config';
  else if (hash.startsWith('#/qrcode')) viewId = 'view-qrcode';
  else if (hash.startsWith('#/orders')) viewId = 'view-orders';
  else if (hash.startsWith('#/products')) viewId = 'view-products';
  else viewId = 'view-dashboard';
  console.log('viewId:', viewId);

  if (viewId !== 'view-admin-restaurant') {
    adminEditingRestaurantId = null;
  }

  document.querySelectorAll('.view-section').forEach(function (v) { v.style.display = 'none'; });
  var view = document.getElementById(viewId);
  if (view) view.style.display = 'block';

  document.querySelectorAll('.nav-link[data-route]').forEach(function (l) { l.classList.remove('active'); });
  document.querySelectorAll('.sidebar-link[data-route]').forEach(function (l) { l.classList.remove('active'); });

  var routeMap = { 'view-dashboard': 'dashboard', 'view-config': 'config', 'view-qrcode': 'qrcode', 'view-products': 'products', 'view-orders': 'orders', 'view-reports': 'reports', 'view-admin': 'admin', 'view-admin-config': 'admin-config', 'view-admin-staff': 'admin-staff', 'view-admin-restaurant': 'admin' };
  var activeRoute = routeMap[viewId];
  if (activeRoute) {
    var activeLink = document.querySelector('.nav-link[data-route="' + activeRoute + '"]');
    if (activeLink) activeLink.classList.add('active');
    var sidebarLink = document.querySelector('.sidebar-link[data-route="' + activeRoute + '"]');
    if (sidebarLink) sidebarLink.classList.add('active');
  }

  var headerNav = document.getElementById('header-nav');
  if (headerNav) headerNav.classList.remove('open');

  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  if (viewId === 'view-dashboard') mountDashboard();
  else if (viewId === 'view-config') mountConfig();
  else if (viewId === 'view-qrcode') mountQRCode();
  else if (viewId === 'view-products') mountProducts();
  else if (viewId === 'view-orders') mountOrders();
  else if (viewId === 'view-reports') mountReports();
  else if (viewId === 'view-admin') mountAdmin();
  else if (viewId === 'view-admin-config') mountAdminConfig();
  else if (viewId === 'view-admin-staff') mountStaff();
  else if (viewId === 'view-admin-restaurant') mountAdminRestaurant();
}

function setupGlobalListeners() {
  setupSidebarToggle();

  document.getElementById('hamburger-btn') && document.getElementById('hamburger-btn').addEventListener('click', function () {
    var nav = document.getElementById('header-nav');
    if (nav) nav.classList.toggle('open');
  });
  document.getElementById('nav-sair') && document.getElementById('nav-sair').addEventListener('click', function (e) {
    e.preventDefault();
    logout();
  });
  document.querySelectorAll('.modal-close-icon').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(this.dataset.modal);
    });
  });
  document.querySelectorAll('.modal-footer .modal-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(this.dataset.modal);
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

function checkAdminStatus() {
  var email = currentUser ? currentUser.email : '';
  isAdmin(email).then(function (isAdm) {
    if (isAdm) {
      document.querySelectorAll('.admin-only').forEach(function (el) { el.style.display = ''; });
      document.querySelectorAll('.config-link').forEach(function (el) { el.style.display = 'none'; });
      document.querySelectorAll('.dashboard-products').forEach(function (el) { el.style.display = 'none'; });
    } else {
      document.querySelectorAll('.config-link').forEach(function (el) { el.style.display = ''; });
      document.querySelectorAll('.dashboard-products').forEach(function (el) { el.style.display = ''; });
    }
  });
}

// Sidebar toggle
function setupSidebarToggle() {
  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }
}

function mountDashboard() {
  if (!currentUser) return;
  if (!currentRestaurant) {
    loadRestaurant().then(renderDashboard).catch(function (e) {
      console.error('Erro ao carregar restaurante:', e);
      renderDashboard();
    });
  } else {
    renderDashboard();
  }
}

function mountProducts() {
  console.log('mountProducts called, currentUser:', !!currentUser, 'currentRestaurant:', !!currentRestaurant);
  if (!currentUser) {
    console.log('No user, returning');
    return;
  }
  if (!currentRestaurant) {
    console.log('Loading restaurant...');
    loadRestaurant().then(function() {
      console.log('Restaurant loaded, currentRestaurant:', !!currentRestaurant);
      renderProductsPage();
    }).catch(function (e) {
      console.error('Erro ao carregar restaurante:', e);
      renderProductsPage();
    });
  } else {
    console.log('Calling renderProductsPage');
    renderProductsPage();
  }
}

function renderProductsPage() {
  var rest = currentRestaurant;
  console.log('renderProductsPage, rest:', !!rest);
  if (!rest) {
    var view = document.getElementById('view-products');
    if (view) {
      view.innerHTML = '<div class="empty-state">Carregando produtos...</div>';
    }
    return;
  }
  document.getElementById('prod-search').value = '';
  document.getElementById('prod-filter-status').value = 'all';
  currentPage = 1;
  loadProducts();
}

function renderDashboard() {
  var rest = currentRestaurant;
  if (!rest) return;
  var infoEl = document.getElementById('restaurant-info-header');
  infoEl.innerHTML = '<span class="rest-name-badge">' + escapeHtml(rest.name || '') + '</span>';

  var viewMenuBtn = document.getElementById('btn-dashboard-view-menu');
  if (viewMenuBtn && rest.slug) {
    viewMenuBtn.href = window.location.origin + '/menu.html?slug=' + rest.slug;
    viewMenuBtn.style.display = 'inline-flex';
  }

  fetchStats();
  loadContactInfo();
}

function fetchStats() {
  if (!currentRestaurant) return;
  var restId = currentRestaurant.id;

  Promise.all([
    api.countAnalytics(restId, 'view'),
    api.countAnalytics(restId, 'whatsapp_click'),
    api.fetchAllProducts(restId)
  ]).then(function (results) {
    document.getElementById('stat-visualizacoes-value').textContent = results[0].count || 0;
    document.getElementById('stat-whatsapp-value').textContent = results[1].count || 0;
    
    var products = results[2].data || [];
    var total = products.length;
    var ativos = products.filter(function (p) { return p.is_active !== false; }).length;
    var inativos = products.filter(function (p) { return p.is_active === false; }).length;
    var destaque = products.filter(function (p) { return p.is_highlight; }).length;
    
    document.getElementById('stat-produtos-total-value').textContent = total;
    document.getElementById('stat-produtos-ativos-value').textContent = ativos;
    document.getElementById('stat-produtos-inativos-value').textContent = inativos;
    document.getElementById('stat-produtos-destaque-value').textContent = destaque;
    
    renderProductCharts(products);
  }).catch(function (e) {
    console.error('Stats error:', e);
  });
}

function renderProducts() {
  if (!currentRestaurant) return;
  currentPage = 1;
  loadProducts();
}

function renderProductCharts(products) {
  var catContainer = document.getElementById('chart-categorias');
  var distContainer = document.getElementById('chart-distribuicao');
  if (!catContainer || !distContainer) return;
  
  var cats = {};
  products.forEach(function (p) {
    var cat = p.category || 'Sem categoria';
    cats[cat] = (cats[cat] || 0) + 1;
  });

  var catEntries = Object.entries(cats).sort(function (a, b) { return b[1] - a[1]; });
  var catColors = ['#FF4500', '#FF6B2C', '#FF9A5C', '#FFB347', '#16A34A', '#22C55E', '#8B5CF6', '#A78BFA', '#3B82F6', '#60A5FA'];
  var totalProd = products.length || 1;
  var catHtml = '';
  if (catEntries.length === 0) {
    catHtml = '<div class="empty-state">Nenhum produto encontrado</div>';
  } else {
    catHtml = '<div class="cat-chart-grid">';
    catEntries.forEach(function (entry, i) {
      var pct = Math.round((entry[1] / totalProd) * 100);
      var color = catColors[i % catColors.length];
      catHtml += '<div class="cat-chart-item">';
      catHtml += '<div class="cat-chart-header">';
      catHtml += '<span class="cat-chart-dot" style="background:' + color + '"></span>';
      catHtml += '<span class="cat-chart-name">' + escapeHtml(entry[0]) + '</span>';
      catHtml += '<span class="cat-chart-count">' + entry[1] + '</span>';
      catHtml += '</div>';
      catHtml += '<div class="cat-chart-bar-bg">';
      catHtml += '<div class="cat-chart-bar-fill" style="width:' + pct + '%; background:' + color + '"></div>';
      catHtml += '</div>';
      catHtml += '<span class="cat-chart-pct">' + pct + '%</span>';
      catHtml += '</div>';
    });
    catHtml += '</div>';
  }
  catContainer.innerHTML = catHtml;
  
  var ativos = products.filter(function (p) { return p.is_active !== false; }).length;
  var inativos = products.length - ativos;
  var destaque = products.filter(function (p) { return p.is_highlight; }).length;
  var normais = products.length - destaque;
  
  var colors = ['#FF4500', '#16A34A', '#8B5CF6', '#3B82F6'];
  var labels = ['Ativos', 'Inativos', 'Destaque', 'Normais'];
  var values = [ativos, inativos, destaque, normais];
  var total = products.length || 1;
  
  var radius = 70;
  var circumference = 2 * Math.PI * radius;
  var offset = 0;
  var svgPaths = '';
  
  values.forEach(function (val, i) {
    if (val <= 0) return;
    var pct = val / total;
    var dashLength = pct * circumference;
    svgPaths += '<circle cx="90" cy="90" r="' + radius + '" fill="none" stroke="' + colors[i] + '" stroke-width="20" stroke-dasharray="' + dashLength + ' ' + (circumference - dashLength) + '" stroke-dashoffset="' + -offset + '" />';
    offset += dashLength;
  });
  
  var legendHtml = '';
  values.forEach(function (val, i) {
    legendHtml += '<div class="chart-legend-item"><span class="chart-legend-dot" style="background:' + colors[i] + '"></span>' + labels[i] + ': ' + val + '</div>';
  });
  
  distContainer.innerHTML = '<div class="chart-donut"><div class="chart-donut-ring"><svg width="180" height="180" viewBox="0 0 180 180">' + svgPaths + '</svg><div class="chart-donut-center"><div class="total">' + products.length + '</div><div class="label">produtos</div></div></div><div class="chart-donut-legend">' + legendHtml + '</div></div>';
}

function loadProducts() {
  if (!currentRestaurant) return;
  var listEl = document.getElementById('products-list');
  listEl.innerHTML = '<div class="loading-cell">Carregando...</div>';

  api.fetchAllProducts(currentRestaurant.id).then(function (result) {
    console.log('Produtos carregados:', result.data ? result.data.length : 0);
    allProducts = result.data || [];
    applyFilters();
  }).catch(function (e) {
    console.error('Erro loadProducts:', e);
    listEl.innerHTML = '<div class="error-cell">Erro ao carregar produtos</div>';
    showToast('Erro ao carregar produtos: ' + e.message, 'error');
  });
}

function applyFilters() {
  var search = document.getElementById('prod-search').value.toLowerCase();
  var status = document.getElementById('prod-filter-status').value;
  var cat = document.getElementById('prod-filter-categoria').value;

  var filtered = allProducts.filter(function (p) {
    if (search && !(p.name || '').toLowerCase().includes(search) && !(p.description || '').toLowerCase().includes(search)) return false;
    if (status === 'active' && p.is_active === false) return false;
    if (status === 'inactive' && p.is_active !== false) return false;
    if (cat !== 'all' && p.category !== cat) return false;
    return true;
  });

  populateCategoryFilter();
  renderFilteredProducts(filtered);
}

function populateCategoryFilter() {
  var sel = document.getElementById('prod-filter-categoria');
  var currentVal = sel.value;
  var cats = {};
  allProducts.forEach(function (p) {
    if (p.category) cats[p.category] = true;
  });
  var html = '<option value="all">Todas Categorias</option>';
  Object.keys(cats).sort().forEach(function (c) {
    html += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
  });
  sel.innerHTML = html;
  sel.value = currentVal;
}

function renderFilteredProducts(products) {
  var perPage = 6;
  var totalPages = Math.ceil(products.length / perPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage - 1) * perPage;
  var pageItems = products.slice(start, start + perPage);

  var listEl = document.getElementById('products-list');
  if (pageItems.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhum produto encontrado</div>';
  } else {
    var html = '';
    pageItems.forEach(function (p) {
      var imgHtml = p.image_url
        ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" class="product-thumb">'
        : '<div class="product-thumb product-thumb-placeholder">📷</div>';
      var badgeHtml = '';
      if (p.category) badgeHtml += '<span class="badge badge-cat">' + escapeHtml(p.category) + '</span>';
      if (p.is_highlight) badgeHtml += '<span class="badge badge-highlight">Destaque</span>';
      var activeClass = p.is_active !== false ? '' : ' inactive';
      html += '<div class="product-item' + activeClass + '" draggable="true" data-product-id="' + p.id + '" data-sort="' + (p.sort_order || 0) + '">'
        + '<div class="drag-handle" draggable="true">⠿</div>'
        + imgHtml
        + '<div class="product-info">'
        + '<div class="product-name">' + escapeHtml(p.name) + '</div>'
        + '<div class="product-meta">' + (p.gourmet_name ? '<span class="gourmet-name">' + escapeHtml(p.gourmet_name) + '</span>' : '') + badgeHtml + '</div>'
        + '<div class="product-price">' + formatPrice(p.price) + '</div>'
        + '</div>'
        + '<div class="product-actions">'
        + '<button class="btn btn-sm btn-duplicate" data-product="' + encodeURIComponent(JSON.stringify(p)) + '">Duplicar</button>'
        + '<button class="btn btn-sm btn-edit" data-product="' + encodeURIComponent(JSON.stringify(p)) + '">Editar</button>'
        + '<button class="btn btn-sm btn-danger" data-product-id="' + p.id + '" data-product-name="' + escapeHtml(p.name) + '">Excluir</button>'
        + '</div>'
        + '</div>';
    });
    listEl.innerHTML = html;
  }

  setupDragDrop();
  setupProductActionButtons();
  renderPagination(totalPages, 'prod-pagination', function (page) {
    currentPage = page;
    applyFilters();
  });
}

function setupProductActionButtons() {
  document.querySelectorAll('#products-list .btn-edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      try {
        var p = JSON.parse(decodeURIComponent(this.dataset.product));
        openProductModal(p);
      } catch (e) {
        showToast('Erro ao abrir produto', 'error');
      }
    });
  });
  document.querySelectorAll('#products-list .btn-duplicate').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        var p = JSON.parse(decodeURIComponent(this.dataset.product));
        console.log('Duplicando produto:', p.name);
        duplicateProduct(p);
      } catch (e) {
        console.error('Erro ao duplicar produto:', e);
        showToast('Erro ao duplicar produto', 'error');
      }
    });
  });
  document.querySelectorAll('#products-list .btn-danger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('delete-product-id').value = this.dataset.productId;
      document.getElementById('delete-product-name').textContent = this.dataset.productName;
      openModal('modal-delete-product');
    });
  });
}

// Make confirmDeleteProduct safe against double-clicks
var _deleting = false;
function confirmDeleteProduct() {
  if (_deleting) return;
  if (adminEditingRestaurantId) return;
  var id = document.getElementById('delete-product-id').value;
  if (!id) return;
  _deleting = true;
  showLoading();
  api.deleteProduct(id).then(function () {
    showToast('Produto excluído!', 'success');
    closeModal('modal-delete-product');
    _deleting = false;
    return loadProducts();
  }).catch(function (e) {
    showToast('Erro ao excluir: ' + e.message, 'error');
    _deleting = false;
  }).finally(function () {
    hideLoading();
    _deleting = false;
  });
}

function setupDragDrop() {
  var items = document.querySelectorAll('#products-list .product-item');
  items.forEach(function (item) {
    item.addEventListener('dragstart', function (e) {
      dragSourceEl = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.dataset.productId);
    });
    item.addEventListener('dragend', function () {
      this.classList.remove('dragging');
      dragSourceEl = null;
      document.querySelectorAll('.product-item').forEach(function (el) { el.classList.remove('drag-over'); });
    });
    item.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.product-item').forEach(function (el) { el.classList.remove('drag-over'); });
      this.classList.add('drag-over');
    });
    item.addEventListener('dragleave', function () {
      this.classList.remove('drag-over');
    });
    item.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      if (dragSourceEl && dragSourceEl !== this) {
        var list = document.getElementById('products-list');
        var allItems = Array.from(list.querySelectorAll('.product-item'));
        var fromIndex = allItems.indexOf(dragSourceEl);
        var toIndex = allItems.indexOf(this);
        if (fromIndex < toIndex) {
          this.parentNode.insertBefore(dragSourceEl, this.nextSibling);
        } else {
          this.parentNode.insertBefore(dragSourceEl, this);
        }
        persistSortOrder();
      }
    });
  });
}

function persistSortOrder() {
  var items = document.querySelectorAll('#products-list .product-item');
  var promises = [];
  items.forEach(function (item, idx) {
    var id = item.dataset.productId;
    promises.push(api.updateProduct(id, { sort_order: idx }));
  });
  showLoading();
  Promise.all(promises).then(function () {
    loadProducts();
  }).catch(function (e) {
    showToast('Erro ao salvar ordem', 'error');
  }).finally(function () {
    hideLoading();
  });
}

function renderPagination(totalPages, containerId, callback) {
  var el = document.getElementById(containerId);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  var html = '';
  for (var i = 1; i <= totalPages; i++) {
    html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
  }
  el.innerHTML = html;
  el.querySelectorAll('.page-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      callback(parseInt(this.dataset.page));
    });
  });
}

function loadContactInfo() {
  api.fetchAdminSettings().then(function (result) {
    var el = document.getElementById('contact-info');
    if (!result.data) {
      el.innerHTML = '<div class="empty-state">Nenhuma informação de contato configurada</div>';
      return;
    }
    var s = result.data;
    var html = '<div class="contact-grid">';
    if (s.whatsapp) html += '<div class="contact-item"><span class="contact-label">WhatsApp</span><span class="contact-value">' + escapeHtml(s.whatsapp) + '</span></div>';
    if (s.phone) html += '<div class="contact-item"><span class="contact-label">Telefone</span><span class="contact-value">' + escapeHtml(s.phone) + '</span></div>';
    if (s.email) html += '<div class="contact-item"><span class="contact-label">E-mail</span><span class="contact-value">' + escapeHtml(s.email) + '</span></div>';
    if (s.business_hours) html += '<div class="contact-item"><span class="contact-label">Horários</span><span class="contact-value">' + escapeHtml(s.business_hours) + '</span></div>';
    html += '</div>';
    el.innerHTML = html;
  }).catch(function () {
    document.getElementById('contact-info').innerHTML = '<div class="empty-state">Erro ao carregar contato</div>';
  });
}

function openProductModal(product) {
  var title = document.getElementById('modal-product-title');
  var form = document.getElementById('product-form');
  form.reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-image-preview').style.display = 'none';
  document.getElementById('prod-image-preview').src = '';
  aiGeneratedDescription = '';

  var catSel = document.getElementById('prod-categoria');
  catSel.innerHTML = '<option value="">Selecione...</option>';
  ['Bebidas', 'Entradas', 'Pratos Principais', 'Sobremesas', 'Porções', 'Combos'].forEach(function (c) {
    catSel.innerHTML += '<option value="' + c + '">' + c + '</option>';
  });

  if (product) {
    title.textContent = 'Editar Produto';
    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-nome').value = product.name || '';
    document.getElementById('prod-preco').value = product.price || '';
    document.getElementById('prod-categoria').value = product.category || '';
    document.getElementById('prod-gourmet').value = product.gourmet_name || '';
    document.getElementById('prod-descricao').value = product.description || '';
document.getElementById('prod-destaque').checked = !!product.is_highlight;
    document.getElementById('prod-promocao').checked = !!product.is_promotion;
    document.getElementById('prod-preco-antigo').value = product.old_price || '';
    document.getElementById('prod-preco-antigo-wrap').style.display = product.is_promotion ? 'block' : 'none';
    if (product.image_url) {
      document.getElementById('prod-image-preview').src = product.image_url;
      document.getElementById('prod-image-preview').style.display = 'block';
    }
  } else {
    title.textContent = 'Novo Produto';
    document.getElementById('prod-promocao').checked = false;
    document.getElementById('prod-preco-antigo').value = '';
    document.getElementById('prod-preco-antigo-wrap').style.display = 'none';
  }
  openModal('modal-product');
}

function duplicateProduct(product) {
  console.log('Iniciando duplicação do produto:', product ? product.name : 'null');
  if (!product || !product.name) {
    showToast('Produto inválido para duplicação', 'error');
    return;
  }
  if (!currentRestaurant || !currentRestaurant.id) {
    showToast('Restaurante não identificado', 'error');
    return;
  }
  var duplicated = {
    name: product.name + ' (cópia)',
    price: product.price,
    category: product.category || null,
    gourmet_name: product.gourmet_name || null,
    description: product.description || null,
    is_highlight: product.is_highlight ? 1 : 0,
    image_url: product.image_url || null
  };
  console.log('Duplicando:', JSON.stringify(duplicated));
  showLoading();
  api.createProduct(currentRestaurant.id, duplicated).then(function (r) {
    console.log('Produto duplicado com sucesso:', r);
    showToast('Produto duplicado com sucesso!');
    loadProducts();
    fetchStats();
  }).catch(function (err) {
    console.error('Erro ao duplicar produto:', err);
    showToast('Erro ao duplicar: ' + (err.message || 'erro desconhecido'), 'error');
  }).finally(function () {
    hideLoading();
  });
}

function saveProduct() {
  var productId = document.getElementById('prod-id').value;
  var nome = document.getElementById('prod-nome').value.trim();
  var preco = parseFloat(document.getElementById('prod-preco').value);
  var categoria = document.getElementById('prod-categoria').value;
  var gourmet = document.getElementById('prod-gourmet').value.trim();
  var descricao = document.getElementById('prod-descricao').value.trim();
  var destaque = document.getElementById('prod-destaque').checked;
  var promocao = document.getElementById('prod-promocao').checked;
  var precoAntigo = parseFloat(document.getElementById('prod-preco-antigo').value);
  var fileInput = document.getElementById('prod-image');

  if (!nome) { showToast('Nome do produto é obrigatório', 'warning'); return; }
  if (!preco || isNaN(preco)) { showToast('Preço inválido', 'warning'); return; }

  showLoading();

  var saveData = {
    name: nome,
    price: preco,
    category: categoria || null,
    gourmet_name: gourmet || null,
    description: descricao || null,
    is_highlight: destaque,
    is_promotion: promocao,
    old_price: (promocao && precoAntigo && !isNaN(precoAntigo)) ? precoAntigo : null,
    valid_from: document.getElementById('prod-valid-from') ? document.getElementById('prod-valid-from').value || null : null,
    valid_until: document.getElementById('prod-valid-until') ? document.getElementById('prod-valid-until').value || null : null,
    is_active: true
  };

  var chain = Promise.resolve();
  if (fileInput.files[0]) {
    chain = api.uploadImage(fileInput.files[0]).then(function (url) {
      saveData.image_url = url;
    });
  }

  chain.then(function () {
    if (productId) {
      return api.updateProduct(productId, saveData);
    }
    saveData.sort_order = allProducts.length;
    return api.createProduct(currentRestaurant.id, saveData);
  }).then(function (result) {
    showToast(productId ? 'Produto atualizado!' : 'Produto criado!', 'success');
    closeModal('modal-product');
    loadProducts();
  }).catch(function (e) {
    showToast('Erro ao salvar produto: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

// ===== CONFIG =====
function mountConfig() {
  console.log('mountConfig called, currentRestaurant:', !!currentRestaurant);
  if (!currentRestaurant) {
    console.log('Carregando restaurante para config...');
    loadRestaurant().then(function(rest) {
      console.log('Restaurante carregado:', !!rest);
      fillConfigForm();
    }).catch(function(e) {
      console.error('Erro loadRestaurant:', e);
      fillConfigForm();
    });
    return;
  }
  fillConfigForm();
}

function fillConfigForm() {
  var rest = currentRestaurant;
  if (!rest) {
    console.log('fillConfigForm: no restaurant');
    document.getElementById('view-config').innerHTML = '<div class="empty-state">Carregando configurações...</div>';
    return;
  }
  console.log('fillConfigForm: restaurant found', rest.name);

  document.getElementById('config-nome').value = rest.name || '';
  document.getElementById('config-telefone').value = rest.phone || '';
  document.getElementById('config-categoria').value = rest.category || '';

  // White-label fields
  if (document.getElementById('config-primary-color')) document.getElementById('config-primary-color').value = rest.primary_color || '#FF4500';
  if (document.getElementById('config-secondary-color')) document.getElementById('config-secondary-color').value = rest.secondary_color || '#16A34A';
  if (document.getElementById('config-font')) document.getElementById('config-font').value = rest.font_family || 'Instrument Sans';

  if (rest.logo_url) {
    var logoPreview = document.getElementById('config-logo-preview');
    logoPreview.src = rest.logo_url;
    logoPreview.style.display = 'block';
  }
  if (rest.banner_url) {
    var bannerPreview = document.getElementById('config-banner-preview');
    bannerPreview.src = rest.banner_url;
    bannerPreview.style.display = 'block';
  }

  var qrContainer = document.getElementById('qrcode-container');
  qrContainer.innerHTML = '';
  var menuUrl = window.location.origin + '/menu.html?slug=' + rest.slug;
  new QRCode(qrContainer, {
    text: menuUrl,
    width: 200,
    height: 200,
    colorDark: '#1A1A1A',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  // Mostrar botão "Ver Cardápio"
  var viewMenuBtn = document.getElementById('btn-view-menu');
  if (viewMenuBtn) {
    viewMenuBtn.href = menuUrl;
    viewMenuBtn.style.display = 'inline-flex';
  }

  mountSchedules();
}

function saveConfig() {
  if (!currentRestaurant || !currentRestaurant.id) {
    showToast('Nenhum restaurante encontrado. Faça login ou crie um restaurante.', 'error');
    return;
  }

  var nome = document.getElementById('config-nome').value.trim();
  var telefone = document.getElementById('config-telefone').value.trim();
  var categoria = document.getElementById('config-categoria').value;
  var logoInput = document.getElementById('config-logo');
  var bannerInput = document.getElementById('config-banner');

  if (!nome) { showToast('Nome é obrigatório', 'warning'); return; }

  showLoading();

  var updateData = { name: nome, phone: telefone || null, category: categoria || null };

  // White-label
  var pc = document.getElementById('config-primary-color');
  var sc = document.getElementById('config-secondary-color');
  var ff = document.getElementById('config-font');
  if (pc) updateData.primary_color = pc.value;
  if (sc) updateData.secondary_color = sc.value;
  if (ff) updateData.font_family = ff.value;

  function doUpload(input) {
    if (!input || !input.files || !input.files[0]) return Promise.resolve(null);
    return api.uploadImage(input.files[0]);
  }

  Promise.all([doUpload(logoInput), doUpload(bannerInput)]).then(function (urls) {
    if (urls[0]) updateData.logo_url = urls[0];
    if (urls[1]) updateData.banner_url = urls[1];
    return api.updateRestaurant(currentRestaurant.id, updateData);
  }).then(function (result) {
    showToast('Configurações salvas!', 'success');
    if (updateData.logo_url) currentRestaurant.logo_url = updateData.logo_url;
    if (updateData.banner_url) currentRestaurant.banner_url = updateData.banner_url;
    currentRestaurant.name = nome;
    currentRestaurant.phone = telefone;
    currentRestaurant.category = categoria;
    // Re-render config form with updated data
    fillConfigForm();
  }).catch(function (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

// ===== ORDERS PANEL =====
var ordersEventSource = null;

function mountOrders() {
  if (!currentRestaurant) {
    loadRestaurant().then(function() { renderOrders(); }).catch(renderOrders);
  } else {
    renderOrders();
  }
}

function renderOrders() {
  if (!currentRestaurant) { document.getElementById('orders-list').innerHTML = '<div class="empty-state">Carregando...</div>'; return; }
  loadOrders();

  // SSE for real-time
  if (ordersEventSource) ordersEventSource.close();
  try {
    ordersEventSource = new EventSource(window.__CONFIG__.apiUrl + '/api/orders/' + currentRestaurant.id + '/sse');
    ordersEventSource.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'new_order') {
          showToast('Novo pedido recebido!', 'success');
          loadOrders();
          updateOrdersBadge();
        }
      } catch (err) {}
    };
    ordersEventSource.onerror = function () { /* SSE connection lost - will auto-reconnect */ };
  } catch (e) { console.warn('SSE not available:', e); }
}

function loadOrders() {
  var status = document.getElementById('orders-filter-status');
  var statusVal = status ? status.value : 'all';
  var listEl = document.getElementById('orders-list');
  listEl.innerHTML = '<div class="loading-cell">Carregando pedidos...</div>';

  api.fetchOrders(currentRestaurant.id, statusVal === 'all' ? null : statusVal).then(function (result) {
    var orders = result.data || [];
    if (orders.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Nenhum pedido</h3><p>Os pedidos feitos pelos clientes aparecerão aqui em tempo real.</p></div>';
      return;
    }
    var html = '';
    orders.forEach(function (order) {
      var items = [];
      try { items = JSON.parse(order.items || '[]'); } catch (e) {}
      var statusClass = order.status === 'pending' ? 'badge-highlight' : order.status === 'preparing' ? 'badge-warning' : order.status === 'done' ? 'badge-success' : 'badge-category';
      var statusLabel = order.status === 'pending' ? 'Pendente' : order.status === 'preparing' ? 'Preparando' : order.status === 'done' ? 'Pronto' : 'Entregue';
      var mesaHtml = order.table_number ? 'Mesa ' + order.table_number : 'Sem mesa';
      var obsHtml = order.observations ? '<div class="order-obs">📝 ' + escapeHtml(order.observations) + '</div>' : '';
      var itemsHtml = items.map(function (item) {
        return '<div class="order-item-line"><span>' + item.quantity + 'x ' + escapeHtml(item.name || '') + '</span><span>' + formatPrice(item.price * item.quantity) + '</span></div>';
      }).join('');
      html += '<div class="order-card" data-order-id="' + order.id + '">'
        + '<div class="order-header">'
        + '<span class="order-mesa">' + mesaHtml + '</span>'
        + '<span class="order-time">' + formatDate(order.created_at) + '</span>'
        + '<span class="badge ' + statusClass + '">' + statusLabel + '</span>'
        + '</div>'
        + obsHtml
        + '<div class="order-items">' + itemsHtml + '</div>'
        + '<div class="order-footer">'
        + '<span class="order-total">Total: ' + formatPrice(order.total) + '</span>'
        + '<div class="order-actions">'
        + (order.status === 'pending' ? '<button class="btn btn-sm btn-primary" onclick="setOrderStatus(\'' + order.id + '\',\'preparing\')">Preparar</button>' : '')
        + (order.status === 'preparing' ? '<button class="btn btn-sm btn-success" onclick="setOrderStatus(\'' + order.id + '\',\'done\')">Pronto</button>' : '')
        + (order.status === 'done' ? '<button class="btn btn-sm btn-secondary" onclick="setOrderStatus(\'' + order.id + '\',\'delivered\')">Entregue</button>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    });
    listEl.innerHTML = html;
    updateOrdersBadge();
  }).catch(function (e) {
    listEl.innerHTML = '<div class="error-cell">Erro ao carregar pedidos: ' + e.message + '</div>';
  });
}

function setOrderStatus(orderId, status) {
  showLoading();
  api.updateOrderStatus(orderId, status).then(function () {
    showToast('Status atualizado!', 'success');
    loadOrders();
  }).catch(function (e) {
    showToast('Erro: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

function updateOrdersBadge() {
  if (!currentRestaurant) return;
  api.fetchOrders(currentRestaurant.id, 'pending').then(function (result) {
    var count = (result.data || []).length;
    var badge = document.getElementById('orders-badge');
    var label = document.getElementById('orders-sidebar-label');
    if (badge) {
      if (count > 0) { badge.textContent = count + ' pendente' + (count > 1 ? 's' : ''); badge.style.display = 'inline'; }
      else badge.style.display = 'none';
    }
    if (label && count > 0) label.textContent = 'Pedidos (' + count + ')';
    else if (label) label.textContent = 'Pedidos';
  }).catch(function () {});
}

// ===== QR CODE PRINT =====
function mountQRCode() {
  if (!currentRestaurant) {
    loadRestaurant().then(fillQRForm).catch(fillQRForm);
  } else {
    fillQRForm();
  }
}

function fillQRForm() {
  // nothing special needed
}

// ===== SCHEDULES (PERIOD AUTOMATION) =====
function mountSchedules() {
  if (!currentRestaurant) return;
  var container = document.getElementById('schedules-list');
  if (!container) return;
  api.fetchSchedules(currentRestaurant.id).then(function (result) {
    var schedules = result.data || [];
    if (schedules.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhum horário configurado. O cardápio fica visível o tempo todo.</div>';
      return;
    }
    var html = '';
    schedules.forEach(function (s) {
      html += '<div class="schedule-item">'
        + '<span class="schedule-period">' + escapeHtml(s.period) + '</span>'
        + '<span class="schedule-time">' + s.start_time + ' às ' + s.end_time + '</span>'
        + '<span class="schedule-cats">' + escapeHtml(s.categories || 'Todas as categorias') + '</span>'
        + '<button class="btn btn-sm btn-danger" onclick="deleteSchedule(\'' + s.id + '\')">Excluir</button>'
        + '</div>';
    });
    container.innerHTML = html;
  }).catch(function () {});
}

function deleteSchedule(id) {
  if (!confirm('Excluir este horário?')) return;
  api.deleteSchedule(id).then(function () {
    showToast('Horário excluído!', 'success');
    mountSchedules();
  }).catch(function (e) {
    showToast('Erro: ' + e.message, 'error');
  });
}

// ===== REPORTS =====
function mountReports() {
  if (!currentRestaurant) {
    loadRestaurant().then(renderReports).catch(renderReports);
    return;
  }
  renderReports();
}

function renderReports() {
  if (!currentRestaurant) return;
  var rid = currentRestaurant.id;
  api.fetchReports(rid).then(function (result) {
    var d = result.data || {};
    document.getElementById('report-total-orders').textContent = d.total_orders || 0;
    document.getElementById('report-revenue').textContent = formatPrice(d.total_revenue || 0);
    var avg = d.total_orders > 0 ? (d.total_revenue / d.total_orders) : 0;
    document.getElementById('report-avg-ticket').textContent = formatPrice(avg);
    document.getElementById('btn-export-csv').href = api.exportOrdersCSV(rid);

    // Orders by day chart
    var daysEl = document.getElementById('report-chart-orders');
    var days = d.orders_by_day || [];
    if (days.length === 0) {
      daysEl.innerHTML = '<div class="empty-state">Nenhum pedido ainda</div>';
    } else {
      var maxCount = Math.max.apply(null, days.map(function (d2) { return d2.count; })) || 1;
      var html = '<div style="display:flex;align-items:end;gap:8px;height:180px;padding:0 16px;">';
      days.slice(0, 14).reverse().forEach(function (day) {
        var h = Math.max(4, (day.count / maxCount) * 160);
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">'
          + '<span style="font-size:11px;color:#EDE3D0;">' + day.count + '</span>'
          + '<div style="width:100%;height:' + h + 'px;background:linear-gradient(180deg,#FF4500,#E03D00);border-radius:4px 4px 0 0;min-height:4px;"></div>'
          + '<span style="font-size:9px;color:#7A6E62;transform:rotate(-45deg);white-space:nowrap;">' + (day.day || '').slice(5) + '</span>'
          + '</div>';
      });
      html += '</div>';
      daysEl.innerHTML = html;
    }

    // Top products
    var topEl = document.getElementById('report-chart-top');
    var top = d.top_products || [];
    if (top.length === 0) {
      topEl.innerHTML = '<div class="empty-state">Nenhum produto vendido</div>';
    } else {
      var maxQty = Math.max.apply(null, top.map(function (p) { return p.quantity; })) || 1;
      var html2 = '<div style="display:flex;flex-direction:column;gap:8px;width:100%;">';
      top.slice(0, 10).forEach(function (p) {
        var w = Math.max(4, (p.quantity / maxQty) * 100);
        html2 += '<div style="display:flex;align-items:center;gap:12px;">'
          + '<span style="font-size:13px;color:#EDE3D0;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(p.name) + '</span>'
          + '<div style="flex:1;height:24px;background:#252018;border-radius:4px;overflow:hidden;">'
          + '<div style="height:100%;width:' + w + '%;background:linear-gradient(90deg,#FF4500,#FF6B2C);border-radius:4px;display:flex;align-items:center;padding-left:8px;">'
          + '<span style="font-size:11px;color:#fff;font-weight:600;">' + p.quantity + 'x</span></div></div>'
          + '<span style="font-size:12px;color:#FF4500;min-width:70px;text-align:right;">' + formatPrice(p.revenue) + '</span>'
          + '</div>';
      });
      html2 += '</div>';
      topEl.innerHTML = html2;
    }

    // Status breakdown
    var statusEl = document.getElementById('report-status-list');
    var statuses = d.orders_by_status || [];
    if (statuses.length === 0) {
      statusEl.innerHTML = '<div class="empty-state">Nenhum pedido</div>';
    } else {
      var labels = { pending: 'Pendentes', preparing: 'Preparando', done: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado' };
      var html3 = '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
      statuses.forEach(function (s) {
        html3 += '<div style="flex:1;min-width:100px;text-align:center;padding:20px;background:#1A140C;border:1px solid #252018;border-radius:8px;">'
          + '<div style="font-family:Syne,sans-serif;font-size:28px;font-weight:700;color:#FF4500;">' + s.count + '</div>'
          + '<div style="font-size:12px;color:#7A6E62;margin-top:4px;">' + (labels[s.status] || s.status) + '</div>'
          + '</div>';
      });
      html3 += '</div>';
      statusEl.innerHTML = html3;
    }
  }).catch(function (e) {
    showToast('Erro ao carregar relatórios: ' + e.message, 'error');
  });
}

// ===== STAFF MANAGEMENT =====
function mountStaff() {
  isAdmin(currentUser.email).then(function (isAdm) {
    if (!isAdm) { window.location.hash = '#/'; return; }
    loadStaffTable();
  });
}

function loadStaffTable() {
  var tbody = document.getElementById('staff-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">Carregando...</td></tr>';
  api.fetchStaff().then(function (result) {
    var staff = result.data || [];
    if (staff.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nenhum membro da equipe</td></tr>';
      return;
    }
    var labels = { owner: 'Proprietário', kitchen: 'Cozinha', waiter: 'Garçom' };
    var html = staff.map(function (u) {
      return '<tr><td>' + escapeHtml(u.name) + '</td><td>' + escapeHtml(u.email) + '</td><td>' + (labels[u.role] || u.role) + '</td><td>' + formatDate(u.created_at) + '</td></tr>';
    }).join('');
    tbody.innerHTML = html;
  }).catch(function () {
    tbody.innerHTML = '<tr><td colspan="4" class="error-cell">Erro ao carregar</td></tr>';
  });
}

// ===== PUSH SUBSCRIPTION =====
function subscribePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'granted') {
    doSubscribePush();
    return;
  }
  Notification.requestPermission().then(function (perm) {
    if (perm === 'granted') doSubscribePush();
  });
}

function doSubscribePush() {
  navigator.serviceWorker.ready.then(function (reg) {
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: null }).then(function (sub) {
      if (currentRestaurant) {
        api.subscribePush({
          restaurant_id: currentRestaurant.id,
          endpoint: sub.endpoint,
          keys: sub.toJSON().keys
        }).catch(function () {});
      }
    }).catch(function () {});
  }).catch(function () {});
}

// ===== IMAGE ZOOM ON MENU =====
function setupImageZoom() {
  document.querySelectorAll('.product-img').forEach(function (img) {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function (e) {
      e.stopPropagation();
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
      overlay.addEventListener('click', function () { overlay.remove(); });
      var fullImg = document.createElement('img');
      fullImg.src = this.src;
      fullImg.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain;';
      overlay.appendChild(fullImg);
      document.body.appendChild(overlay);
    });
  });
}

// Extend product grid render setup to add zoom
var origRenderProductGrid = typeof renderProductGrid === 'function' ? renderProductGrid : null;
if (!origRenderProductGrid && typeof window !== 'undefined') {
  // Hook into menu.js renderProductGrid using MutationObserver
  var zoomObserver = new MutationObserver(function () {
    setupImageZoom();
  });
  var menuRoot = document.getElementById('menu-root');
  if (menuRoot) zoomObserver.observe(menuRoot, { childList: true, subtree: true });
}

// ===== ADMIN =====
function mountAdmin() {
  isAdmin(currentUser.email).then(function (isAdm) {
    if (!isAdm) { window.location.hash = '#/'; return; }
    loadAdminData();
  });
}

function loadAdminData() {
  var tbody = document.getElementById('admin-restaurants-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Carregando...</td></tr>';

  api.fetchRestaurants().then(function (result) {
    var restaurants = result.data || [];
    document.getElementById('admin-stat-total').textContent = restaurants.length;
    document.getElementById('admin-stat-active').textContent = restaurants.filter(function (r) { return r.is_active; }).length;
    document.getElementById('admin-stat-inactive').textContent = restaurants.length - restaurants.filter(function (r) { return r.is_active; }).length;

    if (restaurants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Nenhum restaurante encontrado</td></tr>';
      return;
    }

    var html = '';
    restaurants.forEach(function (r) {
      var statusHtml = r.is_active
        ? '<span class="badge badge-active">Ativo</span>'
        : '<span class="badge badge-inactive">Inativo</span>';
      html += '<tr>'
        + '<td>' + escapeHtml(r.name) + '</td>'
        + '<td>' + escapeHtml(r.slug) + '</td>'
        + '<td>' + escapeHtml(r.plan || 'starter') + '</td>'
        + '<td>' + statusHtml + '</td>'
        + '<td>' + formatDate(r.created_at) + '</td>'
        + '<td class="actions-cell">'
        + '<button class="btn btn-sm btn-primary" onclick="window.open(\'menu.html?slug=' + r.slug + '\', \'_blank\')">Ver Cardápio</button>'
        + '<button class="btn btn-sm btn-edit" onclick="window.location.hash=\'#/admin/restaurant?id=' + r.id + '\'">Editar</button>'
        + '<button class="btn btn-sm btn-danger" onclick="confirmDeleteRestaurant(\'' + r.id + '\',\'' + escapeHtml(r.name).replace(/'/g, '\\\'') + '\')">Excluir</button>'
        + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }).catch(function (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Erro ao carregar</td></tr>';
    showToast('Erro ao carregar dados: ' + e.message, 'error');
  });
}

// ===== ADMIN CONFIG =====
function mountAdminConfig() {
  api.fetchAdminSettings().then(function (result) {
    if (!result.data) return;
    var s = result.data;
    document.getElementById('admin-cfg-phone').value = s.phone || '';
    document.getElementById('admin-cfg-whatsapp').value = s.whatsapp || '';
    document.getElementById('admin-cfg-email').value = s.email || '';
    document.getElementById('admin-cfg-hours').value = s.business_hours || '';
  }).catch(function (e) {
    showToast('Erro ao carregar configurações', 'error');
  });
}

function saveAdminConfig() {
  var phone = document.getElementById('admin-cfg-phone').value.trim();
  var whatsapp = document.getElementById('admin-cfg-whatsapp').value.trim();
  var email = document.getElementById('admin-cfg-email').value.trim();
  var hours = document.getElementById('admin-cfg-hours').value.trim();

  showLoading();
  api.upsertAdminSettings({
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: email || null,
    business_hours: hours || null
  }).then(function () {
    showToast('Configurações salvas!', 'success');
  }).catch(function (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

// ===== ADMIN EDIT RESTAURANT =====
function mountAdminRestaurant() {
  var id = getQueryParam('id');
  if (!id) { showToast('ID do restaurante não informado', 'error'); return; }
  adminEditingRestaurantId = id;

  api.fetchRestaurantById(id).then(function (result) {
    var r = result.data;
    document.getElementById('admin-rest-nome').value = r.name || '';
    document.getElementById('admin-rest-slug').value = r.slug || '';
    document.getElementById('admin-rest-telefone').value = r.phone || '';
    document.getElementById('admin-rest-categoria').value = r.category || '';
    document.getElementById('admin-rest-plano').value = r.plan || 'starter';
    document.getElementById('admin-rest-active').checked = r.is_active !== false;
  }).catch(function (e) {
    showToast('Erro ao carregar restaurante: ' + e.message, 'error');
  });
}

function saveAdminRestaurant() {
  var nome = document.getElementById('admin-rest-nome').value.trim();
  var slug = document.getElementById('admin-rest-slug').value.trim();
  var telefone = document.getElementById('admin-rest-telefone').value.trim();
  var categoria = document.getElementById('admin-rest-categoria').value;
  var plano = document.getElementById('admin-rest-plano').value;
  var active = document.getElementById('admin-rest-active').checked;

  if (!nome || !slug) { showToast('Nome e slug são obrigatórios', 'warning'); return; }

  showLoading();
  api.updateRestaurant(adminEditingRestaurantId, {
    name: nome,
    slug: slug,
    phone: telefone || null,
    category: categoria || null,
    plan: plano,
    is_active: active
  }).then(function () {
    showToast('Restaurante atualizado!', 'success');
  }).catch(function (e) {
    showToast('Erro ao atualizar: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

function confirmDeleteRestaurant(id, name) {
  document.getElementById('delete-rest-id').value = id;
  document.getElementById('delete-rest-name').textContent = name;
  openModal('modal-delete-restaurant');
}

function execDeleteRestaurant() {
  var id = document.getElementById('delete-rest-id').value;
  if (!id) return;
  showLoading();
  api.deleteRestaurant(id).then(function () {
    showToast('Restaurante excluído!', 'success');
    closeModal('modal-delete-restaurant');
    loadAdminData();
  }).catch(function (e) {
    showToast('Erro ao excluir: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

// ===== ADMIN PRODUCTS =====
function loadAdminProducts(restaurantId) {
  adminAllProducts = [];
  adminCurrentPage = 1;
  var listEl = document.getElementById('admin-products-list');
  listEl.innerHTML = '<div class="loading-cell">Carregando...</div>';

  api.fetchAllProducts(restaurantId).then(function (result) {
    console.log('Produtos admin carregados:', result.data ? result.data.length : 0);
    adminAllProducts = result.data || [];
    renderAdminProducts();
  }).catch(function (e) {
    console.error('Erro loadAdminProducts:', e);
    listEl.innerHTML = '<div class="error-cell">Erro ao carregar produtos</div>';
    showToast('Erro ao carregar produtos: ' + e.message, 'error');
  });
}

function renderAdminProducts() {
  var listEl = document.getElementById('admin-products-list');
  var searchVal = (document.getElementById('admin-prod-search').value || '').toLowerCase();
  var statusVal = document.getElementById('admin-prod-filter-status').value;

  var filtered = adminAllProducts.filter(function (p) {
    if (searchVal && !(p.name || '').toLowerCase().includes(searchVal) && !(p.description || '').toLowerCase().includes(searchVal)) return false;
    if (statusVal === 'active' && p.is_active === false) return false;
    if (statusVal === 'inactive' && p.is_active !== false) return false;
    return true;
  });

  var perPage = 6;
  var totalPages = Math.ceil(filtered.length / perPage) || 1;
  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
  var start = (adminCurrentPage - 1) * perPage;
  var pageItems = filtered.slice(start, start + perPage);

  if (pageItems.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhum produto encontrado</div>';
    return;
  }

  var html = '';
  pageItems.forEach(function (p) {
    var imgHtml = p.image_url
      ? '<img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" class="product-thumb">'
      : '<div class="product-thumb product-thumb-placeholder">📷</div>';
    var statusBadge = p.is_active !== false
      ? '<span class="badge badge-active">Ativo</span>'
      : '<span class="badge badge-inactive">Inativo</span>';
    html += '<div class="product-item">'
      + imgHtml
      + '<div class="product-info">'
      + '<div class="product-name">' + escapeHtml(p.name) + '</div>'
      + '<div class="product-meta">' + (p.gourmet_name ? '<span class="gourmet-name">' + escapeHtml(p.gourmet_name) + '</span>' : '') + statusBadge + '</div>'
      + '<div class="product-price">' + formatPrice(p.price) + '</div>'
      + '</div>'
      + '<div class="product-actions">'
      + '<button class="btn btn-sm btn-duplicate" data-product-id="' + p.id + '">Duplicar</button>'
      + '<button class="btn btn-sm btn-edit" data-product-id="' + p.id + '">Editar</button>'
      + '<button class="btn btn-sm btn-danger" data-product-id="' + p.id + '" data-product-name="' + escapeHtml(p.name) + '">Excluir</button>'
      + '</div>'
      + '</div>';
  });
  listEl.innerHTML = html;

  listEl.querySelectorAll('.btn-edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prod = adminAllProducts.find(function (p) { return p.id === this.dataset.productId; }.bind(this));
      if (prod) adminOpenProductModal(prod);
    });
  });
  listEl.querySelectorAll('.btn-duplicate').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var prod = adminAllProducts.find(function (p) { return p.id === this.dataset.productId; }.bind(this));
      if (prod) {
        console.log('Duplicando produto (admin):', prod.name);
        adminDuplicateProduct(prod);
      }
    });
  });
  listEl.querySelectorAll('.btn-danger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      adminConfirmDeleteProduct(this.dataset.productId, this.dataset.productName);
    });
  });

  var paginationEl = document.getElementById('admin-prod-pagination');
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
  } else {
    var pagHtml = '';
    for (var i = 1; i <= totalPages; i++) {
      pagHtml += '<button class="page-btn' + (i === adminCurrentPage ? ' active' : '') + '" onclick="adminGoToPage(' + i + ')">' + i + '</button>';
    }
    paginationEl.innerHTML = pagHtml;
  }
}

function adminGoToPage(page) {
  adminCurrentPage = page;
  renderAdminProducts();
}

function adminOpenProductModal(product) {
  var title = document.getElementById('modal-product-title');
  var form = document.getElementById('product-form');
  form.reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-image-preview').style.display = 'none';
  document.getElementById('prod-image-preview').src = '';

  var catSel = document.getElementById('prod-categoria');
  var normalCats = ['Bebidas', 'Entradas', 'Pratos Principais', 'Sobremesas', 'Porções', 'Combos'];
  catSel.innerHTML = '<option value="">Selecione...</option>';
  normalCats.forEach(function (c) {
    catSel.innerHTML += '<option value="' + c + '">' + c + '</option>';
  });

  if (product) {
    title.textContent = 'Editar Produto';
    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-nome').value = product.name || '';
    document.getElementById('prod-preco').value = product.price || '';
    document.getElementById('prod-categoria').value = product.category || '';
    document.getElementById('prod-gourmet').value = product.gourmet_name || '';
    document.getElementById('prod-descricao').value = product.description || '';
    document.getElementById('prod-destaque').checked = !!product.is_highlight;
    if (product.image_url) {
      document.getElementById('prod-image-preview').src = product.image_url;
      document.getElementById('prod-image-preview').style.display = 'block';
    }
  } else {
    title.textContent = 'Novo Produto';
  }

  var newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  newForm.addEventListener('submit', function (e) {
    e.preventDefault();
    saveAdminProduct(document.getElementById('prod-id').value);
  });
  document.getElementById('prod-image').addEventListener('change', function () {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('prod-image-preview').src = e.target.result;
        document.getElementById('prod-image-preview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
  openModal('modal-product');
}

function adminDuplicateProduct(product) {
  console.log('Iniciando duplicação (admin) do produto:', product.name);
  if (!adminEditingRestaurantId) {
    showToast('Restaurante não identificado', 'error');
    return;
  }
  var duplicated = {
    name: product.name + ' (cópia)',
    price: product.price,
    category: product.category,
    gourmet_name: product.gourmet_name || '',
    description: product.description || '',
    highlight: product.highlight || false,
    image_url: product.image_url || ''
  };
  console.log('Dados do produto duplicado (admin):', duplicated);
  api.createProduct(adminEditingRestaurantId, duplicated).then(function (r) {
    console.log('Produto criado com sucesso (admin), recarregando...');
    showToast('Produto duplicado com sucesso!');
    loadAdminProducts();
  }).catch(function (e) {
    console.error('Erro ao duplicar produto (admin):', e);
    showToast('Erro ao duplicar produto: ' + e.message, 'error');
  });
}

function saveAdminProduct(productId) {
  if (!adminEditingRestaurantId) {
    showToast('Restaurante não identificado', 'error');
    return;
  }
  var nome = document.getElementById('prod-nome').value.trim();
  var preco = parseFloat(document.getElementById('prod-preco').value);
  var categoria = document.getElementById('prod-categoria').value;
  var gourmet_name = document.getElementById('prod-gourmet').value.trim();
  var descricao = document.getElementById('prod-descricao').value.trim();
  var destaque = document.getElementById('prod-destaque').checked;
  var fileInput = document.getElementById('prod-image');

  showLoading();

  var saveData = {
    name: nome,
    price: preco,
    category: categoria || null,
    gourmet_name: gourmet_name || null,
    description: descricao || null,
    is_highlight: destaque
  };

  var chain = Promise.resolve();
  if (fileInput.files[0]) {
    chain = api.uploadImage(fileInput.files[0]).then(function (url) {
      saveData.image_url = url;
    });
  }

  chain.then(function () {
    if (productId) {
      return api.updateProduct(productId, saveData);
    }
    saveData.sort_order = adminAllProducts.length;
    return api.createProduct(adminEditingRestaurantId, saveData);
  }).then(function () {
    showToast(productId ? 'Produto atualizado!' : 'Produto criado!', 'success');
    closeModal('modal-product');
    loadAdminProducts(adminEditingRestaurantId);
  }).catch(function (e) {
    showToast('Erro ao salvar produto: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

function adminConfirmDeleteProduct(id, name) {
  document.getElementById('delete-product-id').value = id;
  document.getElementById('delete-product-name').textContent = name;
  openModal('modal-delete-product');
  // The confirm button listener handles both normal and admin flows
  // via the adminEditingRestaurantId check inside handleConfirmDelete
}

function handleConfirmDelete() {
  if (adminEditingRestaurantId) {
    adminDoDeleteProduct();
  } else {
    confirmDeleteProduct();
  }
}

function adminDoDeleteProduct() {
  var prodId = document.getElementById('delete-product-id').value;
  if (!prodId) return;
  showLoading();
  api.deleteProduct(prodId).then(function () {
    showToast('Produto excluído!', 'success');
    closeModal('modal-delete-product');
    loadAdminProducts(adminEditingRestaurantId);
  }).catch(function (e) {
    showToast('Erro ao excluir: ' + e.message, 'error');
  }).finally(function () {
    hideLoading();
  });
}

// ===== INLINE EDIT =====
function setupInlineEdit() {
  document.querySelectorAll('.product-info .product-name').forEach(function (el) {
    el.addEventListener('dblclick', function () {
      if (this.classList.contains('inline-editing')) return;
      var currentText = this.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'inline-edit-input';
      input.value = currentText;
      this.textContent = '';
      this.appendChild(input);
      this.classList.add('inline-editing');
      input.focus();
      input.select();
      var self = this;
      function save() {
        var newVal = input.value.trim();
        if (newVal && newVal !== currentText) {
          var productItem = self.closest('.product-item');
          if (productItem) {
            var prodId = productItem.dataset.productId;
            api.updateProduct(prodId, { name: newVal }).then(function () {
              self.textContent = newVal;
              showToast('Nome atualizado!', 'success');
              loadProducts();
            }).catch(function (e) {
              self.textContent = currentText;
              showToast('Erro ao atualizar: ' + e.message, 'error');
            });
          }
        } else {
          self.textContent = currentText;
        }
        self.classList.remove('inline-editing');
      }
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { self.textContent = currentText; self.classList.remove('inline-editing'); }
      });
    });
  });
}

// ===== ONBOARDING =====
function showOnboarding() {
  if (localStorage.getItem('menuai_onboarding_done')) return;
  var overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.id = 'onboarding-overlay';
  overlay.innerHTML =
    '<div class="onboarding-card">' +
    '<h2>Bem-vindo ao <span>MENU</span>AI</h2>' +
    '<p>Em 3 passos seu cardápio digital está no ar</p>' +
    '<div class="onboarding-steps">' +
    '<div class="onboarding-step"><div class="onboarding-step-icon">1</div><div class="onboarding-step-text"><strong>Adicione produtos</strong> — Vá em "Produtos" e cadastre seus itens com fotos e preços</div></div>' +
    '<div class="onboarding-step"><div class="onboarding-step-icon">2</div><div class="onboarding-step-text"><strong>Configure seu restaurante</strong> — Em "Configurações", coloque nome, logo e WhatsApp</div></div>' +
    '<div class="onboarding-step"><div class="onboarding-step-icon">3</div><div class="onboarding-step-text"><strong>Compartilhe o QR Code</strong> — Imprima e cole nas mesas. Os pedidos chegam no seu WhatsApp!</div></div>' +
    '</div>' +
    '<button class="btn btn-primary btn-lg btn-block" onclick="closeOnboarding()">Começar!</button>' +
    '</div>';
  document.body.appendChild(overlay);
}

function closeOnboarding() {
  var el = document.getElementById('onboarding-overlay');
  if (el) el.remove();
  localStorage.setItem('menuai_onboarding_done', 'true');
}

// Modify renderDashboard to trigger inline edit setup and onboarding
var origRenderFiltered = renderFilteredProducts;
renderFilteredProducts = function (products) {
  origRenderFiltered(products);
  setTimeout(setupInlineEdit, 100);
};

var origMountDashboard = mountDashboard;
mountDashboard = function () {
  origMountDashboard();
  setTimeout(showOnboarding, 1000);
};

// ===== SETUP =====
document.addEventListener('DOMContentLoaded', function () {
  initApp();

  document.getElementById('product-form') && document.getElementById('product-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveProduct();
  });

  document.getElementById('prod-image') && document.getElementById('prod-image').addEventListener('change', function () {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('prod-image-preview');
        if (preview) {
          preview.src = e.target.result;
          preview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('prod-promocao') && document.getElementById('prod-promocao').addEventListener('change', function () {
    var wrap = document.getElementById('prod-preco-antigo-wrap');
    if (wrap) wrap.style.display = this.checked ? 'block' : 'none';
  });

  document.getElementById('config-restaurant-form') && document.getElementById('config-restaurant-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveConfig();
  });

  // Preview logo antes do upload
  function addFilePreview(inputId, previewId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', function () {
      var file = this.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var preview = document.getElementById(previewId);
          if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
  addFilePreview('config-logo', 'config-logo-preview');
  addFilePreview('config-banner', 'config-banner-preview');

  document.getElementById('btn-download-qrcode') && document.getElementById('btn-download-qrcode').addEventListener('click', function () {
    var canvas = document.querySelector('#qrcode-container canvas');
    if (!canvas) { showToast('Gere o QR Code primeiro', 'warning'); return; }
    var link = document.createElement('a');
    link.download = 'qrcode-menu-' + (currentRestaurant ? currentRestaurant.slug : 'menu') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  document.getElementById('btn-copy-link') && document.getElementById('btn-copy-link').addEventListener('click', function () {
    var url = window.location.origin + '/menu.html?slug=' + (currentRestaurant ? currentRestaurant.slug : '');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('Link copiado!', 'success');
      }).catch(function () {
        showToast('Erro ao copiar', 'error');
      });
    } else {
      showToast('Clipboard não disponível', 'warning');
    }
  });

  document.getElementById('admin-config-form') && document.getElementById('admin-config-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveAdminConfig();
  });

  document.getElementById('admin-restaurant-form') && document.getElementById('admin-restaurant-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveAdminRestaurant();
  });

  document.getElementById('btn-admin-delete-restaurant') && document.getElementById('btn-admin-delete-restaurant').addEventListener('click', function () {
    if (adminEditingRestaurantId) {
      confirmDeleteRestaurant(adminEditingRestaurantId, document.getElementById('admin-rest-nome').value);
    }
  });

  document.getElementById('btn-confirm-delete-restaurant') && document.getElementById('btn-confirm-delete-restaurant').addEventListener('click', function () {
    execDeleteRestaurant();
  });

  document.getElementById('admin-restaurant-create-form') && document.getElementById('admin-restaurant-create-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = document.getElementById('mod-rest-nome').value.trim();
    var slug = document.getElementById('mod-rest-slug').value.trim();
    var email = document.getElementById('mod-rest-email').value.trim();
    var plan = document.getElementById('mod-rest-plano').value;
    if (!nome || !slug) { showToast('Nome e slug são obrigatórios', 'warning'); return; }
    showLoading();
    api.createRestaurant({ name: nome, slug: slug, email: email || null, plan: plan }).then(function (result) {
      showToast('Restaurante criado!', 'success');
      closeModal('modal-admin-restaurant');
      document.getElementById('admin-restaurant-create-form').reset();
      loadAdminData();
    }).catch(function (e) {
      showToast('Erro ao criar: ' + e.message, 'error');
    }).finally(function () {
      hideLoading();
    });
  });

  // Confirm delete product (bound once — for both normal and admin flows)
  var confirmBtn = document.getElementById('btn-confirm-delete-product');
  if (confirmBtn && !confirmBtn.dataset.bound) {
    confirmBtn.dataset.bound = '1';
    confirmBtn.addEventListener('click', handleConfirmDelete);
  }

  // Novo produto button (bound once)
  var novoBtn = document.getElementById('btn-novo-produto');
  if (novoBtn && !novoBtn.dataset.bound) {
    novoBtn.dataset.bound = '1';
    novoBtn.addEventListener('click', function () {
      openProductModal(null);
    });
  }

  document.getElementById('prod-search') && document.getElementById('prod-search').addEventListener('input', function () {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById('prod-filter-status') && document.getElementById('prod-filter-status').addEventListener('change', function () {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById('prod-filter-categoria') && document.getElementById('prod-filter-categoria').addEventListener('change', function () {
    currentPage = 1;
    applyFilters();
  });

  var adminSearch = document.getElementById('admin-prod-search');
  if (adminSearch) {
    adminSearch.addEventListener('input', function () {
      adminCurrentPage = 1;
      renderAdminProducts();
    });
  }
  var adminFilter = document.getElementById('admin-prod-filter-status');
  if (adminFilter) {
    adminFilter.addEventListener('change', function () {
      adminCurrentPage = 1;
      renderAdminProducts();
    });
  }
  var btnNovo = document.getElementById('btn-admin-novo-produto');
  if (btnNovo) {
    btnNovo.addEventListener('click', function () {
      adminOpenProductModal(null);
    });
  }
  var btnNovoRest = document.getElementById('btn-novo-restaurante');
  if (btnNovoRest) {
    btnNovoRest.addEventListener('click', function () {
      openModal('modal-admin-restaurant');
    });
  }

  // Orders filter
  document.getElementById('orders-filter-status') && document.getElementById('orders-filter-status').addEventListener('change', function () {
    loadOrders();
  });
  document.getElementById('orders-refresh') && document.getElementById('orders-refresh').addEventListener('click', function () {
    loadOrders();
  });

  // QR Code generator
  document.getElementById('btn-gerar-qr-mesas') && document.getElementById('btn-gerar-qr-mesas').addEventListener('click', function () {
    var inicio = parseInt(document.getElementById('qr-mesa-inicio').value) || 1;
    var fim = parseInt(document.getElementById('qr-mesa-fim').value) || 10;
    if (inicio > fim) { showToast('Mesa inicial deve ser menor que final', 'warning'); return; }
    if (!currentRestaurant || !currentRestaurant.slug) { showToast('Restaurante não configurado', 'error'); return; }
    var container = document.getElementById('qr-mesas-container');
    container.innerHTML = '';
    container.style.display = 'flex';
    var baseUrl = window.location.origin + '/menu.html?slug=' + currentRestaurant.slug;
    for (var m = inicio; m <= fim; m++) {
      (function (mesa) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'text-align:center;background:#fff;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);width:180px;';
        var label = document.createElement('div');
        label.style.cssText = 'font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#111;margin-bottom:8px;';
        label.textContent = 'Mesa ' + mesa;
        wrap.appendChild(label);
        var qrDiv = document.createElement('div');
        wrap.appendChild(qrDiv);
        container.appendChild(wrap);
        setTimeout(function () {
          new QRCode(qrDiv, {
            text: baseUrl + '&mesa=' + mesa,
            width: 150,
            height: 150,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
        }, 50 * mesa);
      })(m);
    }
    showToast((fim - inicio + 1) + ' QR Codes gerados!', 'success');
  });

  // Periodic badge update for orders
  setInterval(function () {
    if (window.location.hash === '#/orders' || window.location.hash === '#/') {
      updateOrdersBadge();
    }
  }, 15000);

  // Schedule
  document.getElementById('btn-add-schedule') && document.getElementById('btn-add-schedule').addEventListener('click', function () {
    if (!currentRestaurant) { showToast('Restaurante não carregado', 'error'); return; }
    var period = document.getElementById('schedule-period').value;
    var start = document.getElementById('schedule-start').value;
    var end = document.getElementById('schedule-end').value;
    var cats = document.getElementById('schedule-cats').value.trim();
    if (!period || !start || !end) { showToast('Preencha período, início e fim', 'warning'); return; }
    showLoading();
    api.createSchedule(currentRestaurant.id, { period: period, start_time: start, end_time: end, categories: cats }).then(function () {
      showToast('Horário adicionado!', 'success');
      document.getElementById('schedule-cats').value = '';
      mountSchedules();
    }).catch(function (e) {
      showToast('Erro: ' + e.message, 'error');
    }).finally(function () {
      hideLoading();
    });
  });

  // Staff creation modal
  document.getElementById('btn-add-staff') && document.getElementById('btn-add-staff').addEventListener('click', function () {
    var email = prompt('Email do novo membro:');
    if (!email) return;
    var name = prompt('Nome:');
    if (!name) return;
    var role = prompt('Função (kitchen = cozinha, waiter = garçom):');
    if (!role || ['kitchen', 'waiter'].indexOf(role) === -1) { showToast('Use kitchen ou waiter', 'warning'); return; }
    var password = prompt('Senha temporária (mín. 6 caracteres):');
    if (!password || password.length < 6) { showToast('Senha deve ter 6+ caracteres', 'warning'); return; }
    showLoading();
    api.registerStaff({ email: email, name: name, role: role, password: password }).then(function () {
      showToast('Membro criado!', 'success');
      loadStaffTable();
    }).catch(function (e) {
      showToast('Erro: ' + e.message, 'error');
    }).finally(function () {
      hideLoading();
    });
  });

  // Push notification subscription (trigger after login)
  if ('Notification' in window && 'serviceWorker' in navigator) {
    setTimeout(subscribePush, 5000);
  }
});
