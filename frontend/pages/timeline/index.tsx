/**
 * Process Instance Timeline — Phase 4
 * Supervisory view showing which BPMN phase/subprocess is currently active
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SamrumLayout from '@/components/SamrumLayout';
import { api, ProcessInstance, ActivityTimeline } from '@/lib/api';
import { getStoredUser, User } from '@/lib/auth';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  startEvent: 'Starthändelse',
  endEvent: 'Sluthändelse',
  userTask: 'Användaruppgift',
  serviceTask: 'Serviceuppgift',
  callActivity: 'Delprocess',
  exclusiveGateway: 'Beslut',
  parallelGateway: 'Parallell',
  intermediateThrowEvent: 'Händelse',
  intermediateCatchEvent: 'Händelse',
  boundaryEvent: 'Gränshändelse',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function ActivityTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    startEvent: 'bg-green-500',
    endEvent: 'bg-red-500',
    userTask: 'bg-blue-500',
    serviceTask: 'bg-purple-500',
    callActivity: 'bg-amber-500',
    exclusiveGateway: 'bg-orange-400',
    parallelGateway: 'bg-orange-400',
  };
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[type] || 'bg-gray-400'}`} />
  );
}

export default function TimelinePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ProcessInstance | null>(null);
  const [timeline, setTimeline] = useState<ActivityTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState<string>('');

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/login'); return; }
    setUser(u);
    loadInstances();
  }, [router]);

  async function loadInstances() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProcessInstances({ active: true });
      setInstances(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function selectInstance(inst: ProcessInstance) {
    setSelectedInstance(inst);
    setTimelineLoading(true);
    try {
      const data = await api.getActivityHistory(inst.id);
      setTimeline(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function refreshTimeline() {
    if (!selectedInstance) return;
    setTimelineLoading(true);
    try {
      const data = await api.getActivityHistory(selectedInstance.id);
      setTimeline(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimelineLoading(false);
    }
  }

  if (!user) return null;

  // Get unique process keys for filter
  const processKeys = [...new Set(instances.map((i) => i.processDefinitionKey))].sort();
  const filteredInstances = filterKey
    ? instances.filter((i) => i.processDefinitionKey === filterKey)
    : instances;

  // Filter timeline to meaningful activity types (skip gateways and transitions)
  const meaningfulTypes = new Set(['startEvent', 'endEvent', 'userTask', 'serviceTask', 'callActivity']);
  const filteredTimeline = timeline?.timeline.filter((e) => meaningfulTypes.has(e.activityType)) || [];

  // Sidebar: process instance list
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-samrum-border">
        <select
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
          className="w-full text-xs border border-samrum-border rounded px-2 py-1"
        >
          <option value="">Alla processer</option>
          {processKeys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-samrum-muted">Laddar...</div>
        ) : filteredInstances.length === 0 ? (
          <div className="p-4 text-sm text-samrum-muted">Inga aktiva processer</div>
        ) : (
          filteredInstances.map((inst) => (
            <button
              key={inst.id}
              onClick={() => selectInstance(inst)}
              className={`w-full text-left px-3 py-2 border-b border-samrum-border hover:bg-samrum-bg transition-colors ${
                selectedInstance?.id === inst.id ? 'bg-blue-50 border-l-2 border-l-samrum-blue' : ''
              }`}
            >
              <div className="text-sm font-medium text-samrum-text truncate">{inst.processName}</div>
              <div className="text-xs text-samrum-muted truncate">
                {inst.variables.doorInstanceId && `Dörr #${inst.variables.doorInstanceId}`}
                {inst.variables.buildingId && ` | Byggnad #${inst.variables.buildingId}`}
                {!inst.variables.doorInstanceId && !inst.variables.buildingId && inst.id.substring(0, 8)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <SamrumLayout sidebar={sidebar} sidebarTitle="Processinstanser" sidebarWidth="280px">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-samrum-text">Processtidslinje</h1>
            <p className="text-sm text-samrum-muted">Övervakning av aktiva processinstanser</p>
          </div>
          {selectedInstance && (
            <button
              onClick={refreshTimeline}
              className="px-4 py-2 bg-samrum-blue text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Uppdatera
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}

        {!selectedInstance ? (
          <div className="text-center py-20 text-samrum-muted">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg">Välj en processinstans i sidopanelen</p>
            <p className="text-sm mt-1">{instances.length} aktiva processer</p>
          </div>
        ) : timelineLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-samrum-blue" />
            <span className="ml-3 text-samrum-muted">Laddar tidslinje...</span>
          </div>
        ) : timeline ? (
          <div>
            {/* Process header */}
            <div className="bg-white border border-samrum-border rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-samrum-text">{selectedInstance.processName}</h2>
                  <p className="text-xs text-samrum-muted font-mono mt-1">{selectedInstance.id}</p>
                </div>
                <div className="text-right">
                  {timeline.currentActivities.length > 0 && (
                    <div className="inline-flex items-center gap-2 bg-blue-50 text-samrum-blue px-3 py-1.5 rounded-full text-sm font-medium">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      {timeline.currentActivities[0].activityName}
                    </div>
                  )}
                </div>
              </div>
              {Object.keys(selectedInstance.variables).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(selectedInstance.variables).map(([k, v]) => (
                    <span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Current active step highlight */}
            {timeline.currentActivities.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-samrum-text mb-2 uppercase tracking-wider">Aktiv just nu</h3>
                <div className="flex flex-wrap gap-3">
                  {timeline.currentActivities.map((a) => (
                    <div
                      key={a.activityId}
                      className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3"
                    >
                      <ActivityTypeIcon type={a.activityType} />
                      <div>
                        <div className="text-sm font-medium text-blue-800">{a.activityName}</div>
                        <div className="text-xs text-blue-600">{ACTIVITY_TYPE_LABELS[a.activityType] || a.activityType}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <h3 className="text-sm font-semibold text-samrum-text mb-3 uppercase tracking-wider">Händelselogg</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-0">
                {filteredTimeline.map((event, idx) => (
                  <div key={event.id} className="relative flex items-start gap-4 py-2">
                    {/* Dot */}
                    <div className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 ${
                      event.isActive
                        ? 'border-blue-500 bg-blue-50'
                        : event.canceled
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-white'
                    }`}>
                      <ActivityTypeIcon type={event.activityType} />
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-2 ${idx < filteredTimeline.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${event.isActive ? 'text-blue-700' : 'text-samrum-text'}`}>
                            {event.activityName}
                          </span>
                          {event.isActive && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                              Pågår
                            </span>
                          )}
                          {event.canceled && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Avbruten</span>
                          )}
                        </div>
                        <span className="text-xs text-samrum-muted">
                          {ACTIVITY_TYPE_LABELS[event.activityType] || event.activityType}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-xs text-samrum-muted">
                        <span>Start: {formatDate(event.startTime)}</span>
                        {event.endTime && <span>Slut: {formatDate(event.endTime)}</span>}
                        {event.durationMs != null && event.durationMs > 0 && (
                          <span>Längd: {formatDuration(event.durationMs)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {filteredTimeline.length === 0 && (
              <div className="text-center py-8 text-samrum-muted text-sm">Inga händelser att visa</div>
            )}
          </div>
        ) : null}
      </div>
    </SamrumLayout>
  );
}
