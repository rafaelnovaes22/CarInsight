
import * as dotenv from 'dotenv';
dotenv.config();

if (process.env.FIRECRAWL_API_KEY) {
    console.log('✅ FIRECRAWL_API_KEY is found (Length: ' + process.env.FIRECRAWL_API_KEY.length + ')');
} else {
    console.log('❌ FIRECRAWL_API_KEY is NOT set.');
}
