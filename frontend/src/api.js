export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export const api = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  getMenu: () => request("/menu"),
  getOrders: (token) => request("/orders", { token }),
  createOrder: (items, location, token) =>
    request("/orders", { method: "POST", body: { items, ...location }, token }),
  updateOrderStatus: (orderId, status, token) =>
    request(`/orders/${orderId}/status`, { method: "PATCH", body: { status }, token }),
  getOrderEta: (orderId, token) => request(`/orders/${orderId}/eta`, { token }),
};
