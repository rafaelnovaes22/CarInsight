
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
        const instance = instances.find((i: any) => i.instance.instanceName === INSTANCE_NAME);

        if (instance) {
            console.log(`✅ Instância '${INSTANCE_NAME}' encontrada.`);
            if (instance.instance.status === 'open') {
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

    // Tentativa 1: Endpoint GET /instance/connect/{instance}/{number}
    try {
        const res = await axios.get(`${API_URL}/instance/connect/${INSTANCE_NAME}/${number}`, { headers });
        const code = res.data.code || res.data.pairingCode;

        if (code) {
            printPairingCode(code);
            return;
        }
    } catch (e) { }

    // Tentativa 2: POST /instance/connect/{instance} { number: "..." }
    try {
        const res = await axios.post(`${API_URL}/instance/connect/${INSTANCE_NAME}`, { number }, { headers });
        const code = res.data.code || res.data.pairingCode;

        if (code) {
            printPairingCode(code);
            return;
        }
    } catch (e) { }

    console.error('❌ Não foi possível obter o Código de Pareamento.');
    console.error('Verifique se o container da Evolution API está rodando na versão v2.0+.');
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
