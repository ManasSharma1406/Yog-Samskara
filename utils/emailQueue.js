const fs = require('fs').promises;
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '../data/emailQueue.json');

const MAX_ATTEMPTS = Number(process.env.EMAIL_REMINDER_MAX_ATTEMPTS || 3);
const RETRY_DELAY_MS = Number(process.env.EMAIL_REMINDER_RETRY_DELAY_MS || 10 * 60 * 1000);

const ensureQueueFile = async () => {
    try {
        await fs.access(QUEUE_PATH);
    } catch {
        await fs.mkdir(path.dirname(QUEUE_PATH), { recursive: true });
        await fs.writeFile(QUEUE_PATH, JSON.stringify([], null, 2));
    }
};

const readQueue = async () => {
    await ensureQueueFile();
    const raw = await fs.readFile(QUEUE_PATH, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeQueue = async (queue) => {
    await fs.writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2));
};

const upsertQueueEntry = async ({ key, to, subject, html, scheduledAtISO }) => {
    const queue = await readQueue();
    const existing = queue.find((q) => q.key === key);

    const now = Date.now();
    const scheduledAt = new Date(scheduledAtISO).getTime();
    const nextAttemptAt = Math.max(scheduledAt, now);

    if (existing) {
        if (existing.status === 'sent') return { queued: false, reason: 'already_sent' };

        existing.to = to;
        existing.subject = subject;
        existing.html = html;
        existing.scheduledAtISO = scheduledAtISO;
        existing.nextAttemptAtISO = new Date(nextAttemptAt).toISOString();
        await writeQueue(queue);
        return { queued: true, reason: 'updated' };
    }

    queue.push({
        key,
        type: 'class_reminder',
        to,
        subject,
        html,
        scheduledAtISO,
        nextAttemptAtISO: new Date(nextAttemptAt).toISOString(),
        attemptCount: 0,
        status: 'scheduled',
        lastError: null,
        createdAtISO: new Date().toISOString(),
        sentAtISO: null
    });

    await writeQueue(queue);
    return { queued: true, reason: 'created' };
};

const processEmailQueue = async ({ sendEmail }) => {
    const queue = await readQueue();
    const now = Date.now();
    let changed = false;

    for (const entry of queue) {
        if (!entry || entry.status === 'sent') continue;

        const nextAttemptAt = entry.nextAttemptAtISO ? new Date(entry.nextAttemptAtISO).getTime() : now;
        if (nextAttemptAt > now) continue;

        try {
            await sendEmail({
                to: entry.to,
                subject: entry.subject,
                html: entry.html
            });

            entry.status = 'sent';
            entry.sentAtISO = new Date().toISOString();
            entry.lastError = null;
            changed = true;
        } catch (err) {
            entry.attemptCount = (entry.attemptCount || 0) + 1;
            entry.lastError = err?.message || String(err);

            if (entry.attemptCount >= MAX_ATTEMPTS) {
                entry.status = 'failed';
            } else {
                entry.nextAttemptAtISO = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
            }
            changed = true;
        }
    }

    if (changed) await writeQueue(queue);
};

module.exports = {
    upsertQueueEntry,
    processEmailQueue
};

