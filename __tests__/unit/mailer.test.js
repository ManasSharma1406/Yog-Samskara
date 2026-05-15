const nodemailer = require('nodemailer');

// Mock Nodemailer before requiring mailer
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport = jest.fn().mockReturnValue({
    sendMail: mockSendMail
});

const { 
    sendWelcomeEmail, 
    sendPaymentConfirmation, 
    sendBookingConfirmation, 
    sendClassReminder 
} = require('../../utils/mailer');

describe('Mailer Utility Unit Tests', () => {

    beforeEach(() => {
        mockSendMail.mockClear();
    });

    test('sendWelcomeEmail should queue and send email to customer and admin', async () => {
        const email = 'customer@example.com';
        const name = 'John Doe';
        
        await sendWelcomeEmail(email, name);

        // Wait for async queue to process
        for (let i = 0; i < 10; i++) {
            if (mockSendMail.mock.calls.length >= 2) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(mockSendMail).toHaveBeenCalledTimes(2);
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: email }));
    });

    test('sendPaymentConfirmation should send detailed receipt', async () => {
        const details = {
            userName: 'Jane Doe',
            planName: 'Pro Pack',
            amount: 500,
            transactionId: 'txn_123',
            orderId: 'order_456'
        };

        await sendPaymentConfirmation('jane@example.com', details);
        
        for (let i = 0; i < 10; i++) {
            if (mockSendMail.mock.calls.length >= 2) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    test('sendBookingConfirmation should send class details', async () => {
        const details = {
            userName: 'Bob',
            className: 'Vinyasa Yoga',
            date: '2026-06-01',
            time: '08:00 AM',
            zoomLink: 'https://zoom.us/test'
        };

        await sendBookingConfirmation('bob@example.com', details);
        
        for (let i = 0; i < 10; i++) {
            if (mockSendMail.mock.calls.length >= 2) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    test('sendClassReminder should send time-sensitive alert', async () => {
        const details = {
            userName: 'Alice',
            className: 'Hatha Yoga',
            zoomLink: 'https://zoom.us/test'
        };

        await sendClassReminder('alice@example.com', details, 15);
        
        for (let i = 0; i < 10; i++) {
            if (mockSendMail.mock.calls.length >= 2) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
});
