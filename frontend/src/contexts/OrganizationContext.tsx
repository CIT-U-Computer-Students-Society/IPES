import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface OrganizationContextType {
    activeOrganizationId: number | null;
    setActiveOrganizationId: (id: number | null) => void;
    clearOrganizationState: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
    const [activeOrganizationId, setActiveOrganizationId] = useState<number | null>(() => {
        const stored = localStorage.getItem('activeOrganizationId');
        return stored ? parseInt(stored, 10) : null;
    });

    useEffect(() => {
        if (activeOrganizationId) {
            localStorage.setItem('activeOrganizationId', activeOrganizationId.toString());
        } else {
            localStorage.removeItem('activeOrganizationId');
        }
    }, [activeOrganizationId]);

    const clearOrganizationState = useCallback(() => {
        setActiveOrganizationId(null);
        localStorage.removeItem('activeOrganizationId');
    }, []);

    return (
        <OrganizationContext.Provider value={{ activeOrganizationId, setActiveOrganizationId, clearOrganizationState }}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganizationState = () => {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganizationState must be used within an OrganizationProvider');
    }
    return context;
};
