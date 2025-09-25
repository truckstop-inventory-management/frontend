import React, { useState } from "react";

const FloatingAddButton = ({ onClick }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    itemName: "",
    quantity: "",
    price: "",
    location: "C-Store",
  });

  const onChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAdd = () => {
    console.log('[FAB] handleAdd payload about to send:', form);
    if (typeof onClick === "function") {
      onClick({
        itemName: String(form.itemName || "").trim(),
        quantity: form.quantity,
        price: form.price,
        location: form.location || "C-Store",
      });
    }
    setIsModalOpen(false);
    setForm({ itemName: "", quantity: "", price: "", location: "C-Store" });

  };

  return (
    <>
      {/* Floating “+” button */}
      <button
         onClick={() => setIsModalOpen(true)}
         className="fixed z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition"
         style={{
             // keep Tailwind’s spacing, then add safe-area insets
             bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)", // 1.5rem ≈ Tailwind bottom-6
             right:  "calc(env(safe-area-inset-right,  0px) + 1.5rem)",
           }}
         aria-label="Add item"
      >
        +

      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add New Item</h2>

            <div className="mb-4">
              <label className="block text-sm mb-1">Item Name</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                placeholder="Enter item name"
                value={form.itemName}
                onChange={onChange("itemName")}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1">Quantity</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                placeholder="Enter quantity"
                value={form.quantity}
                onChange={onChange("quantity")}
                min="0"
                step="1"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                placeholder="Enter price"
                value={form.price}
                onChange={onChange("price")}
                min="0"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm mb-1">Location</label>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                value={form.location}
                onChange={onChange("location")}
              >
                <option value="C-Store">C-Store</option>
                <option value="Restaurant">Restaurant</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingAddButton;
