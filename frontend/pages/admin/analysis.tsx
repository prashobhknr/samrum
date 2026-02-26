import React, { useEffect, useState } from 'react';
import SamrumLayout from '../../components/SamrumLayout';
import Loading from '../../components/Loading';
import { getStoredToken } from '../../lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface IncompleteObject {
    id: number;
    external_id: string;
    instance_name: string;
    object_type: string;
    missing_attributes: { id: number; name: string }[];
}

export default function AnalysisPage() {
    const [data, setData] = useState<IncompleteObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const token = getStoredToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        fetch(`${API}/api/admin/analysis/incomplete`, { headers })
            .then(res => res.json())
            .then(json => {
                if (json.success) setData(json.data);
                else setError('Misslyckades att hämta analysdata');
            })
            .catch(() => setError('Nätverksfel vid hämtning av analys'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SamrumLayout sidebarTitle="Analys & Kvalitet">
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Ofullständiga objekt (A006)</h1>
                        <p className="text-slate-500 mt-1">
                            Lista över objekt som saknar obligatoriska attributvärden.
                        </p>
                    </div>
                    <div className="bg-red-50 text-red-700 px-4 py-2 rounded-full text-sm font-medium border border-red-100">
                        {data.length} objekt kräver åtgärd
                    </div>
                </div>

                {loading ? (
                    <Loading />
                ) : error ? (
                    <div className="bg-red-50 p-4 border border-red-200 text-red-700 rounded-lg">
                        {error}
                    </div>
                ) : data.length === 0 ? (
                    <div className="bg-green-50 p-8 border border-green-200 text-green-700 rounded-lg text-center">
                        <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-medium">Inga ofullständiga objekt hittades!</p>
                        <p className="text-sm opacity-80">All obligatorisk data är ifylld för samtliga objekt.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID / Namn</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Objekttyp</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saknade attribut</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Åtgärd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.map(obj => (
                                    <tr key={obj.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-semibold text-slate-800">{obj.external_id}</div>
                                            <div className="text-xs text-slate-500">{obj.instance_name}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                                                {obj.object_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {obj.missing_attributes.map(attr => (
                                                    <span key={attr.id} className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                                        {attr.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <a
                                                href={`/admin/modules/${obj.id}`}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1"
                                            >
                                                Gå till objekt
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </SamrumLayout>
    );
}
