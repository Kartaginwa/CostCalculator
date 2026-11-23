// Allergènes d'un format : ceux de ses ingrédients (sous-recettes comprises, qui portent les leurs), ou la liste saisie à la main pour un produit de revente.
// Extrait de RecipeCalculator.jsx le 22/11 (phase 4 de la refonte de l'export PDF) pour que l'écran Recette et le rapport lisent la MÊME règle.
// Les valeurs sont les clés de MAJOR_ALLERGENS (utils.js) ; la liste est vide si aucun allergène n'est déclaré.
export function computeFormatAllergens(format, ingredientsList) {
    if (!format) return [];
    if (format.isResaleProduct) return format.manualAllergens || [];
    const allergens = new Set();
    (format.ingredients || []).forEach(item => {
        const baseIngredient = (ingredientsList || []).find(ing => ing.id === item.id);
        if (baseIngredient && baseIngredient.allergens) baseIngredient.allergens.forEach(allergen => allergens.add(allergen));
    });
    return Array.from(allergens);
}
