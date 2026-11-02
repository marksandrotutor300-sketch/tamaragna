# Deploy: Render Free + Supabase Free

Step-by-step deployment for the current app. The live-room service is an
in-process SSE server, so Render must run **one** instance. Supabase is the
Postgres database; do not use Supabase Realtime as the game loop.

Recent platform checks (November 2026):

- Render Free still provides **750 instance hours/month**, **512 MB / 0.1 CPU**,
  sleeps after **15 minutes** without inbound traffic, and takes about a minute
  to wake.
- Render’s `preDeployCommand` is available for **paid** web services only. On
  Free, this repo runs `npm run db:migrate` at the end of `buildCommand`.
- Supabase Free still has **500 MB**, **5 GB egress**, pauses after **one week
  of inactivity**, allows **2 active projects**, and has no automated backups.
- Supabase recommends a **direct connection** for native migration tools and a
  **session pooler** for a persistent IPv4 backend like Render. Use the shared
  **session pooler on port 5432**, not the transaction pooler on 6543.
- The app keeps `prepare: false` for transaction-mode compatibility; session
  mode accepts it too.

## 0. Prerequisites

- Repository: <https://github.com/marksandrotutor300-sketch/tamaragna> (public, `main`).
- A Render account and a Supabase account.
- `render.yaml` is at the repository root.
- `npm run typecheck`, `npm test`, and `npm run build` pass locally (typecheck and the 70
  unit tests passed on the first pushed commit).

### First push (done once)

`gh` is not required; Git Credential Manager supplies the GitHub login.

```bash
git remote add origin https://github.com/marksandrotutor300-sketch/tamaragna.git
git push -u origin main
```

If the repository does not exist yet, create it empty at <https://github.com/new>
(name `tamaragna`, no README), or with the GitHub CLI:

```bash
gh repo create tamaragna --public --source . --remote origin --push
```

After the first push, `autoDeployTrigger: commit` redeploys on every later push to `main`.
No extra CI is needed for this deployment.

## 1. Create the Supabase database

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and create a
   project. Choose the region closest to your Render service (Render defaults to
   Oregon).
2. Save the database password. If it contains characters such as `@`, `:`, `/`,
   `?`, `#`, or spaces, percent-encode them in the URL.
3. Wait for the project to finish provisioning.
4. Click **Connect** at the top of the project.
5. Choose **Session pooler** (IPv4, port `5432`). Do not choose **Transaction
   pooler** for this Render deployment.
6. Copy the URI. It looks like:

   ```text
   postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
   ```

7. Replace `PASSWORD` with the database password. Ensure the URI ends with
   `?sslmode=require` (add it if the copied string lacks it).
8. Keep the Supabase project awake for the first deploy. Free projects pause
   after a week without activity.

You do **not** need to enable Supabase Realtime, Auth, Storage, or Edge
Functions for this app. `npm run db:migrate` creates the schema in the `public`
schema through the pooler.

## 2. Create the Render Blueprint

1. Push the repository, including `render.yaml`, to GitHub. It is already at
   <https://github.com/marksandrotutor300-sketch/tamaragna>.
2. Fastest path: open the README's **Deploy to Render** button
   (`https://render.com/deploy?repo=https://github.com/marksandrotutor300-sketch/tamaragna`),
   or in the Render Dashboard click **New → Blueprint**.
3. Connect GitHub and select the repository.
4. Choose the branch containing `render.yaml` (usually `main`).
5. Render reads `render.yaml` and prompts for the `sync: false` variables:
   - `DATABASE_URL`: paste the Supabase **session pooler** URI.
   - `NEXT_PUBLIC_SITE_URL`: leave blank for the first deploy.
   - `RESEND_API_KEY`, `EMAIL_FROM`, and the three `VAPID_*` values: leave blank
     unless you are enabling email/push now.
6. Confirm the generated secrets:
   - `LIVE_TOKEN_SECRET`
   - `ADMIN_TOKEN`
   - `CRON_SECRET`
7. Confirm the service uses the **Free** instance plan and a single instance.
8. Click **Create Blueprint** / **Apply**.

The Blueprint has:

```yaml
plan: free
autoDeployTrigger: commit
healthCheckPath: /api/health
buildCommand: npm ci --include=dev && npm run build && npm run db:migrate
startCommand: npm start
```

The migration is in the build command **because Render Free does not support
`preDeployCommand`**. If you later upgrade to a paid instance, move it to
`preDeployCommand: npm run db:migrate` and remove it from `buildCommand`.

## 3. Watch the first build

The build should run in this order:

1. `npm ci --include=dev`
2. `npm run build` (runs `prebuild` data generation if needed)
3. `npm run db:migrate`
4. `npm start`

Expected signs of success:

- Build log ends with a successful Next.js build.
- Migration log applies `0006_seven_upgrades`.
- The service starts on Render’s assigned `PORT`.
- `/api/health` returns `200` with:

