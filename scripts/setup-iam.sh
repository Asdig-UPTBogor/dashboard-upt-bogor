#!/usr/bin/env bash
#
# setup-iam.sh — Consistent IAM config for UPT Bogor Dashboard ecosystem
#
# All CR services use the same default Compute Engine service account.
# This script ensures all necessary permissions are in place.
#
# Usage: bash scripts/setup-iam.sh
#

set -euo pipefail

PROJECT_ID="gcp-bridge-meshvpn"
REGION="asia-southeast2"
SA="21805978769-compute@developer.gserviceaccount.com"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UPT Bogor Dashboard — IAM Setup"
echo "  Project:  $PROJECT_ID"
echo "  SA:       $SA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Project-level roles ──────────────────────────────────
# These grant the SA access to specific GCP APIs across the project.

PROJECT_ROLES=(
    # Data access
    "roles/bigquery.dataViewer"         # BigQuery: read page snapshots
    "roles/bigquery.jobUser"            # BigQuery: execute queries
    "roles/datastore.user"              # Firestore: read/write page configs
    "roles/storage.admin"               # GCS + Google Drive: SLD images
    
    # Operations
    "roles/logging.viewer"              # Cloud Logging: read worker & scheduler logs
    "roles/cloudscheduler.admin"        # Cloud Scheduler: pause/resume/update jobs
    "roles/cloudtasks.enqueuer"         # Cloud Tasks: enqueue WA notification tasks
    
    # Build
    "roles/cloudbuild.builds.builder"   # Cloud Build: build Docker images
)

echo ""
echo "▸ Applying project-level roles..."
for role in "${PROJECT_ROLES[@]}"; do
    echo "  + $role"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA" \
        --role="$role" \
        --quiet --no-user-output-enabled 2>/dev/null || true
done
echo "  ✓ Project roles applied"

# ── Service-to-service invoker ───────────────────────────
# Dashboard CR needs to call other CR services with OIDC tokens.
# Each target service needs run.invoker binding for the dashboard SA.

INVOKE_TARGETS=(
    "dashboard-sync-worker"     # Worker sync: logs, trigger, config
    "thor-worker"               # Thor: restart, validate, config, logs  
    "wa-notifier"               # WA Notifier: send notifications
)

echo ""
echo "▸ Applying service-to-service invoker bindings..."
for target in "${INVOKE_TARGETS[@]}"; do
    echo "  + $target → run.invoker"
    gcloud run services add-iam-policy-binding "$target" \
        --project="$PROJECT_ID" \
        --region="$REGION" \
        --member="serviceAccount:$SA" \
        --role="roles/run.invoker" \
        --quiet --no-user-output-enabled 2>/dev/null || true
done
echo "  ✓ Invoker bindings applied"

# ── Verification ─────────────────────────────────────────
echo ""
echo "▸ Verifying project roles..."
CURRENT_ROLES=$(gcloud projects get-iam-policy "$PROJECT_ID" \
    --flatten="bindings[].members" \
    --filter="bindings.members:$SA" \
    --format="value(bindings.role)" 2>/dev/null | sort)

echo "  Current roles:"
echo "$CURRENT_ROLES" | while IFS= read -r role; do
    echo "    ✓ $role"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ IAM setup complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
