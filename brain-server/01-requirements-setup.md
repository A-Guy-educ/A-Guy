# Brain Server — Requirements Setup

Step-by-step checklist to get all accounts, keys, and access ready before implementation.

---

## Step 1: Hetzner Account

- [ ] Create account at https://www.hetzner.com/cloud
- [ ] Add payment method (credit card or PayPal)
- [ ] Provision server: CX32 (4 vCPU, 8GB RAM, 80GB SSD, ~$7/mo)
  - Location: Choose closest datacenter (EU)
  - OS: Ubuntu 24.04
  - SSH key: Add your existing key or generate new one
- [ ] Note the server IP

## Step 2: SSH Access

- [ ] Generate SSH key (if needed): `ssh-keygen -t ed25519 -C "brain-server"`
- [ ] Add public key to Hetzner during provisioning
- [ ] Verify SSH access: `ssh root@<server-ip>`

## Step 3: Tailscale

- [ ] Already have Tailscale account (used for remote-agent)
- [ ] Install Tailscale on VPS: `curl -fsSL https://tailscale.com/install.sh | sh`
- [ ] Join tailnet: `tailscale up --authkey=<authkey>`
- [ ] Note the Tailscale IP
- [ ] Verify from Mac: `ping <tailscale-ip>`

## Step 4: Tailscale Auth Key for CI

- [ ] Go to Tailscale admin: Settings > Keys
- [ ] Generate auth key (ephemeral, reusable, tagged `ci`)
- [ ] Add as GitHub secret: `TAILSCALE_AUTHKEY`
- [ ] Add `tailscale-action` to CI workflow (test in a separate PR first)

## Step 5: GitHub Webhook

- [ ] Generate webhook secret: `openssl rand -hex 32`
- [ ] Save secret on VPS as env var
- [ ] Go to GitHub repo > Settings > Webhooks > Add webhook
  - Payload URL: `http://<tailscale-ip>:9000/hooks/repo-sync`
  - Content type: `application/json`
  - Secret: the generated secret
  - Events: Just the `push` event
  - Active: Yes

## Step 6: Docker on VPS

- [ ] SSH into VPS
- [ ] Install Docker:
  ```bash
  apt-get update && apt-get install -y docker.io docker-compose-v2
  systemctl enable docker
  ```
- [ ] Verify: `docker run hello-world`

## Step 7: Clone Repo on VPS

- [ ] Generate deploy key (read-only): `ssh-keygen -t ed25519 -C "brain-server-deploy"`
- [ ] Add public key to GitHub repo: Settings > Deploy keys (read-only)
- [ ] Clone: `git clone git@github.com:A-Guy-educ/A-Guy.git /opt/repo`
- [ ] Verify: `ls /opt/repo/src/`

## Step 8: Verify API Keys

- [ ] Anthropic API key available (already used by pipeline): `ANTHROPIC_API_KEY`
- [ ] Add to VPS env (for architect brain): stored in `/opt/brain-server/.env`

## Step 9: Firewall

- [ ] Block all public ports except SSH (22):
  ```bash
  ufw default deny incoming
  ufw allow ssh
  ufw enable
  ```
- [ ] All other traffic goes through Tailscale (no public exposure)

---

## Verification Checklist

After completing all steps, verify:

- [ ] Can SSH into VPS from Mac
- [ ] Can reach VPS via Tailscale IP from Mac
- [ ] Docker runs on VPS
- [ ] Repo is cloned and accessible at `/opt/repo`
- [ ] Webhook fires on push (check GitHub delivery logs)
- [ ] Tailscale auth key works in CI (test with a dummy workflow)

---

## Estimated Time: 1-2 hours
