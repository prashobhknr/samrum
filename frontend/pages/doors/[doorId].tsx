/**
 * Door Detail Page - Tier 3 (Object Admin)
 * View all door attributes, relationships, and audit history
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, DoorInstance } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface AuditEntry {
  timestamp: string;
  user: string;
  action: string;
  changes: Record<string, { old: string; new: string }>;
}

export default function DoorDetailPage() {
  const router = useRouter();
  const { doorId } = router.query;
  const { user, setIsLoading, setError } = useAppStore();
  const [door, setDoor] = useState<DoorInstance | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [_isEditing, _setIsEditing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (doorId) {
      loadDoorDetail();
    }
  }, [user, doorId, router]);

  async function loadDoorDetail() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDoor(Number(doorId));
      setDoor(data);

      // Load audit trail (simulated - in real system, would come from API)
      setAudit([
        {
          timestamp: new Date().toISOString(),
          user: 'jane.supervisor@example.com',
          action: 'Updated fire_class',
          changes: { fire_class: { old: 'EI30', new: 'EI60' } },
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!user || !door) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading door details...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Door {door.external_id} - Doorman</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{door.name}</h1>
            <p className="text-gray-500 font-mono">{door.external_id}</p>
          </div>
          <div className="space-x-3">
            <Link
              href={`/doors/${doorId}/edit`}
              className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition inline-block"
            >
              Edit
            </Link>
            <Link
              href="/doors"
              className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition inline-block"
            >
              Back
            </Link>
          </div>
        </div>

        {/* Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {door.attributes.map((attr) => (
            <div key={attr.attribute_id} className="p-4 bg-white border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500 uppercase font-semibold">{attr.attribute_name}</p>
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {typeof attr.value === 'object' ? JSON.stringify(attr.value) : String(attr.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Relationships */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Related Objects</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 uppercase font-semibold">Locks</p>
              <p className="text-2xl font-bold text-primary mt-2">
                {(door as any).relationships?.locks?.length || 0}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 uppercase font-semibold">Door Frame</p>
              <p className="text-sm text-gray-600 mt-2">
                {(door as any).relationships?.frame ? 'Assigned' : 'Not assigned'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 uppercase font-semibold">Automation</p>
              <p className="text-sm text-gray-600 mt-2">
                {(door as any).relationships?.automation ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Audit Trail</h2>
          <div className="space-y-4">
            {audit.length > 0 ? (
              audit.map((entry, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border-l-4 border-primary">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.action}</p>
                      <p className="text-sm text-gray-500">{entry.user}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {Object.entries(entry.changes).length > 0 && (
                    <div className="mt-2 text-sm font-mono text-gray-600">
                      {Object.entries(entry.changes).map(([key, change]) => (
                        <p key={key}>
                          {key}: <span className="text-red-600">{change.old}</span> →{' '}
                          <span className="text-green-600">{change.new}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500">No changes recorded</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