```json
{
  "status": "ok",
  "db": "ok",
  "schemaVersion": "0006_seven_upgrades"
}
```

If the health check fails, read the build log first. The most common causes are a
missing/paused `DATABASE_URL`, an unencoded password, or using the wrong pooler
host/username.

## 4. Set the public URL and redeploy

1. Copy the Render URL, for example `https://tamaragna.onrender.com`.
2. Open **Environment** for the service.
3. Set `NEXT_PUBLIC_SITE_URL` to that exact URL, with no trailing slash.
4. Trigger **Manual Deploy → Deploy latest commit** or restart the service.

Canonical URLs, sitemap entries, share links, and OG metadata use this value.

## 5. Configure the operator settings

1. Copy the generated `ADMIN_TOKEN` from Render’s Environment page.
2. Use `/admin/balance?token=...` for telemetry and for creating ranked cups.
3. Keep `ADMIN_TOKEN` private; do not put it in a public URL.
4. Optional magic-link email:
   - Create a Resend API key and verify your sending domain.
   - Set `RESEND_API_KEY` and `EMAIL_FROM`.
   - Without them, the magic link is logged on the server instead of emailed.
5. Optional Web Push:
   - Run `npx web-push generate-vapid-keys`.
   - Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
6. Optional reminders:
   - Call `POST /api/cron/reminders` with `x-cron-secret: $CRON_SECRET` from an
     external scheduler. Render Free cron jobs are not required for the game.

## 6. Smoke-test the deployment

Run these against the deployed URL:

```bash
curl -s https://YOUR-SERVICE.onrender.com/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-SERVICE.onrender.com/
```

Then in a browser:

- Hatch a first pet on `/hatch`; confirm it appears on `/ranch`.
- Open `/more`, `/guild`, `/market`, `/expeditions`, `/ranked`, `/legacy`, and
  `/dojo`; each should render.
- Create a guild and open a raid; attack with a team.
- Move a storage pet to the market, buy it from a second browser profile, and
  confirm ownership/coins.
- Start an expedition; claim is correctly blocked until the timer ends.
- Publish a trainer card from `/account`; visit it from another profile.
- Retire a level-50 pet on `/legacy`; confirm the mark.
- Train a ghost on `/dojo`; spar and open the stored battle.
- Queue two profiles on `/pvp/live`; confirm the SSE arena loads and the match
  finishes.
- Open Supabase **Table Editor** and confirm the new tables exist.

## 7. Free-plan limits you must accept

- **One Render instance.** Do not enable scaling; live rooms and bracket state
  are in memory.
- **Sleep after 15 minutes.** The next request cold-starts in about a minute.
  Active live rooms are lost on sleep/restart/deploy.
- **750 instance hours/month.** One always-on free service uses roughly the
  monthly allowance.
- **Build pipeline minutes and bandwidth** are metered separately.
- **Render may suspend** a Free service that generates unusually high outbound
  traffic, including heavy external-database traffic.
- **No shell/SSH, one-off jobs, persistent disks, or free Postgres longevity.**
  Use Supabase for the database; Render Free Postgres expires after 30 days.
- **Supabase Free pauses after a week of inactivity.** Unpause in the dashboard
  if `/api/health` starts returning `503`.
- **Supabase Free has no automated backups.** Export important data yourself.
- **No production SLA.** Move to a paid instance and a durable room service
  before ranked/high-traffic play.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build fails at `db:migrate` | Bad/paused `DATABASE_URL` | Check the session-pooler URI, password encoding, project status |
| `password authentication failed` | Wrong password or username | Use `postgres.PROJECT_REF` for the shared pooler; URL-encode the password |
| `Tenant or user not found` | Wrong pooler host/username | Copy the full session-pooler URI from **Connect** |
| `prepared statement already exists` | Prepared statements on transaction mode | Keep `prepare: false`; use session mode on Render |
| Health check 503 | Supabase paused or DB unreachable | Unpause Supabase; redeploy/restart |
| App returns 502 | App not listening on Render’s port | Keep `HOSTNAME=0.0.0.0`; do not hardcode a port |
| Share/OG URLs point at localhost | `NEXT_PUBLIC_SITE_URL` missing | Set it to the Render URL and redeploy |
| Service sleeps during a live match | Free plan idle policy | Accept the limitation or upgrade; matches are short |
| Live rooms disappear after deploy | In-memory room service | Expected on Free; use one instance and avoid deploys during play |

## 9. Upgrade path

- Move Render to a paid instance and add `preDeployCommand`.
- Keep Supabase as Postgres; use a paid compute size/backups.
- Move live rooms to PartyServer/Cloudflare Durable Objects or Colyseus for
  multi-instance, restart-safe live play.
- Add a scheduler for ranked cups and an external cron for reminders.
