var api = {};

function getToken() {
  return localStorage.getItem('menuai_token');
}

function setToken(token) {
  if (token) localStorage.setItem('menuai_token', token);
  else localStorage.removeItem('menuai_token');
}

function apiCall(method, path, body, retries) {
  retries = retries || 3;
  var opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000)
  };
  var token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  return fetch(window.__CONFIG__.apiUrl + path, opts).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) throw new Error(data.error || 'Erro na requisição');
      return data;
    });
  }).catch(function (err) {
    if (retries > 0 && (err.name === 'TimeoutError' || err.name === 'AbortError' || !navigator.onLine)) {
      return apiCall(method, path, body, retries - 1);
    }
    throw err;
  });
}

api.isAdmin = function () {
  return apiCall('GET', '/api/auth/is-admin');
};

// --- Auth ---
api.login = function (email, password) {
  return apiCall('POST', '/api/auth/login', { email: email, password: password }).then(function (r) {
    setToken(r.token);
    return r;
  });
};

api.register = function (data) {
  return apiCall('POST', '/api/auth/register', data).then(function (r) {
    setToken(r.token);
    return r;
  });
};

api.logout = function () {
  setToken(null);
};

api.getMe = function () {
  return apiCall('GET', '/api/auth/me');
};

// --- Restaurants ---
api.fetchRestaurants = function () {
  return apiCall('GET', '/api/restaurants');
};

api.fetchActiveRestaurants = function () {
  return apiCall('GET', '/api/restaurants').then(function (r) {
    return { data: (r.data || []).filter(function (x) { return x.is_active; }) };
  });
};

api.fetchRestaurantBySlug = function (slug) {
  return apiCall('GET', '/api/restaurants/slug/' + encodeURIComponent(slug));
};

api.fetchRestaurantById = function (id) {
  return apiCall('GET', '/api/restaurants/' + encodeURIComponent(id));
};

api.fetchRestaurantByUserId = function (userId) {
  return apiCall('GET', '/api/restaurants/mine');
};

api.createRestaurant = function (data) {
  return apiCall('POST', '/api/restaurants', data);
};

api.updateRestaurant = function (id, data) {
  return apiCall('PUT', '/api/restaurants/' + encodeURIComponent(id), data);
};

api.deleteRestaurant = function (id) {
  return apiCall('DELETE', '/api/restaurants/' + encodeURIComponent(id));
};

// --- Products ---
api.fetchProducts = function (restaurantId) {
  return apiCall('GET', '/api/restaurants/' + encodeURIComponent(restaurantId) + '/products?status=active');
};

api.fetchAllProducts = function (restaurantId) {
  return apiCall('GET', '/api/restaurants/' + encodeURIComponent(restaurantId) + '/products/all');
};

api.fetchProductsByRestaurant = function (restaurantId, options) {
  options = options || {};
  var params = [];
  if (options.status) params.push('status=' + encodeURIComponent(options.status));
  if (options.category) params.push('category=' + encodeURIComponent(options.category));
  if (options.search) params.push('search=' + encodeURIComponent(options.search));
  if (options.page) params.push('page=' + options.page);
  if (options.pageSize) params.push('pageSize=' + options.pageSize);
  var qs = params.length ? '?' + params.join('&') : '';
  return apiCall('GET', '/api/restaurants/' + encodeURIComponent(restaurantId) + '/products' + qs);
};

api.createProduct = function (restaurantId, data) {
  return apiCall('POST', '/api/restaurants/' + encodeURIComponent(restaurantId) + '/products', data);
};

api.updateProduct = function (id, data) {
  return apiCall('PUT', '/api/products/' + encodeURIComponent(id), data);
};

api.deleteProduct = function (id) {
  return apiCall('DELETE', '/api/products/' + encodeURIComponent(id));
};

// --- Analytics ---
api.trackAnalytics = function (event) {
  return apiCall('POST', '/api/analytics', event);
};

api.fetchAnalytics = function (restaurantId) {
  return apiCall('GET', '/api/analytics/' + encodeURIComponent(restaurantId));
};

api.countAnalytics = function (restaurantId, eventType) {
  return apiCall('GET', '/api/analytics/' + encodeURIComponent(restaurantId) + '/count/' + encodeURIComponent(eventType));
};

// --- Admin Settings ---
api.fetchAdminSettings = function () {
  return apiCall('GET', '/api/admin/settings');
};

api.upsertAdminSettings = function (data) {
  return apiCall('PUT', '/api/admin/settings', data);
};

// --- Upload ---
api.uploadImage = function (file) {
  return new Promise(function (resolve, reject) {
    var formData = new FormData();
    formData.append('file', file);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', window.__CONFIG__.apiUrl + '/api/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
    xhr.onload = function () {
      if (xhr.status === 200) {
        var r = JSON.parse(xhr.responseText);
        resolve(window.__CONFIG__.apiUrl + r.url);
      } else {
        try { var e = JSON.parse(xhr.responseText); reject(new Error(e.error)); }
        catch (ex) { reject(new Error('Erro no upload')); }
      }
    };
    xhr.onerror = function () { reject(new Error('Erro de rede no upload')); };
    xhr.send(formData);
  });
};

// --- Orders ---
api.saveOrder = function (data) {
  return apiCall('POST', '/api/orders', data);
};

api.fetchOrders = function (restaurantId, status) {
  var qs = status ? '?status=' + encodeURIComponent(status) : '';
  return apiCall('GET', '/api/orders/' + encodeURIComponent(restaurantId) + qs);
};

api.updateOrderStatus = function (orderId, status) {
  return apiCall('PUT', '/api/orders/' + encodeURIComponent(orderId) + '/status', { status: status });
};

api.fetchSchedules = function (restaurantId) {
  return apiCall('GET', '/api/schedules/' + encodeURIComponent(restaurantId));
};

api.createSchedule = function (restaurantId, data) {
  return apiCall('POST', '/api/schedules/' + encodeURIComponent(restaurantId), data);
};

api.deleteSchedule = function (id) {
  return apiCall('DELETE', '/api/schedules/' + encodeURIComponent(id));
};

// --- Push ---
api.subscribePush = function (data) {
  return apiCall('POST', '/api/push/subscribe', data);
};

// --- Reports ---
api.fetchReports = function (restaurantId, params) {
  var qs = params ? '?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') : '';
  return apiCall('GET', '/api/reports/' + encodeURIComponent(restaurantId) + qs);
};

api.exportOrdersCSV = function (restaurantId) {
  return window.__CONFIG__.apiUrl + '/api/reports/' + restaurantId + '?format=csv&t=' + Date.now();
};

// --- Staff ---
api.registerStaff = function (data) {
  return apiCall('POST', '/api/auth/register-staff', data);
};

api.fetchStaff = function () {
  return apiCall('GET', '/api/auth/staff');
};

// --- AI ---
api.generateDescription = function (prompt) {
  return apiCall('POST', '/api/ai/description', { prompt: prompt });
};


