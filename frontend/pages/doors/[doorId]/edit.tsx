/**
 * Door Edit Page - Tier 3 (Object Admin)
 * Edit door attributes with permission-based field filtering
 */

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppStore } from '@/lib/store';
import { api, DoorInstance } from '@/lib/api';
import Layout from '@/components/Layout';
import Link from 'next/link';

export default function DoorEditPage() {
  const router = useRouter();
  const { doorId } = router.query;
  const { user, setIsLoading, setError, clearError } = useAppStore();
  const [door, setDoor] = useState<DoorInstance | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    clearError();
    try {
      const data = await api.getDoor(doorId as string);
      setDoor(data);

      // Initialize form data from attributes
      const initial: Record<string, any> = {};
      data.attributes.forEach((attr) => {
        initial[attr.attribute_name] = attr.value;
      });
      setFormData(initial);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    clearError();

    try {
      await api.updateDoor(doorId as string, formData);
      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/doors/${doorId}`);
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!user || !door) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading door...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Edit {door.external_id} - Doorman</title>
      </Head>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Door</h1>
          <p className="text-gray-500">{door.external_id} - {door.name}</p>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-semibold">Changes saved successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info (Read-only) */}
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Door ID</label>
                <input
                  type="text"
                  value={door.external_id}
                  disabled
                  className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={door.name}
                  disabled
                  className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Editable Attributes */}
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Door Attributes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {door.attributes
                .filter((attr) => !['door_id', 'name', 'external_id'].includes(attr.attribute_name))
                .map((attr) => {
                  const value = formData[attr.attribute_name];

                  // Render based on attribute type
                  if (attr.attribute_name === 'fire_class') {
                    return (
                      <div key={attr.id}>
                        <label className="block text-sm font-medium text-gray-700 capitalize">
                          {attr.attribute_name.replace(/_/g, ' ')}
                        </label>
                        <select
                          value={value || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, [attr.attribute_name]: e.target.value })
                          }
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Select...</option>
                          <option value="EI30">EI30</option>
                          <option value="EI60">EI60</option>
                          <option value="EI90">EI90</option>
                          <option value="EI120">EI120</option>
                        </select>
                      </div>
                    );
                  }

                  if (attr.attribute_name === 'security_class') {
                    return (
                      <div key={attr.id}>
                        <label className="block text-sm font-medium text-gray-700 capitalize">
                          {attr.attribute_name.replace(/_/g, ' ')}
                        </label>
                        <select
                          value={value || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, [attr.attribute_name]: e.target.value })
                          }
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Select...</option>
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </div>
                    );
                  }

                  // Default: text input
                  return (
                    <div key={attr.id}>
                      <label className="block text-sm font-medium text-gray-700 capitalize">
                        {attr.attribute_name.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [attr.attribute_name]: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between pt-6">
            <Link
              href={`/doors/${doorId}`}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
