import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';

const LOCAL_STORAGE_KEY = 'meticto_mute_preference';

interface SettingsState {
    isMuted: boolean;
}

interface SettingsContextValue extends SettingsState {
    toggleMute: () => void;
}

// Create context with undefined default value (provider is required)
const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [isMuted, setIsMuted] = useState<boolean>(() => {
        // Load initial state from localStorage or default to false (unmuted)
        try {
            const storedValue = localStorage.getItem(LOCAL_STORAGE_KEY);
            return storedValue ? JSON.parse(storedValue) : false;
        } catch (error) {
            console.error("Error reading mute preference from localStorage:", error);
            return false;
        }
    });

    // Effect to save state to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(isMuted));
            if (import.meta.env.DEV) {
                console.log(`[SettingsContext] Mute state ${isMuted ? 'enabled' : 'disabled'} saved to localStorage.`);
            }
        } catch (error) {
            console.error("Error saving mute preference to localStorage:", error);
        }
    }, [isMuted]);

    // Function to toggle mute state
    const toggleMute = useCallback(() => {
        setIsMuted(prevMuted => !prevMuted);
    }, []);

    const value: SettingsContextValue = {
        isMuted,
        toggleMute,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

// Custom hook to consume the context
export const useSettings = (): SettingsContextValue => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
