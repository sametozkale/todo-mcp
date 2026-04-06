import type { ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

type AppToastOptions = Omit<ExternalToast, "duration"> & {
  duration?: number;
  timeout?: number;
};

function normalizeOptions(options?: AppToastOptions): ExternalToast | undefined {
  if (!options) return undefined;
  const { timeout, duration, ...rest } = options;
  return {
    ...rest,
    duration: duration ?? timeout,
  };
}

type ToastMessage = ReactNode;

export const toast = {
  message(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast(message, normalizeOptions(options));
  },
  success(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast.success(message, normalizeOptions(options));
  },
  info(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast.info(message, normalizeOptions(options));
  },
  warning(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast.warning(message, normalizeOptions(options));
  },
  error(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast.error(message, normalizeOptions(options));
  },
  danger(message: ToastMessage, options?: AppToastOptions) {
    return sonnerToast.error(message, normalizeOptions(options));
  },
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
};
