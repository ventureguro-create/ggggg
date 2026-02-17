/**
 * Time Series Admin Configuration
 */

export interface TimeseriesConfig {
  default_window: number;        // days
  retention_days: number;        // how long to keep data
  mock_seeding_enabled: boolean; // allow mock data generation
  charts_enabled: boolean;       // enable charts in UI
  signal_overlays: boolean;      // show signal overlays on charts
}

export const timeseriesAdminConfig: TimeseriesConfig = {
  default_window: 30,
  retention_days: 180,
  mock_seeding_enabled: true,
  charts_enabled: true,
  signal_overlays: true,
};

export function updateTimeseriesConfig(updates: Partial<TimeseriesConfig>): TimeseriesConfig {
  Object.assign(timeseriesAdminConfig, updates);
  return timeseriesAdminConfig;
}

export function getTimeseriesConfig(): TimeseriesConfig {
  return { ...timeseriesAdminConfig };
}
