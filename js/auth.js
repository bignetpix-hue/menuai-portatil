var currentUser = null;
var currentRestaurant = null;

function checkAuth() {
  var token = getToken();
  if (!token) {
    currentUser = null;
    return Promise.resolve(null);
  }
  return api.getMe().then(function (r) {
    currentUser = r.user;
    return currentUser;
  }).catch(function () {
    currentUser = null;
    setToken(null);
    return null;
  });
}

function requireAuth() {
  return checkAuth().then(function (user) {
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    return user;
  });
}

function login(email, password) {
  return api.login(email, password).then(function (r) {
    currentUser = r.user;
    if (r.restaurant) currentRestaurant = r.restaurant;
    return currentUser;
  });
}

function register(data) {
  return api.register(data).then(function (r) {
    currentUser = r.user;
    if (r.restaurant) currentRestaurant = r.restaurant;
    return currentUser;
  });
}

function logout() {
  api.logout();
  currentUser = null;
  currentRestaurant = null;
  window.location.href = 'login.html';
}

function isAdmin(email) {
  if (!currentUser) return Promise.resolve(false);
  if (currentUser.is_admin) return Promise.resolve(true);
  return api.isAdmin().then(function (r) {
    return r.is_admin;
  }).catch(function () {
    return false;
  });
}

function loadRestaurant() {
  if (!currentUser) return Promise.resolve(null);
  return api.fetchRestaurantByUserId(currentUser.id).then(function (r) {
    currentRestaurant = r.data;
    return r.data;
  }).catch(function () {
    return null;
  });
}

function setSecureToken(token) {
  document.cookie = `auth_token=${token}; Secure; HttpOnly; SameSite=Strict`;
}
