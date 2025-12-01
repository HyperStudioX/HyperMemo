# HyperMemo Admin CLI Tools

This document outlines the command-line interface (CLI) tools available for administrators to manage the HyperMemo application. These scripts allow for managing user subscriptions and viewing application statistics directly from the terminal.

## Prerequisites

To use these tools, you must have the `SUPABASE_SECRET_KEY` (Service Role Key) configured in your `.env` file. This key provides administrative access to the Supabase database.

```env
SUPABASE_SECRET_KEY=your_service_role_key
```

## Available Commands

### 1. Subscription Management (`pnpm run sub`)

Manage user subscription tiers and durations.

**Script Location:** `scripts/manage-subscription.ts`

**Usage:**

```bash
pnpm run sub <command> [arguments]
```

**Commands:**

*   **Get Subscription Details:**
    View the current subscription status for a user.
    ```bash
    pnpm run sub get <email>
    ```

*   **Set Subscription:**
    Update a user's subscription tier and duration.
    ```bash
    pnpm run sub set <email> <tier> [days]
    ```
    *   `email`: The user's email address.
    *   `tier`: `free` or `pro`.
    *   `days`: (Optional) Duration in days for the subscription (default: 30).

**Examples:**

```bash
# Check a user's subscription
pnpm run sub get user@example.com

# Upgrade a user to Pro for 30 days (default)
pnpm run sub set user@example.com pro

# Upgrade a user to Pro for 1 year
pnpm run sub set user@example.com pro 365

# Downgrade a user to Free
pnpm run sub set user@example.com free
```

### 2. User Statistics (`pnpm run stats`)

View an overview of user growth, activity, and subscription metrics.

**Script Location:** `scripts/admin-stats.ts`

**Usage:**

```bash
pnpm run stats
```

**Output:**

The command displays a summary report including:

*   **User Growth:**
    *   Total registered users.
    *   New users in the last 24 hours, 7 days, and 30 days.
*   **User Activity:**
    *   Active users (based on sign-in) in the last 24 hours, 7 days, and 30 days.
*   **Subscriptions:**
    *   Total active Pro subscriptions.
    *   Total Free subscriptions.
    *   Expired Pro subscriptions (if any).

**Example Output:**

```text
HyperMemo User Statistics
=======================

👥 User Growth
┌─────────────┬────────┐
│ (index)     │ Values │
├─────────────┼────────┤
│ Total Users │ 150    │
│ New (24h)   │ 5      │
│ New (7d)    │ 25     │
│ New (30d)   │ 80     │
└─────────────┴────────┘

activity User Activity
┌──────────────┬────────┐
│ (index)      │ Values │
├──────────────┼────────┤
│ Active (24h) │ 45     │
│ Active (7d)  │ 110    │
│ Active (30d) │ 140    │
└──────────────┴────────┘

💳 Subscriptions
┌────────────────────┬────────┐
│ (index)            │ Values │
├────────────────────┼────────┤
│ Total Pro (Active) │ 12     │
│ Total Free         │ 138    │
└────────────────────┴────────┘
```
