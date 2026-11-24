import React from 'react';
import { frTypo } from './guideFormat.js';

// Rendu du contenu du guide à partir de données (voir guideContent.js et content/*.js).
//
// Balisage dans les textes :
//   **gras**            — terme important (première définition d'un mot du métier, par exemple)
//   __italique__        — insistance, titre d'un rapport
//   {{Libellé}}         — texte d'un bouton, d'un champ ou d'un onglet tel qu'il s'affiche à l'écran
//   [[ancre|libellé]]   — lien vers une autre section du guide
//
// Blocs : p, h (sous-titre, avec ancre facultative), ul, ol, steps, table, callout, words.

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g;

const CALLOUTS = {
    retenir: { title: 'À retenir', box: 'border-blue-500 bg-blue-50', head: 'text-blue-800' },
    exemple: { title: 'Exemple', box: 'border-green-500 bg-green-50', head: 'text-green-800' },
    attention: { title: 'Attention', box: 'border-amber-500 bg-amber-50', head: 'text-amber-800' },
    astuce: { title: 'Astuce', box: 'border-indigo-500 bg-indigo-50', head: 'text-indigo-800' },
    pourquoi: { title: 'Pourquoi c\'est important', box: 'border-purple-500 bg-purple-50', head: 'text-purple-800' },
    mots: { title: 'Les mots de ce chapitre', box: 'border-gray-400 bg-gray-50', head: 'text-gray-700' },
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Surligne le terme recherché (les espaces du terme acceptent aussi l'espace insécable).
const highlight = (text, term) => {
    if (!term || !term.trim()) return text;
    const pattern = escapeRegExp(term.trim()).replace(/\s+/g, '[\\s\\u00a0]+');
    const regex = new RegExp(`(${pattern})`, 'gi');
    return text.split(regex).map((part, i) => (i % 2 === 1
        ? <mark key={i} className="bg-yellow-200 px-0.5 rounded-sm">{part}</mark>
        : part));
};

const Inline = ({ text, term, onLink }) => {
    const parts = frTypo(text).split(INLINE_PATTERN).filter((p) => p !== '');
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{highlight(part.slice(2, -2), term)}</strong>;
        if (part.startsWith('__') && part.endsWith('__')) return <em key={i}>{highlight(part.slice(2, -2), term)}</em>;
        if (part.startsWith('{{') && part.endsWith('}}')) {
            return <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-800 text-[0.92em] whitespace-nowrap">{highlight(part.slice(2, -2), term)}</span>;
        }
        if (part.startsWith('[[') && part.endsWith(']]')) {
            const [target, label] = part.slice(2, -2).split('|');
            return (
                <a key={i} href={`#${target}`} onClick={(e) => onLink(e, target)} className="text-blue-700 underline hover:text-blue-900">
                    {highlight(label || target, term)}
                </a>
            );
        }
        return <React.Fragment key={i}>{highlight(part, term)}</React.Fragment>;
    });
};

const ListItems = ({ items, itemIds, term, onLink }) => items.map((item, i) => (
    <li key={i} id={itemIds ? itemIds[i] || undefined : undefined} className="pl-1 scroll-mt-4">
        {typeof item === 'string'
            ? <Inline text={item} term={term} onLink={onLink} />
            : (<>
                <strong><Inline text={item.label} term={term} onLink={onLink} /></strong>{' '}
                <Inline text={item.text} term={term} onLink={onLink} />
            </>)}
    </li>
));

