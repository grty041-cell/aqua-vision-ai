export interface JobProgress {
  frame_number: number;
  total_frames: number | null;
}

export interface JobSummary {
  processed_frames: number;
  total_detections: number;
  unique_fish_count: number;
  species_counts: Record<string, number>;
  confidence: {
    count: number;
    min: number | null;
    mean: number | null;
    max: number | null;
    histogram: Record<string, number>;
  };
  average_track_duration_seconds: number | null;
  longest_track_duration_seconds: number | null;
  frame_counts: Array<{ frame_number: number; count: number }>;
}

export interface Job {
  id: string;
  filename: string;
  model: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress;
  summary: JobSummary | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
  available: boolean;
}

export interface Analytics {
  videos_processed: number;
  total_detections: number;
  unique_fish_count: number;
  species_count: number;
  species_counts: Record<string, number>;
  species_confidence: Record<string, {
    track_count: number;
    min: number;
    mean: number;
    max: number;
  }>;
  confidence: JobSummary['confidence'];
  average_track_duration_seconds: number | null;
  frame_counts: Array<{
    job_id: string;
    filename: string;
    frame_number: number;
    count: number;
  }>;
  evaluation: null;
  evaluation_unavailable_reason: string;
  recent_jobs: Job[];
}

export interface Track {
  track_id: number;
  species: string | null;
  best_confidence: number;
  first_frame: number;
  last_frame: number;
  observed_frames: number;
  duration_seconds: number | null;
}

export interface VideoResults {
  job_id: string;
  filename: string;
  model: string;
  created_at: string;
  completed_at: string;
  source_fps: number | null;
  summary: JobSummary;
  tracks: Track[];
  annotated_video_available: boolean;
  evaluation: null;
}
