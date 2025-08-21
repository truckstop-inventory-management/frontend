import React, { useState } from 'react';

const FloatingAddButton = ({ onClick }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Floating “+” button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition"
      >
        +
      </button>

      {/* Modal (self-contained here) */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add New Item</h2>

            {/* Item Name */}
            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Item Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter item name"
              />
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Quantity</label>
              <input
                type="number"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quantity"
              />
            </div>

            {/* Price */}
            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Price</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter price"
              />
            </div>

            {/* Location */}
            <div className="mb-6">
              <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Location</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter location"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Call your existing App handler exactly as before (no payload changes)
                  if (typeof onClick === 'function') onClick();
                  setIsModalOpen(false);
                }}
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
