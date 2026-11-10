import type { Analytics } from '../types';
import { EmptyState } from './ui';

export function SpeciesBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return <EmptyState title="No classified tracks yet" description="Species and class counts appear after a video completes." />;
  }
  const max = Math.max(...entries.map(([, count]) => count), 1);
  return (
    <div className="bar-list">
      {entries.map(([species, count]) => (
        <div className="bar-row" key={species}>
          <div className="bar-label">
            <span>{species}</span>
            <strong>{count}</strong>
          </div>
          <div className="bar-track">
            <span style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FrameTrend({
  points,
  label,
}: {
  points: Array<{ frame_number: number; count: number }>;
  label?: string;
}) {
  if (!points.length) {
    return <EmptyState title="No frame data" description="Frame counts are generated from completed video inference." />;
  }
  const visible = points.slice(0, 500);
  const width = 720;
  const height = 220;
  const padding = 18;
  const max = Math.max(...visible.map((point) => point.count), 1);
  const coordinates = visible.map((point, index) => {
    const x = padding + (index / Math.max(visible.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.count / max) * (height - padding * 2);
    return `${x},${y}`;
  });
  return (
    <div className="trend-wrap">
      {label && <p className="chart-caption">{label}</p>}
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tracked fish count by frame">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
        <polyline points={coordinates.join(' ')} className="trend-line" />
        {visible.length === 1 && (
          <circle cx={coordinates[0].split(',')[0]} cy={coordinates[0].split(',')[1]} r="4" className="trend-dot" />
        )}
      </svg>
      <div className="chart-foot">
        <span>Frame 1</span>
        <span>Peak tracked fish: {max}</span>
        <span>Frame {visible[visible.length - 1].frame_number}</span>
      </div>
      {points.length > visible.length && (
        <p className="chart-caption">Showing the first {visible.length} frames of {points.length}.</p>
      )}
    </div>
  );
}

export function ConfidenceBars({ analytics }: { analytics: Analytics }) {
  const histogram = Object.entries(analytics.confidence.histogram);
  const max = Math.max(...histogram.map(([, count]) => count), 1);
  if (!analytics.confidence.count) {
    return <EmptyState title="No confidence values yet" description="Confidence statistics appear after tracked detections are processed." />;
  }
  return (
    <div className="confidence-chart">
      {histogram.map(([range, count]) => (
        <div className="confidence-column" key={range} title={`${range}: ${count}`}>
          <span className="confidence-bar" style={{ height: `${Math.max((count / max) * 100, count ? 4 : 0)}%` }} />
          <span>{range.split('-')[0]}</span>
        </div>
      ))}
    </div>
  );
}
