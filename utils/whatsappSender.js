const axios = require('axios');

const sendWhatsAppMessage = async (to, messageText) => {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;

        if (!token || !phoneId) {
            console.warn('WhatsApp API credentials are not set. Message not sent.');
            return;
        }

        const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

        // Clean the 'to' number (remove non-digits). Meta API expects clean E.164 string without '+'
        const cleanNumber = to.replace(/\D/g, '');

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanNumber,
            type: 'text',
            text: {
                preview_url: false,
                body: messageText
            }
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`WhatsApp message sent to ${cleanNumber}: ${response.data.messages[0].id}`);
        return true;
    } catch (error) {
        console.error('WhatsApp send error:', error.response ? error.response.data : error.message);
        return false;
    }
};

module.exports = { sendWhatsAppMessage };
