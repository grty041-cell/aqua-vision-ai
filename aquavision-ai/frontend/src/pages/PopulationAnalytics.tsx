import { ConfidenceBars, FrameTrend } from '../components/charts';
import { EmptyState, ErrorState, LoadingState, MetricCard, PageHeading, Panel } from '../components/ui';
import { useAnalytics } from '../services/useAnalytics';

export default function PopulationAnalytics() {
  const { analytics, loading, error } = useAnalytics();
  if (loading) return <LoadingState label="Loading population analytics" />;
  if (error || !analytics) return <ErrorState message={error || 'Population analytics are unavailable.'} />;

  const firstFrameJob = analytics.frame_counts[0];
  const selectedFrames = firstFrameJob
    ? analytics.frame_counts.filter((frame) => frame.job_id === firstFrameJob.job_id)
    : [];
  const confidence = analytics.confidence;

  return (
    <>
      <PageHeading
        eyebrow="Video analytics"
        title="Population analytics"
        description="Frame-level tracked counts, model confidence, and track-duration summaries from completed jobs."
      />
      <div className="metric-grid">
        <MetricCard label="Unique track IDs" value={analytics.unique_fish_count.toLocaleString()} detail="Summed by video" />
        <MetricCard label="Mean confidence" value={confidence.mean === null ? '—' : `${(confidence.mean * 100).toFixed(1)}%`} detail={`${confidence.count.toLocaleString()} tracked detections`} />
        <MetricCard label="Average track duration" value={analytics.average_track_duration_seconds === null ? '—' : `${analytics.average_track_duration_seconds.toFixed(2)} s`} detail="Available when source FPS is readable" />
      </div>
      <div className="content-grid">
        <Panel title="Frame-wise tracked fish" description="Showing one processed video at a time; no cross-video frame alignment is assumed.">
          {firstFrameJob ? (
            <FrameTrend points={selectedFrames} label={firstFrameJob.filename} />
          ) : (
            <EmptyState title="No completed video" description="Frame-level counts appear once processing finishes." />
          )}
        </Panel>
        <Panel title="Detection confidence" description="Histogram of actual YOLO confidences for tracked detections.">
          <ConfidenceBars analytics={analytics} />
          {confidence.count > 0 && (
            <div className="confidence-summary">
              <span>Min <strong>{confidence.min === null ? '—' : `${(confidence.min * 100).toFixed(1)}%`}</strong></span>
              <span>Mean <strong>{confidence.mean === null ? '—' : `${(confidence.mean * 100).toFixed(1)}%`}</strong></span>
              <span>Max <strong>{confidence.max === null ? '—' : `${(confidence.max * 100).toFixed(1)}%`}</strong></span>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
