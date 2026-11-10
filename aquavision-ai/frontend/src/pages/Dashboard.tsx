import { SpeciesBars } from '../components/charts';
import { ErrorState, LoadingState, MetricCard, PageHeading, Panel, StatusBadge } from '../components/ui';
import { useAnalytics } from '../services/useAnalytics';

const numberFormat = new Intl.NumberFormat();

export default function Dashboard() {
  const { analytics, loading, error } = useAnalytics();
  if (loading) return <LoadingState label="Loading workspace analytics" />;
  if (error || !analytics) return <ErrorState message={error || 'Analytics are unavailable.'} />;

  return (
    <>
      <PageHeading
        eyebrow="Workspace overview"
        title="See what is moving below the surface."
        description="Detection and tracking summaries from videos processed by your local AquaVision workspace."
        action={<a className="button button-primary" href="/video-intelligence">Analyze a video <span aria-hidden="true">↗</span></a>}
      />
      {analytics.videos_processed === 0 && (
        <div className="notice-banner">
          <span className="notice-dot" />
          No videos have completed yet. Upload a video to populate the dashboard with inference results.
        </div>
      )}
      <div className="metric-grid">
        <MetricCard label="Tracked detections" value={numberFormat.format(analytics.total_detections)} detail="Boxes assigned a ByteTrack ID" />
        <MetricCard label="Unique track IDs" value={numberFormat.format(analytics.unique_fish_count)} detail="Summed per processed video" />
        <MetricCard label="Classes observed" value={numberFormat.format(analytics.species_count)} detail="Model labels, not external taxonomy" />
        <MetricCard label="Videos processed" value={numberFormat.format(analytics.videos_processed)} detail="Completed jobs in this session" />
      </div>

      <div className="content-grid content-grid-wide">
        <Panel title="Population by model label" description="Counts represent unique track IDs within each processed video.">
          <SpeciesBars counts={analytics.species_counts} />
        </Panel>
        <Panel title="Recent activity" description="Latest upload and processing status.">
          {analytics.recent_jobs.length ? (
            <div className="activity-list">
              {analytics.recent_jobs.slice(0, 6).map((job) => (
                <div className="activity-row" key={job.id}>
                  <span className="activity-icon">V</span>
                  <div className="activity-copy">
                    <strong>{job.filename}</strong>
                    <span>{new Date(job.created_at).toLocaleString()}</span>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No processing activity yet.</p>
          )}
        </Panel>
      </div>
      <p className="footnote">ID-based counts can split or merge fish counts when tracker IDs change during long occlusions or interruptions.</p>
    </>
  );
}
