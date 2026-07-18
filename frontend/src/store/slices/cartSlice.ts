import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PosCartItem = {
  _id: string;
  name: string;
  sku: string;
  brand?: string;
  category?: string;
  size?: string;
  gauge?: string;
  lengthFeet?: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  dealerPrice?: number;
  salePrice: number;
  stockQty: number;
  quantity: number;
  discount: number;
};

type CartState = { items: PosCartItem[] };
const initialState: CartState = { items: [] };

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<Omit<PosCartItem, "quantity" | "discount">>) {
      const product = action.payload;
      const existing = state.items.find((item) => item._id === product._id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, product.stockQty);
      } else {
        state.items.push({ ...product, quantity: 1, discount: 0 });
      }
    },
    updateItem(state, action: PayloadAction<{ id: string; patch: Partial<PosCartItem> }>) {
      const item = state.items.find((row) => row._id === action.payload.id);
      if (item) Object.assign(item, action.payload.patch);
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item._id !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addItem, updateItem, removeItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
