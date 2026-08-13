import axios from "axios";

const BASE_URL = "http://localhost:5000";

/** Flask JWT issued by /api/login — preferred for protected Flask routes */
export function getFlaskToken() {
  const token = localStorage.getItem("token");
  if (!token || token === "null" || token === "undefined") return null;
  return token.trim();
}

/** Supabase access_token from login — fallback if Flask JWT missing/expired */
export function getSupabaseAccessToken() {
  const token = localStorage.getItem("supabase_access_token");
  if (!token || token === "null" || token === "undefined") return null;
  return token.trim();
}

/** Token sent as Authorization: Bearer — Flask JWT first, then Supabase */
export function getAuthToken() {
  return getFlaskToken() || getSupabaseAccessToken();
}

export function setAuthSession({ token, access_token, refresh_token, user_id, user }) {
  if (token) localStorage.setItem("token", token);
  if (access_token) localStorage.setItem("supabase_access_token", access_token);
  if (refresh_token) localStorage.setItem("supabase_refresh_token", refresh_token);
  if (user_id) localStorage.setItem("user_id", user_id);
  if (user) localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("supabase_access_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user");
  localStorage.removeItem("supabase_refresh_token");
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) {
      console.log(`[AUTH] ${config.method?.toUpperCase()} ${config.url} — token attached`);
    }
  } else if (import.meta.env.DEV) {
    console.warn(`[AUTH] ${config.method?.toUpperCase()} ${config.url} — no token in localStorage`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("[AUTH] 401 Unauthorized:", error.response?.data);
    }
    return Promise.reject(error);
  }
);

export const createShop = async (formData) => {
  const token = getAuthToken();
  const res = await axios.post(`${BASE_URL}/api/shops`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
};

export const getShop = async (shopId) => {
  const res = await api.get(`/api/shops/${shopId}`);
  return res.data;
};

export const updateShop = async (shopId, formData) => {
  const token = getAuthToken();
  // POST + FormData: PATCH often drops multipart bodies in browsers/axios
  formData.append("shop_id", shopId);
  const res = await axios.post(`${BASE_URL}/api/shops/${shopId}/update`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data.shop ?? res.data;
};

export const getProducts = async (shopId) => {
  const res = await api.get(`/api/shops/${shopId}/products`);
  return res.data;
};

export const getShopInsights = async (shopId) => {
  const res = await api.get(`/api/shops/${shopId}/insights`);
  return res.data;
};

export const createProduct = async (shopId, payload) => {
  const token = getAuthToken();
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
  const res = await axios.post(`${BASE_URL}/api/shops/${shopId}/products`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
};

export const deleteProduct = async (productId) => {
  const res = await api.delete(`/api/products/${productId}`);
  return res.data;
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${BASE_URL}${imagePath}`;
};

export const fetchFeed = async ({ search = "", sort = "newest", page = 0, pageSize = 9 }) => {
  const params = new URLSearchParams({
    search,
    sort,
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await api.get(`/api/shops/feed?${params}`);
  return res.data;
};

export const getProduct = async (productId) => {
  const res = await api.get(`/api/products/${productId}`);
  return res.data;
};

export const updateProduct = async (productId, formData) => {
  const token = getAuthToken();
  const res = await axios.patch(`${BASE_URL}/api/products/${productId}`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data;
};

export const deleteProductImage = async (imageId) => {
  const res = await api.delete(`/api/product-images/${imageId}`);
  return res.data;
};

export const setPrimaryProductImage = async (imageId) => {
  const res = await api.post(`/api/product-images/${imageId}/primary`);
  return res.data;
};

export const uploadProfileAvatar = async (file) => {
  const token = getAuthToken();
  if (!token) {
    const err = new Error("Not authenticated");
    err.response = { status: 401 };
    throw err;
  }
  const formData = new FormData();
  formData.append("avatar", file);
  const res = await axios.post(`${BASE_URL}/api/profile/avatar`, formData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getPublicProfile = async (userId) => {
  const res = await api.get(`/api/profiles/${userId}`);
  return res.data;
};

export const getConversations = async () => {
  const res = await api.get("/api/conversations");
  return res.data;
};

export const startConversation = async (payload) => {
  const res = await api.post("/api/conversations", payload);
  return res.data;
};

export const getMessages = async (conversationId) => {
  const res = await api.get(`/api/conversations/${conversationId}/messages`);
  return res.data;
};

export const sendMessage = async (conversationId, content) => {
  const res = await api.post(`/api/conversations/${conversationId}/messages`, {
    content,
  });
  return res.data;
};

export const markConversationRead = async (conversationId) => {
  const res = await api.post(`/api/conversations/${conversationId}/read`);
  return res.data;
};

export const getOrders = async (role = "buyer") => {
  const res = await api.get(`/api/orders?role=${role}`);
  return res.data;
};

export const createOrder = async (payload) => {
  const res = await api.post("/api/orders", payload);
  return res.data;
};

/** Extract a user-visible error from a Flask API error response. */
export function formatApiError(err, fallback = "Request failed") {
  const data = err?.response?.data;
  if (!data) {
    return err?.message ? `${fallback}: ${err.message}` : fallback;
  }
  const main = typeof data.error === "string" ? data.error : null;
  const detail = typeof data.detail === "string" ? data.detail : null;
  if (main && detail) return `${main} (${detail})`;
  if (main) return main;
  if (detail) return detail;
  return fallback;
}

export const updateOrderStatus = async (orderId, status) => {
  const payload = { status: String(status).trim().toLowerCase() };
  console.log("[ORDER STATUS] request", { orderId, status: payload.status });

  const token = getAuthToken();
  if (!token) {
    const err = new Error("Not authenticated");
    err.response = { status: 401, data: { error: "Please log in again" } };
    throw err;
  }

  const tryRequest = async (method) => {
    if (method === "post") {
      return api.post(`/api/orders/${orderId}/status`, payload);
    }
    return api.patch(`/api/orders/${orderId}/status`, payload);
  };

  try {
    let res;
    try {
      res = await tryRequest("post");
    } catch (postErr) {
      if (postErr.response) throw postErr;
      console.warn("[ORDER STATUS] POST failed, retrying PATCH", postErr.message);
      res = await tryRequest("patch");
    }
    console.log("[ORDER STATUS] response", res.status, res.data);
    return res.data;
  } catch (err) {
    console.error("[ORDER STATUS] error", {
      orderId,
      status: payload.status,
      statusCode: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
};

export const getNotifications = async () => {
  const res = await api.get("/api/notifications");
  return res.data;
};

export const getUnreadNotificationCount = async () => {
  const res = await api.get("/api/notifications/unread-count");
  return res.data.count;
};

export const markNotificationRead = async (id) => {
  const res = await api.post(`/api/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await api.post("/api/notifications/read-all");
  return res.data;
};

export const followUser = async (userId) => {
  const res = await api.post(`/api/profiles/${userId}/follow`);
  return res.data;
};

export { BASE_URL, api };
