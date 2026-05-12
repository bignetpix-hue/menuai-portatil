function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatPrice(value) {
  return 'R$ ' + parseFloat(value).toFixed(2).replace('.', ',');
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function whatsappLink(phone, text) {
  const cleaned = phone.replace(/\D/g, '');
  const url = 'https://wa.me/55' + cleaned + '?text=' + encodeURIComponent(text);
  return url;
}

function showToast(message, type) {
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;animation:fadeUp 0.3s ease;';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.style.cssText = 'padding:14px 28px;border-radius:8px;font-size:14px;font-weight:500;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:90vw;text-align:center;font-family:"Instrument Sans",sans-serif;margin-bottom:8px;';
  toast.style.background = type === 'error' ? '#DC2626' : type === 'warning' ? '#F59E0B' : '#16A34A';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 4000);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    el.style.animation = 'fadeIn 0.2s ease';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showLoading(container) {
  if (!container) {
    var existingOverlay = document.getElementById('app-loading-overlay');
    if (existingOverlay) return;
    var overlay = document.createElement('div');
    overlay.id = 'app-loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = '<div class="spinner" style="width:40px;height:40px;border-width:4px"></div>';
    document.body.appendChild(overlay);
    return;
  }
  var existing = container.querySelector('.loading-spinner');
  if (existing) return;
  var spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:#7A6E62;font-size:14px">Carregando...</p></div>';
  container.appendChild(spinner);
}

function hideLoading(container) {
  if (!container) {
    var el = document.getElementById('app-loading-overlay');
    if (el) el.remove();
    return;
  }
  const spinner = container.querySelector('.loading-spinner');
  if (spinner) spinner.remove();
}

function cn() {
  return Array.from(arguments).filter(Boolean).join(' ');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function debounce(fn, ms) {
  let timer;
  return function () {
    var self = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(self, args); }, ms);
  };
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

function getQueryParam(name) {
  var params = new URLSearchParams(window.location.search);
  var result = params.get(name);
  if (!result) {
    var hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    result = hashParams.get(name);
  }
  return result;
}

function apiFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Content-Type'] = 'application/json';
  return fetch(url, options).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || e.message || 'Erro na requisição'); });
    return r.json();
  });
}

function showError(message) {
  console.error(message);
  showToast(message, 'error');
}

function isOnline() {
  return navigator.onLine !== false;
}

function handleOffline() {
  if (!isOnline()) {
    showToast('Sem conexão com a internet', 'warning');
    return false;
  }
  return true;
}
