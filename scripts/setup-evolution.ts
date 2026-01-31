
import axios from 'axios';
import qrcode from 'qrcode-terminal';
import { env } from '../src/config/env';
import readline from 'readline';

const API_URL = env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = env.EVOLUTION_API_KEY || 'carinsight_secret_key_123';
const INSTANCE_NAME = env.EVOLUTION_INSTANCE_NAME || 'carinsight';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
    console.log(`🚀 Configurando Evolution API em ${API_URL}...`);

    const headers = {
        'Content-Type': 'application/json',
        apikey: API_KEY,
    };

    try {
        // 1. Check/Create instance
        await checkOrCreateInstance(headers);

        // 2. Choose connection method
        console.log('\nEscolha o método de conexão:');
        console.log('1 - QR Code (Escaneie com a câmera)');
        console.log('2 - Pairing Code (Código de 8 dígitos via número)');

        const choice = await askQuestion('Opção [1]: ');

        if (choice.trim() === '2') {
            const phoneNumber = await askQuestion('Digite o número do WhatsApp com DDD (ex: 5511999999999): ');
            if (!phoneNumber) {
                console.error('❌ Número obrigatório para Pairing Code.');
                process.exit(1);
            }
            await connectViaPairingCode(headers, phoneNumber.replace(/\D/g, ''));
        } else {
            await connectViaQrCode(headers);
        }

    } catch (error: any) {
        handleError(error);
    } finally {
        rl.close();
    }
}

async function checkOrCreateInstance(headers: any) {
    console.log(`🔍 Verificando instância '${INSTANCE_NAME}'...`);
    try {
        const fetchRes = await axios.get(`${API_URL}/instance/fetchInstances`, { headers });
        const instances = fetchRes.data;
        console.log('Instances encontradas:', JSON.stringify(instances, null, 2));

        // Evolution v2 return array of objects, v1 sometimes return array of strings or different structure
        const instance = Array.isArray(instances)
            ? instances.find((i: any) => i.instance?.instanceName === INSTANCE_NAME || i.name === INSTANCE_NAME)
            : null;

        if (instance) {
            console.log(`✅ Instância '${INSTANCE_NAME}' encontrada.`);
            if (instance.connectionStatus === 'open') {  // Correct property for v2
                console.log('✅ Instância JÁ CONECTADA! 🎉');
                process.exit(0);
            }
        } else {
            // Create instance
            console.log(`🌱 Criando instância '${INSTANCE_NAME}'...`);
            await axios.post(
                `${API_URL}/instance/create`,
                {
                    instanceName: INSTANCE_NAME,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS',
                },
                { headers }
            );
            console.log('✅ Instância criada com sucesso.');
        }
    } catch (error: any) {
        if (error.response?.status === 404 || (Array.isArray(error.response?.data) && error.response.data.length === 0)) {
            console.log(`🌱 Criando instância '${INSTANCE_NAME}' (Fallback)...`);
            await axios.post(
                `${API_URL}/instance/create`,
                {
                    instanceName: INSTANCE_NAME,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS',
                },
                { headers }
            );
        } else {
            throw error;
        }
    }
}

async function connectViaQrCode(headers: any) {
    console.log('📱 Obtendo QR Code para conexão...');
    try {
        const connectRes = await axios.get(`${API_URL}/instance/connect/${INSTANCE_NAME}`, { headers });
        const resData = connectRes.data;

        const qrCode = resData.base64 || resData.code || resData.qrcode;

        if (qrCode) {
            console.log('\n👇 ESCANEIE O QR CODE ABAIXO 👇\n');
            if (qrCode.startsWith('data:image')) {
                console.log('⚠️  Recebido imagem Base64.');
                console.log('Abra http://localhost:8080/manager para escanear, ou tente a opção Pairing Code.');
            } else {
                qrcode.generate(qrCode, { small: true });
            }
        } else {
            console.log('⚠️  Não foi possível obter o QR Code.');
        }
    } catch (error: any) {
        throw error;
    }
}

async function connectViaPairingCode(headers: any, number: string) {
    console.log(`🔐 Solicitando Pairing Code para ${number}...`);

    const queries = [
        { number: number },
        { phoneNumber: number },
        { number: number, pairingCode: 'true' },
        { number: number, usePairingCode: 'true' },
        { number: number, method: 'pairing' }
    ];

    for (const [i, query] of queries.entries()) {
        try {
            const queryString = new URLSearchParams(query as any).toString();
            console.log(`Tentativa ${i + 1} (GET): /instance/connect/${INSTANCE_NAME}?${queryString}`);

            const res = await axios.get(`${API_URL}/instance/connect/${INSTANCE_NAME}?${queryString}`, { headers });

            console.log(`Resposta Tentativa ${i + 1}:`, JSON.stringify(res.data, null, 2));

            const code = res.data.code || res.data.pairingCode;
            if (code) {
                printPairingCode(code);
                return;
            }
        } catch (e: any) {
            console.log(`Tentativa ${i + 1} falhou:`, e.response?.data || e.message);
        }
    }

    console.error('❌ Não foi possível obter o Código de Pareamento.');
    console.error('Verifique os logs do container para ver detalhes do erro.');
}

function printPairingCode(code: string) {
    console.log('\n🔢 SEU CÓDIGO DE PAREAMENTO:\n');
    console.log(`**************************`);
    console.log(`*      ${code.split('').join(' ')}      *`);
    console.log(`**************************`);
    console.log('\n👉 No seu WhatsApp:');
    console.log('1. Vá em Configurações > Aparelhos Conectados');
    console.log('2. Conectar um aparelho');
    console.log('3. "Conectar com número de telefone" (link abaixo do QR Code)');
    console.log('4. Digite este código.');
}

function handleError(error: any) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
        console.error('💡 Dica: O serviço da Evolution API parece estar offline.');
        console.error('   Rode "docker-compose -f docker-compose.evolution.yml up -d"');
    }
}

main();
