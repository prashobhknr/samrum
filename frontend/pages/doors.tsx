/**
 * Phase 4: Doors Management Page (Tier 3 - Object Admin)
 * 
 * - List all doors with pagination
 * - Create new doors
 * - Edit door attributes
 * - Search and filter
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, DoorInstance } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';

export default function DoorsPage() {
  const router = useRouter();
  const { user, setIsLoading, setError } = useAppStore();
  const [doors, setDoors] = useState<DoorInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadDoors();
  }, [user, page, search, router]);

  async function loadDoors() {
    setIsLoading(true);
    try {
      const data = await api.listDoors(10, page * 10, search || undefined);
      setDoors(data.items);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateDoor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await api.createDoor(
        formData.get('external_id') as string,
        formData.get('name') as string,
        {
          fire_class: formData.get('fire_class'),
          security_class: formData.get('security_class'),
          lock_type: formData.get('lock_type'),
        }
      );

      setShowCreateForm(false);
      loadDoors();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!user) return null;

  const totalPages = Math.ceil(total / 10);

  return (
    <Layout>
      <Head>
        <title>Door Management - Doorman</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Door Management</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            {showCreateForm ? 'Cancel' : '+ New Door'}
          </button>
        </div>

        {/* Create Door Form */}
        {showCreateForm && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Door</h3>
            <form onSubmit={handleCreateDoor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Door ID</label>
                  <input
                    type="text"
                    name="external_id"
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fire Class</label>
                  <select name="fire_class" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="EI30">EI30</option>
                    <option value="EI60">EI60</option>
                    <option value="EI90">EI90</option>
                    <option value="EI120">EI120</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Security Class</label>
                  <select name="security_class" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Create Door
              </button>
            </form>
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search doors..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Doors List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900">Door ID</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900">Fire Class</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900">Security</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {doors.map((door) => {
                const fireClass = door.attributes.find((a) => a.attribute_name === 'fire_class');
                const secClass = door.attributes.find((a) => a.attribute_name === 'security_class');

                return (
                  <tr key={door.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{door.external_id}</td>
                    <td className="px-6 py-4 text-sm">{door.name}</td>
                    <td className="px-6 py-4 text-sm">{fireClass?.value || '-'}</td>
                    <td className="px-6 py-4 text-sm">{secClass?.value || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/doors/${door.id}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center space-x-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-3 py-1 rounded ${
                  page === i
                    ? 'bg-primary text-white'
                    : 'border border-gray-300 hover:border-primary'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
