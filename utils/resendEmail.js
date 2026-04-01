const sendResendEmail = async ({ to, subject, html, text }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME || 'FlowNest Studio';

    if (!apiKey) {
        throw new Error('Missing RESEND_API_KEY in environment variables');
    }
    if (!fromEmail) {
        throw new Error('Missing RESEND_FROM_EMAIL in environment variables');
    }

    const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html,
            text
        })
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend send failed (${res.status}): ${body || res.statusText}`);
    }

    return res.json().catch(() => null);
};

module.exports = {
    sendResendEmail
};

