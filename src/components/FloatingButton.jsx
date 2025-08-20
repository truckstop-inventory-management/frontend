import React from 'react';

const FloatingButton = ({onClick}) => {
  return (
    <button
    onClick={onClick || (() => console.log("clicked"))}
    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-400 text-white shadow-lg flex items-center justify-center text-3xl hover:bg-blue-700 transition"
    >
      +
    </button>
  );
};

export default FloatingButton;