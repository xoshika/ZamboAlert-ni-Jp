import React, { createContext, useContext, useState, useEffect } from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import { styles } from "../theme/styles";

type ToastType = "success" | "info" | "error";

interface ToastMessage {
  type: ToastType;
  title: string;
  desc?: string;
}

interface ToastContextType {
  success: (title: string, options?: { description?: string }) => void;
  info: (title: string, options?: { description?: string }) => void;
  error: (title: string, options?: { description?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toastMsg, setToastMsg] = useState<ToastMessage | null>(null);
  const insets = useSafeAreaInsets();

  const success = (title: string, options?: { description?: string }) => {
    setToastMsg({ type: "success", title, desc: options?.description });
  };

  const info = (title: string, options?: { description?: string }) => {
    setToastMsg({ type: "info", title, desc: options?.description });
  };

  const error = (title: string, options?: { description?: string }) => {
    setToastMsg({ type: "error", title, desc: options?.description });
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  return (
    <ToastContext.Provider value={{ success, info, error }}>
      {children}
      {toastMsg && (
        <View style={[styles.toastOverlay, { top: insets.top > 0 ? insets.top + 16 : 40 }]}>
          <View style={[styles.toastAlert, toastMsg.type === "success" ? styles.toastSuccess : styles.toastInfo]}>
            <View style={styles.row}>
              <AlertTriangle
                size={14}
                color={toastMsg.type === "success" ? "#16a34a" : "#2563eb"}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.toastTitle}>{toastMsg.title}</Text>
            </View>
            {toastMsg.desc && <Text style={styles.toastDesc}>{toastMsg.desc}</Text>}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
