# Connecting Google Health (Fitbit): the one-time setup

Email's Gym reads each person's Fitbit data (steps, resting heart rate, sleep, weight, and runs or
walks the watch detects) through the **Google Health API**, with their own Google account. The
old Fitbit Web API was switched off on 2 November 2026.

This setup is done once, by the server owner (you), in Google Cloud. It takes about 15 minutes.
Claude can't do it because it happens in your Google account.

## Before you start

- Your own Fitbit must already show up in the **Google Health** app on your phone (signed in with
  Google). Accounts that never moved over from Fitbit get an error until they do: Google's
  migration steps are at support.google.com/fitbit/answer/14237024.

## 1. Create the project

1. Go to **console.cloud.google.com** and sign in with your Google account.
2. Top bar → project picker → **New project**. Name it `Emails Gym`. Create, then make sure it is
   the selected project.

## 2. Turn on the API

1. Open **APIs & Services → Library**.
2. Search **Google Health API** and click **Enable**.

## 3. The consent screen (what friends see when they connect)

1. Open **Google Auth Platform** (APIs & Services → OAuth consent screen).
2. **Get started**: App name `Email's Gym`, support email yours. Audience: **External**.
   Contact email yours. Agree and create.
3. **Branding**: App domain / home page `https://emailsgym.com`. Authorized domain
   `emailsgym.com`. Save.
4. **Data access → Add or remove scopes**: paste these three and add them:
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`

   Save.
5. **Audience → Test users → Add users**: your own Google address and the Google address of every
   friend who will connect a Fitbit (up to 100). Leave the publishing status on **Testing**.

## 4. The OAuth client (the key the server uses)

1. **Google Auth Platform → Clients → Create client**.
2. Application type **Web application**, name `emailsgym.com`.
3. **Authorized redirect URIs → Add URI**: `https://emailsgym.com/api/google-health/callback`
   (exactly this, no trailing slash).
4. Create. Copy the **Client ID** and **Client secret** (download the JSON too, as a backup).

## 5. Give them to the server

Send them to Claude in this session (they go only into the server's `.env`, never into git), or do
it yourself:

```bash
ssh -i ~/.ssh/emails_gym_ed25519 deploy@2.31.159.190
cd ~/emails-gym
nano .env        # add the two lines below, save
docker compose up -d
```

```
GOOGLE_HEALTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_HEALTH_CLIENT_SECRET=...
```

## 6. Connect

In the app: **Settings → Integrations → Google Health (Fitbit) → Connect**. Google asks you to
pick your account and allow the three kinds of data; you come back to the app, and the last 30
days arrive within a few seconds. Home's Steps and Resting HR cards fill in.

## What to know

- **Weekly reconnect while in Testing.** Google expires a Testing app's connection after 7 days.
  The app then shows **Reconnect** on the Google Health card and on Home; one tap and an account
  pick fixes it. The data already pulled stays.
- **To stop the weekly reconnect** the project has to be **published**, and because health data is
  a *restricted* scope, Google requires a privacy policy, a verification review and a third-party
  security assessment first. That is worth it only if more than a handful of people use it.
- **Unverified warning.** Friends see "Google hasn't verified this app" on the consent screen.
  That is expected for a Testing app: **Continue**.
- **Disconnect** any time in Settings; it revokes the access at Google and deletes the copy on the
  server.
