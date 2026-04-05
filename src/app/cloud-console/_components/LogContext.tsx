"use client";

/**
 * LogContext — shares injectUserAction from layout to service pages.
 * 
 * When a service page does pause/resume/save, it calls injectLog()
 * to immediately add the entry to the LogPanel — no Cloud Logging delay.
 */

import { createContext, useContext } from "react";

interface LogContextValue {
    injectLog: (serviceId: string, message: string, level?: "info" | "warn" | "error" | "success") => void;
    /** Re-fetch logs for a service (after Cloud Logging write settles) */
    refreshLogs: (serviceId: string) => void;
}

const LogContext = createContext<LogContextValue>({
    injectLog: () => {},
    refreshLogs: () => {},
});

export const LogProvider = LogContext.Provider;

export function useLogPanel() {
    return useContext(LogContext);
}
