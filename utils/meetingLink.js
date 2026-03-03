/**
 * Generate a unique meeting link for a booking.
 * Currently uses a placeholder domain. In production, this can integrate with Zoom/Meet APIs.
 * @param {Object} booking 
 * @returns {string} The generated meeting link
 */
const generateMeetingLink = (booking) => {
    // We can use the booking ID or a random string
    const id = booking.id || Math.random().toString(36).substring(2, 11);
    return `https://meet.yog-samskara.com/${id}`;
};

module.exports = {
    generateMeetingLink
};
