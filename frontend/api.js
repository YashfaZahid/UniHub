import axios from "axios";

const BASE_URL = "http://localhost:5000";

export const createShop = async (payload, token) => {
  const res = await axios.post(`${BASE_URL}/api/shops`, payload, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return res.data;
};