"use client";

import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";

export function ProductCategoryPicker({ user, value, onChange }: {
  user: User | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const [categories, setCategories] = useState<string[]>([...DEFAULT_PRODUCT_CATEGORIES]);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/categories")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load categories.");
        if (active && Array.isArray(result.categories)) setCategories(result.categories);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load categories.");
      });
    return () => { active = false; };
  }, []);

  async function addCategory() {
    if (!user) {
      setError("Sign in again to add a category.");
      return;
    }
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: newCategory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this category.");
      setCategories((current) => [...new Set([...current, result.category])].sort((a, b) => a.localeCompare(b)));
      onChange(result.category);
      setNewCategory("");
      setCreating(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this category.");
    }
  }

  return (
    <div className="product-category-picker">
      <label>Category<select name="category" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Choose a category</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select></label>
      <button type="button" className="vendor-outline-button" onClick={() => setCreating((current) => !current)}>{creating ? "Cancel" : "＋ Add category"}</button>
      {creating && <div><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={60} placeholder="New category name" required /><button type="button" className="vendor-outline-button" disabled={!newCategory.trim()} onClick={() => void addCategory()}>Save category</button></div>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
