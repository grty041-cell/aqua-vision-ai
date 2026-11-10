import { useEffect, useState } from 'react';
import { downloadReport, fetchJobs } from '../services/api';
import { useAnalytics } from '../services/useAnalytics';
import type { Job } from '../types';
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, StatusBadge } from '../components/ui';

export default function ReportsEvaluation() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { analytics } = useAnalytics();

  useEffect(() => {
    let active = true;
    fetchJobs()
      .then((items) => {
        if (!active) return;
        setJobs(items);
        setSelectedId(items.find((job) => job.status === 'completed')?.id || items[0]?.id || '');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Processing jobs could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadingJobs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = jobs.find((job) => job.id === selectedId);
  const download = async (format: 'json' | 'csv' | 'pdf') => {
    if (!selected) return;
    setDownloading(format);
    setError(null);
    try {
      await downloadReport(selected.id, format);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Report download failed.');
    } finally {
      setDownloading(null);
    }
  };

  if (loadingJobs) return <LoadingState label="Loading reports" />;

  return (
    <>
      <PageHeading
        eyebrow="Exports and evaluation"
        title="Reports & evaluation"
        description="Download reports generated from actual video inference and tracking results."
      />
      {error && <ErrorState message={error} />}
      <div className="content-grid content-grid-wide">
        <Panel title="Processing reports" description="JSON includes frame and track details; CSV starts with summary metadata, then one row per tracked detection.">
          {jobs.length ? (
            <>
              <div className="form-row">
                <label htmlFor="report-job">Processed video</label>
                <select id="report-job" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.filename} · {job.status}</option>
                  ))}
                </select>
              </div>
              {selected?.status === 'completed' ? (
                <>
                  <div className="download-grid">
                    {(['json', 'csv', 'pdf'] as const).map((format) => (
                      <button
                        key={format}
                        className="download-card"
                        onClick={() => void download(format)}
                        disabled={downloading !== null}
                      >
                        <span className="download-extension">.{format}</span>
                        <strong>{downloading === format ? 'Preparing…' : `${format.toUpperCase()} report`}</strong>
                        <span>Download processing results</span>
                      </button>
                    ))}
                  </div>
                  <p className="muted-copy">Completed {selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '—'}</p>
                </>
              ) : (
                <div className="notice-banner"><StatusBadge status={selected?.status || 'queued'} /> Reports become available when processing completes.</div>
              )}
            </>
          ) : (
            <EmptyState title="No reports yet" description="Reports become available after a video completes processing." />
          )}
        </Panel>
        <Panel title="Model evaluation" description="Evaluation scores require aligned ground-truth annotations.">
          <div className="evaluation-unavailable">
            <span className="evaluation-mark">—</span>
            <strong>Not available for these uploads</strong>
            <p>{analytics?.evaluation_unavailable_reason || 'No ground-truth annotations are associated with uploaded videos.'}</p>
            <p>Precision, recall, F1, confusion matrices, and tracking benchmark scores are not inferred from detections alone.</p>
          </div>
        </Panel>
      </div>
      <Panel title="Recent processing jobs">
        {jobs.length ? (
          <div className="activity-list">
            {jobs.slice(0, 10).map((job) => (
              <div className="activity-row" key={job.id}>
                <span className="activity-icon">V</span>
                <div className="activity-copy"><strong>{job.filename}</strong><span>{new Date(job.created_at).toLocaleString()}</span></div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        ) : <EmptyState title="No processing history" description="Uploaded video jobs will be listed here." />}
      </Panel>
    </>
  );
}
