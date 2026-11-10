import { SpeciesBars } from '../components/charts';
import { EmptyState, ErrorState, LoadingState, MetricCard, PageHeading, Panel } from '../components/ui';
import { useAnalytics } from '../services/useAnalytics';

export default function SpeciesExplorer() {
  const { analytics, loading, error } = useAnalytics();
  if (loading) return <LoadingState label="Loading species and class counts" />;
  if (error || !analytics) return <ErrorState message={error || 'Species data are unavailable.'} />;

  return (
    <>
      <PageHeading
        eyebrow="Model outputs"
        title="Species explorer"
        description="Explore class labels and unique track counts emitted by the selected pretrained model."
      />
      <div className="metric-grid metric-grid-two">
        <MetricCard label="Classes observed" value={analytics.species_count} detail="Across completed videos" />
        <MetricCard label="Tracked detections" value={analytics.total_detections.toLocaleString()} detail="Detection confidence is available per track and frame" />
      </div>
      <Panel title="Unique tracks by class" description="Each track is assigned its highest-confidence class across observed frames.">
        {analytics.species_count ? (
          <SpeciesBars counts={analytics.species_counts} />
        ) : (
          <EmptyState title="No class results yet" description="Complete a video analysis to see model labels and counts." />
        )}
      </Panel>
      <Panel title="Track confidence by class" description="Confidence is the best observed detection score for each track ID.">
        {Object.keys(analytics.species_confidence).length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Model label</th><th>Tracks</th><th>Lowest best score</th><th>Mean best score</th><th>Highest best score</th></tr></thead>
              <tbody>
                {Object.entries(analytics.species_confidence).map(([species, confidence]) => (
                  <tr key={species}>
                    <td>{species}</td>
                    <td>{confidence.track_count.toLocaleString()}</td>
                    <td>{(confidence.min * 100).toFixed(1)}%</td>
                    <td>{(confidence.mean * 100).toFixed(1)}%</td>
                    <td>{(confidence.max * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No class confidence data" description="Confidence summaries appear when tracks are detected." />
        )}
      </Panel>
      <div className="info-callout">
        <strong>Classification depends on the selected weights.</strong>
        <p>The DeepFish weights provide multiple model classes; the F4K weights are single-class fish detection. A single-class result is not a biological species identification.</p>
      </div>
    </>
  );
}
