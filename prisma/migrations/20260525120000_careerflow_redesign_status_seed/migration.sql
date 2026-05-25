-- CAREERFLOW: redesign (PR F) — status reconciliation.
-- Seed the two new pipeline stages (wishlist, screening) used by the
-- Applications board for databases that predate them. New users already get
-- these via the signup seed (src/actions/auth.actions.ts -> JOB_STATUSES).
-- JobStatus.value is UNIQUE, so INSERT OR IGNORE is a no-op when the rows
-- already exist, making this migration idempotent and safe to re-run.
INSERT OR IGNORE INTO "JobStatus" ("id", "label", "value") VALUES
  ('2c205d36-3697-48ef-b9a4-d465cc9f95c4', 'Wishlist', 'wishlist'),
  ('c0a8a52d-e25b-4429-9408-88dfdc30dc9d', 'Screening', 'screening');
