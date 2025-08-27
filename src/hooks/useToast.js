// src/hooks/useToast.js
import { useToastCtx } from "../components/ui/ToastProvider";

export default function useToast() {
  const ctx = useToastCtx();
  return { show: ctx.show, remove: ctx.remove };
}
