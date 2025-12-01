import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env parser
function loadEnv() {
    try {
        const envPath = resolve(process.cwd(), '.env');
        const envFile = readFileSync(envPath, 'utf8');
        const lines = envFile.split('\n');
        for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                process.env[key] = value;
            }
        }
    } catch (e) {
        console.warn('Warning: .env file not found or unreadable');
    }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env');
    console.error('Please add SUPABASE_SECRET_KEY to your .env file (find it in Supabase Dashboard > Project Settings > API)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function getStats() {
    console.log('Fetching stats...');

    // 1. Fetch Users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    // 2. Fetch Subscriptions
    const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');
    if (subsError) throw subsError;

    const totalUsers = users.length;
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    // Calculate User Stats
    const newUsers24h = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - oneDay).length;
    const newUsers7d = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - sevenDays).length;
    const newUsers30d = users.filter(u => new Date(u.created_at).getTime() > now.getTime() - thirtyDays).length;

    const activeUsers24h = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - oneDay).length;
    const activeUsers7d = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - sevenDays).length;
    const activeUsers30d = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now.getTime() - thirtyDays).length;

    // Calculate Subscription Stats
    const proSubs = subscriptions?.filter(s => s.tier === 'pro' && s.status === 'active') || [];
    const freeSubs = subscriptions?.filter(s => s.tier === 'free' && s.status === 'active') || [];

    // Check for expired pro subs
    const expiredProSubs = subscriptions?.filter(s => s.tier === 'pro' && s.status === 'active' && new Date(s.end_date) < now) || [];

    console.log('\nHyperMemo User Statistics');
    console.log('=======================');

    console.log('\n👥 User Growth');
    console.table({
        'Total Users': totalUsers,
        'New (24h)': newUsers24h,
        'New (7d)': newUsers7d,
        'New (30d)': newUsers30d
    });

    console.log('\nactivity User Activity');
    console.table({
        'Active (24h)': activeUsers24h,
        'Active (7d)': activeUsers7d,
        'Active (30d)': activeUsers30d
    });

    console.log('\n💳 Subscriptions');
    const subStats: Record<string, number> = {
        'Total Pro (Active)': proSubs.length,
        'Total Free': freeSubs.length
    };
    if (expiredProSubs.length > 0) {
        subStats['Expired Pro (Active status but past end date)'] = expiredProSubs.length;
    }
    console.table(subStats);

    console.log('\n-----------------------');
}

async function main() {
    try {
        await getStats();
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Error:', String(error));
        }
        process.exit(1);
    }
}

main();
