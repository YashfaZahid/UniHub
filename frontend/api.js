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

export function setAuthSession({ token, access_token, user_id, user }) {
  if (token) localStorage.setItem("token", token);
  if (access_token) localStorage.setItem("supabase_access_token", access_token);
  if (user_id) localStorage.setItem("user_id", user_id);
  if (user) localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("supabase_access_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user");
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

export const createProduct = async (shopId, payload) => {
  const res = await api.post(`/api/shops/${shopId}/products`, payload);
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

export { BASE_URL, api };
