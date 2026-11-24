// Graphique en lignes du suivi dans le temps. Extrait de SummaryTable.jsx le 24/11 (audit) : déplacement de code, aucune logique modifiée.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Label, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils.js';

// Doit être déclaré en dehors de SimpleLineChart : un composant recréé à chaque rendu
// perdrait son état à chaque frappe. Recharts fournit déjà le point de donnée complet via
// payload[0].payload, donc ce composant n'a besoin d'aucune fermeture sur les props du parent.
const LineChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const pointData = payload[0]?.payload;
        return (
            <div className="bg-white p-4 border rounded-lg shadow-lg">
                <p className="font-bold mb-2">{label}</p>
                {pointData && <p className="text-xs text-gray-500 mb-2">{pointData.name}</p>}
                {payload.map(pld => (
                    <p key={pld.dataKey} style={{ color: pld.color }}>
                        {`${pld.name}\u00A0: ${formatNumber(pld.value, 2)}${pld.payload[pld.dataKey + "_unit"] || ''}`}
                    </p>
                ))}
                 {pointData && pointData.note && <p className="text-xs text-gray-600 mt-2 border-t pt-2">Note&nbsp;: {pointData.note}</p>}
            </div>
        );
    }
    return null;
};

// Graphique d'évolution générique (Recharts) — réutilisé par les KPI globaux, l'analyse par SKU et
// les prix d'ingrédients/emballages.
export const SimpleLineChart = ({ data, lines, yAxisLabel }) => {
    if (!data || data.length < 1 || !lines || lines.length === 0) {
        return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Données insuffisantes pour afficher le graphique.</div>;
    }

    const validLines = lines.filter(line => data.some(d => d[line.dataKey] !== null && d[line.dataKey] !== undefined && isFinite(d[line.dataKey])));
    if (validLines.length === 0) return <div className="text-center p-4 h-[400px] flex items-center justify-center bg-gray-100 rounded-md">Aucune donnée à afficher pour les indicateurs sélectionnés.</div>;

    const yAxisTickFormatter = (value) => {
        if (yAxisLabel && yAxisLabel.includes('%')) return `${formatNumber(value, 0)}%`;
        if (yAxisLabel && yAxisLabel.includes('$')) return `${formatNumber(value, 2)}$`;
        return formatNumber(value, 1);
    };

    const dataWithUnits = data.map(d => {
        const newData = { ...d };
        validLines.forEach(line => {
            newData[line.dataKey + "_unit"] = line.unit || '';
        });
        return newData;
    });

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <LineChart
                    data={dataWithUnits}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 40,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={yAxisTickFormatter} tick={{ fontSize: 12 }}>
                        <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    <RechartsTooltip content={<LineChartTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                    {validLines.map(line => (
                        <Line
                            key={line.dataKey}
                            type="monotone"
                            dataKey={line.dataKey}
                            stroke={line.color}
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                            dot={{ r: 4 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