const Table = ({ block, term, onLink }) => (
    <div className="my-4 overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-300 rounded">
            {block.caption && <caption className="text-left text-sm font-semibold text-gray-700 pb-1"><Inline text={block.caption} term={term} onLink={onLink} /></caption>}
            <thead className="bg-gray-100">
                <tr>
                    {block.head.map((h, i) => (
                        <th key={i} className={`px-3 py-2 border-b border-gray-300 font-semibold text-center`}>
                            <Inline text={h} term={term} onLink={onLink} />
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {block.rows.map((row, r) => (
                    <tr key={r} id={block.rowIds ? block.rowIds[r] || undefined : undefined} className={`scroll-mt-4 ${r % 2 ? 'bg-gray-50' : 'bg-white'} ${block.boldLast && r === block.rows.length - 1 ? 'font-semibold' : ''}`}>
                        {row.map((cell, c) => (
                            <td key={c} className={`px-3 py-1.5 border-b border-gray-200 align-top ${c === 0 || block.wrapCells ? 'text-left' : 'text-right'} ${block.wrapCells ? '' : 'whitespace-nowrap'}`}>
                                <Inline text={String(cell)} term={term} onLink={onLink} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Blocks = ({ blocks, term, onLink }) => (
    <>
        {blocks.map((block, i) => {
            switch (block.type) {
                case 'p':
                    return <p key={i} className={`mb-3 ${block.className || ''}`}><Inline text={block.text} term={term} onLink={onLink} /></p>;
                case 'h':
                    return block.level === 5
                        ? <h5 key={i} id={block.id} className="font-semibold text-gray-800 mt-4 mb-1 scroll-mt-4"><Inline text={block.text} term={term} onLink={onLink} /></h5>
                        : <h4 key={i} id={block.id} className="text-lg font-semibold text-gray-900 mt-8 mb-2 scroll-mt-4"><Inline text={block.text} term={term} onLink={onLink} /></h4>;
                case 'ul':
                    return <ul key={i} className="list-disc pl-6 space-y-1.5 mb-3"><ListItems items={block.items} itemIds={block.itemIds} term={term} onLink={onLink} /></ul>;
                case 'ol':
                case 'steps':
                    return <ol key={i} className="list-decimal pl-6 space-y-1.5 mb-3"><ListItems items={block.items} itemIds={block.itemIds} term={term} onLink={onLink} /></ol>;
                case 'table':
                    return <Table key={i} block={block} term={term} onLink={onLink} />;
                case 'callout': {
                    const c = CALLOUTS[block.kind] || CALLOUTS.retenir;
                    return (
                        <aside key={i} data-callout={block.kind} className={`my-4 border-l-4 rounded-r-md px-4 py-3 ${c.box}`}>
                            <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${c.head}`}>{block.title || c.title}</div>
                            {block.text && <p className="mb-2 last:mb-0"><Inline text={block.text} term={term} onLink={onLink} /></p>}
                            {block.blocks && <Blocks blocks={block.blocks} term={term} onLink={onLink} />}
                        </aside>
                    );
                }
                case 'dl':
                    return (
                        <dl key={i} className="my-3 divide-y divide-gray-200 border-y border-gray-200">
                            {block.items.map((w, j) => (
                                <div key={j} id={w.id} className="py-2 scroll-mt-4">
                                    <dt className="font-semibold text-gray-900"><Inline text={w.term} term={term} onLink={onLink} /></dt>
                                    <dd className="text-gray-700"><Inline text={w.def} term={term} onLink={onLink} /></dd>
                                </div>
                            ))}
                        </dl>
                    );
                case 'words':
                    return (
                        <aside key={i} data-callout="mots" className={`my-4 border-l-4 rounded-r-md px-4 py-3 ${CALLOUTS.mots.box}`}>
                            <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${CALLOUTS.mots.head}`}>{block.title || CALLOUTS.mots.title}</div>
                            <dl className="space-y-1">
                                {block.items.map((w, j) => (
                                    <div key={j}>
                                        <dt className="inline font-semibold"><Inline text={w.term} term={term} onLink={onLink} />&nbsp;: </dt>
                                        <dd className="inline"><Inline text={w.def} term={term} onLink={onLink} /></dd>
                                    </div>
                                ))}
                            </dl>
                        </aside>
                    );
                default:
                    return null;
            }
        })}
    </>
);

export const GuideContent = ({ parts, term, onLink }) => (
    <div className="space-y-14">
        {parts.map((part) => (
            <section key={part.id} id={part.id} className="scroll-mt-4">
                <h2 className="text-3xl font-bold text-gray-900 border-b-2 border-gray-300 pb-2 mb-2">{part.title}</h2>
                {part.lead && <p className="text-gray-600 mb-6 italic"><Inline text={part.lead} term={term} onLink={onLink} /></p>}
                <div className="space-y-12">
                    {part.chapters.map((chapter) => (
                        <section key={chapter.id} id={chapter.id} className="scroll-mt-4">
                            <h3 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-4">{chapter.title}</h3>
                            {chapter.lead && <p className="text-gray-600 mb-4 italic"><Inline text={chapter.lead} term={term} onLink={onLink} /></p>}
                            <Blocks blocks={chapter.blocks} term={term} onLink={onLink} />
                        </section>
                    ))}
                </div>
            </section>
        ))}
    </div>
);
