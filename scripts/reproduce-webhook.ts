
import axios from 'axios';

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/webhooks/whatsapp`;

async function testWebhook() {
    console.log('🚀 Sending test webhook to', URL);

    const payload = {
        object: 'whatsapp_business_account',
        entry: [
            {
                id: '123456789',
                changes: [
                    {
                        value: {
                            messaging_product: 'whatsapp',
                            metadata: {
                                display_phone_number: '15555555555',
                                phone_number_id: '123456789',
                            },
                            messages: [
                                {
                                    from: '5511999999999',
                                    id: 'wamid.HBgNM' + Date.now(),
                                    timestamp: Math.floor(Date.now() / 1000).toString(),
                                    text: {
                                        body: 'Hello World',
                                    },
                                    type: 'text',
                                },
                            ],
                        },
                        field: 'messages',
                    },
                ],
            },
        ],
    };

    try {
        const response = await axios.post(URL, payload);
        console.log('✅ Status:', response.status);
        console.log('📄 Data:', response.data);
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testWebhook();
