import { createContext, useContext } from 'react';

// Regroupe les données du projet (produits, ingrédients, main-d'œuvre, infos générales...)
// et leurs setters, pour éviter de les faire descendre manuellement à travers chaque onglet.
// L'état UI purement local à un onglet (pagination, accordéons ouverts, tri...) reste en props.
export const ProjectContext = createContext(null);

export const useProject = () => {
    const ctx = useContext(ProjectContext);
    if (!ctx) {
        throw new Error("useProject() doit être appelé à l'intérieur d'un <ProjectContext.Provider>.");
    }
    return ctx;
};
