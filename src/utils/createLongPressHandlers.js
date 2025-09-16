// src/utils/createLongPressHandlers.js
export function createLongPressHandlers(onConfirm, { id, threshold = 600, timersRef }) {
  if (!timersRef || !timersRef.current) {
    throw new Error("[createLongPressHandlers] timersRef is required (useRef({}))");
  }

  const start = () => {
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      try {
        onConfirm();
      } finally {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    }, Math.max(0, threshold));
  };

  const stop = () => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: (e) => {
      if (e.cancelable) e.preventDefault();
      start();
    },
    onTouchEnd: stop,
    onTouchCancel: stop,
  };
}
