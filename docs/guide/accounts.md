# Accounts and cloud sync

Pocket Engine has accounts for the people who use the editor. They keep your games in your account and sync them between your phone, tablet and computer.

The accounts work in two steps:

1. **Now:** everyone has a **profile on this device**: a name and a colour, shown on the Home screen. Games are saved on the device, like before.
2. **Once a Supabase server is connected:** people can **sign in** (email and password, or Google, Apple, GitHub… if you turn them on), and their games **sync to their account**.

> These are accounts for Pocket Engine itself. For accounts *inside your games* (players signing in, cloud saves, leaderboards), use PlayFab: see [Saving, online and the phone](#/guide/saving-online).

## Your profile

Tap the round picture at the top of the Home screen.

- Type your **name** and pick a **colour**. Home greets you by name.
- Without a server, the window says *Profile on this device*. Back up your games with *☰ → Back Up All Games*.

## Signing in (with a server)

- **Create account** with your email and a password. If the server asks people to confirm their email, a link arrives first: tap it and sign in.
- **Sign in** on any other device with the same email and password, or **Continue with Google** (or any other sign-in your server has turned on).
- **Forgot password?** sends an email to choose a new one.
- When you sign in, the games on this device go up to your account and the games in your account come down. The round picture gets a green dot.

### How syncing works

- Every change is sent up a few seconds after you stop editing, and when the device comes back online.
- **Sync now** in the Account window syncs straight away. It shows when it last synced.
- The newest version wins. When the same game was changed on two devices since the last sync, both are kept: the other device's version arrives as a copy named *… (other device)*.
- A game deleted on one device is removed from the others the next time they sync, unless it was changed there afterwards (then it is kept).
- If the game you have open was changed on another device, it reloads with the new version (*Updated from your other device*).
- Games still work offline: they are saved on the device first, and sync when there is a connection.
- **Sign out** keeps the games on the device.

## Connecting Supabase (for the owner)

[Supabase](https://supabase.com) is a hosted database with sign-in built in. The free plan is enough to start.

### 1. Make a project

1. Sign up at supabase.com and create a **new project** (pick a region near your players and keep the database password somewhere safe).
2. Open **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](https://github.com/kingimann/AppTest/blob/master/supabase/schema.sql) and press **Run**. It makes one table, `projects`, with rules so each person can only read and change their own games.
3. Open **Authentication → URL Configuration** and set:
   - **Site URL:** where your editor lives, e.g. `https://kingimann.github.io/AppTest/editor/` (or your own domain);
   - **Redirect URLs:** the same address. This is where email links and Google sign-in come back to.
4. Optional: **Authentication → Sign In / Providers** turns on Google, Apple, GitHub and others. The editor shows a *Continue with…* button for each one that is on. Turn **Confirm email** off while testing if you don't want to wait for emails.

### 2. Try it on your device

In the editor, open **Account → Connect a server (for the owner)** and paste:

- the **Project URL** (Project Settings → API), like `https://abcdefghijkl.supabase.co`;
- the **anon public** key from the same page.

*Connect* checks them and lists the sign-in methods that are on. This only connects **your** device, so you can try it out first.

### 3. Turn it on for everyone

Put the same two values in `editor/cloud-config.js`:

```js
export const CLOUD = {
  provider: 'supabase',
  url: 'https://abcdefghijkl.supabase.co',
  anonKey: 'eyJhbGciOi…',
};
```

Publish the site again. Everyone who opens the editor can now sign in.

> **Is it safe to put the key in the site?** Yes: the *anon* key is made to be public. What protects people's games are the row-level security rules from `schema.sql`. Never put the **service_role** key in the site.

## Limits and good to know

- Each game is stored as one record. Games with many big imported pictures or sounds take more space; Supabase's free plan has 500 MB of database.
- Pictures on the Home screen sync with the games.
- Restore points and the *Back Up All Games* file still work as before, signed in or not.
- To leave Supabase, empty `cloud-config.js`: everyone's games stay on their devices.
