import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SessionScopeContext, TOUR_SCOPE, resetSessionMemory } from '../ui-utils.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { TourPlayer } from './TourPlayer.jsx';

// Visite guidée : monte une SECONDE instance de l'application (`AppComponent`, en mode visite) sur une copie du
// projet démo, dans un conteneur à part. L'application de l'utilisateur reste montée mais cachée : la visite ne
// partage avec elle ni données, ni mémoire de session (préfixe « tour: »), et ne peut rien sauvegarder.
// `appKey` : changer la clé remonte l'application jouée sur une copie neuve (après une scène qui a saisi ou modifié).
export const TourSession = ({ AppComponent, onExit }) => {
    const rootRef = useRef(null);
    const [appKey, setAppKey] = useState(0);

    useEffect(() => {
        // Les onglets lourds se chargent à la demande : on les prépare pour que la lecture reste fluide.
        import('../features/RecipeCalculator.jsx');
        import('../features/SummaryTable.jsx');
    }, []);

    const resetApp = useCallback(() => { resetSessionMemory(TOUR_SCOPE); setAppKey((k) => k + 1); }, []);

    return (
        <>
            {/* marge basse : la caméra peut ainsi remonter n'importe quel contenu au-dessus des sous-titres et de la barre */}
            <div ref={rootRef} data-testid="tour-app" style={{ paddingBottom: 170, background: '#f3f4f6' }}>
                <SessionScopeContext.Provider value={TOUR_SCOPE}>
                    <ErrorBoundary>
                        <AppComponent key={appKey} tourMode />
                    </ErrorBoundary>
                </SessionScopeContext.Provider>
            </div>
            <TourPlayer rootRef={rootRef} onExit={onExit} onResetApp={resetApp} />
        </>
    );
};
