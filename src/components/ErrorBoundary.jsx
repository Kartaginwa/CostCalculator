import React from 'react';

// Filet de sécurité : capture toute exception survenant pendant le rendu d'un sous-arbre React
// et affiche une interface de récupération au lieu d'un écran blanc. Sans ce garde-fou, une seule
// erreur de rendu (n'importe où dans l'app) laisse l'utilisateur devant une page vide, sans
// message ni moyen de récupérer son travail non sauvegardé. Doit être un composant de classe :
// getDerivedStateFromError / componentDidCatch n'ont pas d'équivalent hook.
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Journalise pour le diagnostic (visible dans la console dev / les logs Electron).
        console.error('ErrorBoundary a intercepté une erreur :', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6 border-t-4 border-red-500">
                    <h1 className="text-xl font-bold text-gray-800 mb-2">Une erreur inattendue est survenue</h1>
                    <p className="text-sm text-gray-600 mb-4">
                        L'application a rencontré un problème et n'a pas pu afficher cette section.
                        Vos données en cours n'ont pas été perdues : vous pouvez réessayer, ou recharger
                        l'application. Pensez à sauvegarder votre projet (bouton « Sauvegarder ») dès que
                        possible.
                    </p>
                    {this.state.error && (
                        <pre className="text-xs bg-gray-50 text-red-700 rounded p-3 mb-4 overflow-x-auto whitespace-pre-wrap">
                            {String(this.state.error.message || this.state.error)}
                        </pre>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={this.handleReset}
                            className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium"
                        >
                            Réessayer
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 text-sm font-medium"
                        >
                            Recharger l'application
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
