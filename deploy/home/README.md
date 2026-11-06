# Home server deployment

This project runs at **https://tmatch.prooood.ru** on a home server (Coolify behind Traefik) and redeploys itself on every
push to `master`.

How it works: `.github/workflows/deploy-home.yml` builds the images (backend, ml, web) for linux/amd64, pushes them to GHCR
tagged with the commit SHA, then joins the owner's Tailscale network as `tag:ci` and runs one forced SSH command
(`tmatch <sha>`). The server sets `IMAGE_TAG`, redeploys the Coolify service and waits until every container is healthy
on that tag; the last step checks the public site.

Repository secrets: `SARA_DEPLOY_KEY`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`. Variables: `SARA_TAILSCALE_IP`,
`SARA_HOST_KEY`, `TMATCH_HOST`. The compose file, database backups and environment variables live on the server,
not in this repository.

The copy is kept in step with the upstream repository by `.github/workflows/sync-upstream.yml` (every 3 hours it merges
new upstream commits and starts a deploy).