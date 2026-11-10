import { useEffect, useState } from 'react';
import { annotatedVideoUrl, fetchJob, fetchModels, fetchResults, submitVideo } from '../services/api';
import type { Job, ModelOption, VideoResults } from '../types';
import { EmptyState, ErrorState, LoadingState, MetricCard, PageHeading, Panel, StatusBadge } from '../components/ui';

export default function VideoIntelligence() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepfish_multi_m.pt');
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<VideoResults | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchModels()
      .then((items) => {
        if (active) {
          setModels(items);
          const firstAvailable = items.find((item) => item.available);
          if (firstAvailable) setSelectedModel(firstAvailable.id);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Model options could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    let active = true;
    const poll = async () => {
      try {
        const updated = await fetchJob(job.id);
        if (!active) return;
        if (updated.status === 'completed') {
          const videoResults = await fetchResults(job.id);
          if (active) {
            setResults(videoResults);
            setJob(updated);
          }
        } else if (updated.status === 'failed') {
          setJob(updated);
          setError(updated.error || 'Video processing failed.');
        } else {
          setJob(updated);
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : 'Processing status could not be retrieved.');
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [job?.id, job?.status]);

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    setError(null);
    setResults(null);
    setJob(null);
    setFile(candidate);
  };

  const startProcessing = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const created = await submitVideo(file, selectedModel);
      setJob(created);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Video upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const progress = job?.progress;
  const percent = progress?.total_frames
    ? Math.min(100, Math.round((progress.frame_number / progress.total_frames) * 100))
    : null;

  return (
    <>
      <PageHeading
        eyebrow="YOLOv8 + ByteTrack"
        title="Video intelligence"
        description="Upload a video for pretrained fish detection, persistent tracking, and an annotated export."
      />
      {error && <ErrorState message={error} />}
      <div className="content-grid content-grid-wide">
        <Panel title="Create an analysis" description="Video upload is validated before processing begins.">
          <label
            className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <span className="upload-symbol">+</span>
            <strong>{file ? file.name : 'Drop a video here, or browse'}</strong>
            <span>MP4, MOV, AVI, MKV or WebM · Up to 500 MB</span>
          </label>
          <div className="form-row">
            <label htmlFor="model-choice">Pretrained weights</label>
            <select id="model-choice" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
              {models.map((model) => (
                <option key={model.id} value={model.id} disabled={!model.available}>
                  {model.name}{model.available ? '' : ' (weights missing)'}
                </option>
              ))}
            </select>
          </div>
          <button
            className="button button-primary full-button"
            onClick={() => void startProcessing()}
            disabled={!file || busy || !models.some((model) => model.id === selectedModel && model.available)}
          >
            {busy ? 'Uploading video…' : job && !['completed', 'failed'].includes(job.status) ? 'Processing video…' : 'Start video analysis'}
          </button>
          {job && (
            <div className="job-progress">
              <div className="progress-heading">
                <span>Job {job.id.slice(0, 8)}</span>
                <StatusBadge status={job.status} />
              </div>
              <div className="progress-track"><span style={{ width: `${percent ?? (job.status === 'completed' ? 100 : 8)}%` }} /></div>
              <p>{progress?.total_frames ? `Frame ${progress.frame_number.toLocaleString()} of ${progress.total_frames.toLocaleString()}${percent === null ? '' : ` · ${percent}%`}` : job.status}</p>
            </div>
          )}
        </Panel>
        <Panel title="Input preview" description={file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${file.type || 'Video file'}` : 'Preview the selected source video before processing.'}>
          {file && previewUrl ? (
            <video className="video-player" src={previewUrl} controls />
          ) : (
            <EmptyState title="No video selected" description="Your local video preview will appear here." />
          )}
        </Panel>
      </div>

      {job?.status === 'completed' && results && (
        <section className="results-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Analysis complete</p>
              <h2>{results.filename}</h2>
            </div>
            <a className="button button-secondary" href={annotatedVideoUrl(job.id)} target="_blank" rel="noreferrer">Open annotated video ↗</a>
          </div>
          <div className="metric-grid">
            <MetricCard label="Tracked detections" value={results.summary.total_detections.toLocaleString()} />
            <MetricCard label="Unique track IDs" value={results.summary.unique_fish_count.toLocaleString()} />
            <MetricCard label="Classes" value={Object.keys(results.summary.species_counts).length.toLocaleString()} />
            <MetricCard label="Frames processed" value={results.summary.processed_frames.toLocaleString()} />
          </div>
          <Panel title="Annotated output" description="Generated by the existing standard YOLO/ByteTrack pipeline.">
            <video className="video-player output-player" src={annotatedVideoUrl(job.id)} controls />
          </Panel>
          <Panel title="Tracked objects" description="Species/class is the highest-confidence model label observed for each track.">
            {results.tracks.length ? (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Track ID</th><th>Model label</th><th>Best confidence</th><th>Observed frames</th><th>Duration</th></tr></thead>
                  <tbody>
                    {results.tracks.slice(0, 100).map((track) => (
                      <tr key={track.track_id}>
                        <td className="mono">#{track.track_id}</td>
                        <td>{track.species || 'Unknown'}</td>
                        <td>{(track.best_confidence * 100).toFixed(1)}%</td>
                        <td>{track.observed_frames.toLocaleString()}</td>
                        <td>{track.duration_seconds === null ? '—' : `${track.duration_seconds.toFixed(2)} s`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.tracks.length > 100 && <p className="chart-caption">Showing 100 of {results.tracks.length} tracks. Full data is available in the JSON report.</p>}
              </div>
            ) : (
              <EmptyState title="No tracked fish found" description="The selected model did not assign any track IDs in this video." />
            )}
          </Panel>
          <p className="footnote">A unique ID is unique within this video only. ByteTrack may assign another ID after a long interruption or occlusion.</p>
        </section>
      )}
    </>
  );
}
