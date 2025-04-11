/// <reference types="vite/client" />

interface Window {
    goatcounter?: {
      count: (vars?: { path: string; title?: string; event: boolean; }) => void;
      // Add other methods if needed
    };
  }