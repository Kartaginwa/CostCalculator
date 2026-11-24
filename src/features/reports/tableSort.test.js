import { describe, it, expect } from 'vitest';
import { nextSort, sortRows } from './tableSort.jsx';

describe('tri des tableaux de rapport', () => {
    const rows = [{ n: 'b', v: 2 }, { n: 'a', v: null }, { n: 'c', v: 10 }, { n: 'd', v: 5 }];
    it('colonne numérique : du plus grand au plus petit au premier clic, puis inversé', () => {
        let sort = nextSort({ key: null, direction: 'ascending' }, 'v');
        expect(sort).toEqual({ key: 'v', direction: 'descending' });
        expect(sortRows(rows, sort).map(r => r.n)).toEqual(['c', 'd', 'b', 'a']);
        sort = nextSort(sort, 'v');
        expect(sort.direction).toBe('ascending');
        expect(sortRows(rows, sort).map(r => r.n)).toEqual(['b', 'd', 'c', 'a']);
    });
    it('une valeur absente reste en fin de liste dans les deux sens (jamais comptée comme 0)', () => {
        expect(sortRows(rows, { key: 'v', direction: 'descending' }).at(-1).n).toBe('a');
        expect(sortRows(rows, { key: 'v', direction: 'ascending' }).at(-1).n).toBe('a');
    });
    it('colonne de texte : de A à Z au premier clic, sans tenir compte des accents ni de la casse', () => {
        const sort = nextSort(null, 'n', true);
        expect(sort.direction).toBe('ascending');
        expect(sortRows([{ n: 'Élan' }, { n: 'zèbre' }, { n: 'abeille' }], sort).map(r => r.n)).toEqual(['abeille', 'Élan', 'zèbre']);
    });
    it('sans colonne choisie, l\'ordre d\'origine est conservé', () => {
        expect(sortRows(rows, { key: null, direction: 'ascending' })).toBe(rows);
    });
    it('ne modifie pas le tableau d\'origine', () => {
        const copy = [...rows];
        sortRows(rows, { key: 'v', direction: 'descending' });
        expect(rows).toEqual(copy);
    });
});
