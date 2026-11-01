import json
import re

# Função para detectar categoria baseado no modelo
def detect_category(model):
    model_upper = model.upper()
    
    # SUV
    suv_keywords = ['CRETA', 'COMPASS', 'RENEGADE', 'TRACKER', 'ECOSPORT', 'DUSTER', 
                    'HR-V', 'TUCSON', 'SPORTAGE', 'RAV4', 'TIGGO', 'KORANDO', 
                    'PAJERO', 'T-CROSS', 'T CROSS', 'AIRCROSS', 'STONIC', 'GRAND LIVINA', 'FREEMONT']
    
    # SEDAN
    sedan_keywords = ['CIVIC', 'COROLLA', 'CITY', 'CRUZE', 'HB20S', 'SENTRA', 
                      'LOGAN', 'VOYAGE', 'FOCUS', 'PRIUS', 'ARRIZO']
    
    # HATCH
    hatch_keywords = ['ONIX', 'HB20', 'FIESTA', 'KA', 'CELTA', 'UNO', 'PALIO', 
                      'FOX', 'MOBI', 'KWID', 'ETIOS', 'YARIS', 'C3', '207', 
                      'PUNTO', 'SOUL']
    
    # PICKUP
    pickup_keywords = ['TORO', 'STRADA']
    
    # MINIVAN
    minivan_keywords = ['MERIVA', 'IDEA']
    
    # MOTO
    moto_keywords = ['NEO']
    
    # Verifica cada categoria
    for keyword in moto_keywords:
        if keyword in model_upper:
            return 'MOTO'
    
    for keyword in pickup_keywords:
        if keyword in model_upper:
            return 'PICKUP'
    
    for keyword in minivan_keywords:
        if keyword in model_upper:
            return 'MINIVAN'
    
    for keyword in suv_keywords:
        if keyword in model_upper:
            return 'SUV'
    
    for keyword in sedan_keywords:
        if keyword in model_upper:
            return 'SEDAN'
    
    for keyword in hatch_keywords:
        if keyword in model_upper:
            return 'HATCH'
    
    return 'OUTROS'

# Função para extrair preço
def extract_price(price_text):
    if 'Consulte' in price_text:
        return None
    
    # Remove R$ e pontos, mantém apenas números
    price_clean = re.sub(r'[R$\s.]', '', price_text)
    price_clean = price_clean.replace(',', '.')
    
    try:
        return float(price_clean)
    except:
        return None

# Função para limpar quilometragem
def clean_mileage(mileage_text):
    mileage_clean = mileage_text.replace('.', '').replace(',', '').strip()
    try:
        return int(mileage_clean)
    except:
        return 0

# Dados extraídos das 4 páginas
vehicles_data = [
    # PÁGINA 1
    {
        "brand": "RENAULT",
        "model": "KWID",
        "version": "ZEN 2",
        "year": "2025",
        "mileage": "51.985",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 62.990,00",
        "detailUrl": "/carros/Renault/Kwid/Zen-2/Renault-Kwid-Zen-2-2025-São-Paulo-Sao-Paulo-7279276.html"
    },
    {
        "brand": "FIAT",
        "model": "MOBI",
        "version": "TREKKING 1.0 MT",
        "year": "2025",
        "mileage": "28.749",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 75.990,00",
        "detailUrl": "/carros/Fiat/Mobi/Trekking-10-Mt/Fiat-Mobi-Trekking-10-Mt-2025-São-Paulo-Sao-Paulo-7413057.html"
    },
    {
        "brand": "CAOA CHERY",
        "model": "TIGGO",
        "version": "5X PRO 1.5 TURBO FLEX AUT",
        "year": "2025",
        "mileage": "1",
        "fuel": "HÍBRIDO",
        "color": "PRETO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Caoa-Chery/Tiggo/5x-Pro-15-Turbo-Flex-Aut/Caoa-Chery-Tiggo-5x-Pro-15-Turbo-Flex-Aut-2025-São-Paulo-Sao-Paulo-6927275.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "ONIX",
        "version": "HATCH PREM. 1.0 12V TB FLEX 5P AUT.",
        "year": "2024",
        "mileage": "57.869",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 95.990,00",
        "detailUrl": "/carros/Chevrolet/Onix/Hatch-Prem-10-12v-Tb-Flex-5p-Aut/Chevrolet-Onix-Hatch-Prem-10-12v-Tb-Flex-5p-Aut-2024-São-Paulo-Sao-Paulo-7320201.html"
    },
    {
        "brand": "TOYOTA",
        "model": "RAV4",
        "version": "H 25L SX4WD",
        "year": "2024",
        "mileage": "34.277",
        "fuel": "ELÉTRICO",
        "color": "BRANCO",
        "price": "R$ 270.990,00",
        "detailUrl": "/carros/Toyota/Rav4h/25l-Sx4wd/Toyota-Rav4h-25l-Sx4wd-2024-São-Paulo-Sao-Paulo-7470524.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "HB20S",
        "version": "COMFORT PLUS 1.0 TB FLEX 12V AUT",
        "year": "2024",
        "mileage": "1",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Hyundai/Hb20s/Comfort-Plus-10-Tb-Flex-12v-Aut/Hyundai-Hb20s-Comfort-Plus-10-Tb-Flex-12v-Aut-2024-São-Paulo-Sao-Paulo-7541362.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "CRETA",
        "version": "COMFORT 1.0 TB 12V FLEX AUT.",
        "year": "2024",
        "mileage": "40.353",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 98.990,00",
        "detailUrl": "/carros/Hyundai/Creta/Comfort-10-Tb-12v-Flex-Aut/Hyundai-Creta-Comfort-10-Tb-12v-Flex-Aut-2024-São-Paulo-Sao-Paulo-6907905.html"
    },
    {
        "brand": "TOYOTA",
        "model": "YARIS",
        "version": "SA XL15LIVE",
        "year": "2024",
        "mileage": "14.373",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 81.990,00",
        "detailUrl": "/carros/Toyota/Yaris/Sa-Xl15live/Toyota-Yaris-Sa-Xl15live-2024-São-Paulo-Sao-Paulo-7462768.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "TRACKER",
        "version": "PREMIER 1.2 TURBO 12V FLEX AUT",
        "year": "2024",
        "mileage": "37.736",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 113.990,00",
        "detailUrl": "/carros/Chevrolet/Tracker/Premier-12-Turbo-12v-Flex-Aut/Chevrolet-Tracker-Premier-12-Turbo-12v-Flex-Aut-2024-São-Paulo-Sao-Paulo-6812958.html"
    },
    {
        "brand": "JEEP",
        "model": "RENEGADE",
        "version": "LGTD T270",
        "year": "2024",
        "mileage": "47.567",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 98.990,00",
        "detailUrl": "/carros/Jeep/Renegade/Lgtd-T270/Jeep-Renegade-Lgtd-T270-2024-São-Paulo-Sao-Paulo-7389966.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "CRETA",
        "version": "1.0 TGDI AT6 PLATINUM",
        "year": "2023",
        "mileage": "24.821",
        "fuel": "FLEX",
        "color": "AZUL",
        "price": "R$ 114.990,00",
        "detailUrl": "/carros/Hyundai/Creta/10-Tgdi-At6-Platinum/Hyundai-Creta-10-Tgdi-At6-Platinum-2023-São-Paulo-Sao-Paulo-6830760.html"
    },
    {
        "brand": "RENAULT",
        "model": "DUSTER",
        "version": "ZEN 1.6 CVT",
        "year": "2022",
        "mileage": "105.444",
        "fuel": "FLEX",
        "color": "MARROM",
        "price": "R$ 81.990,00",
        "detailUrl": "/carros/Renault/Duster/Zen-16-Cvt/Renault-Duster-Zen-16-Cvt-2022-São-Paulo-Sao-Paulo-7547218.html"
    },
    {
        "brand": "FIAT",
        "model": "STRADA",
        "version": "FREEDOM 13CS",
        "year": "2022",
        "mileage": "74.775",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 76.990,00",
        "detailUrl": "/carros/Fiat/Strada/Freedom-13cs/Fiat-Strada-Freedom-13cs-2022-São-Paulo-Sao-Paulo-7415855.html"
    },
    {
        "brand": "KIA",
        "model": "STONIC",
        "version": "SX 1.0 TB AUT. (HÍBRIDO)",
        "year": "2022",
        "mileage": "30.134",
        "fuel": "HÍBRIDO",
        "color": "AZUL",
        "price": "R$ 88.990,00",
        "detailUrl": "/carros/Kia/Stonic/Sx-10-Tb-Aut-(hibrido)/Kia-Stonic-Sx-10-Tb-Aut-(hibrido)-2022-São-Paulo-Sao-Paulo-6908089.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "TRACKER",
        "version": "LT 1.0 TURBO 12V FLEX AUT.",
        "year": "2021",
        "mileage": "71.034",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 96.990,00",
        "detailUrl": "/carros/Chevrolet/Tracker/Lt-10-Turbo-12v-Flex-Aut/Chevrolet-Tracker-Lt-10-Turbo-12v-Flex-Aut-2021-São-Paulo-Sao-Paulo-6748597.html"
    },
    {
        "brand": "CAOA CHERY",
        "model": "ARRIZO",
        "version": "6 GSX 1.5 TURBO FLEX AUT.",
        "year": "2021",
        "mileage": "1",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Caoa-Chery/Arrizo/6-Gsx-15-Turbo-Flex-Aut/Caoa-Chery-Arrizo-6-Gsx-15-Turbo-Flex-Aut-2021-São-Paulo-Sao-Paulo-7112812.html"
    },
    {
        "brand": "YAMAHA",
        "model": "NEO",
        "version": "AUTOMATIC 125CC",
        "year": "2021",
        "mileage": "28.090",
        "fuel": "GASOLINA",
        "color": "PRETO",
        "price": "R$ 13.990,00",
        "detailUrl": "/motos/Yamaha/Neo/Automatic-125cc/Yamaha-Neo-Automatic-125cc-2021-São-Paulo-Sao-Paulo-6936084.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "ONIX",
        "version": "1.0 MT",
        "year": "2021",
        "mileage": "0",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Chevrolet/Onix/10-Mt/Chevrolet-Onix-10-Mt-2021-São-Paulo-Sao-Paulo-7522247.html"
    },
    {
        "brand": "FIAT",
        "model": "UNO",
        "version": "1.0 EVO ATTRACTIVE 8V FLEX 4P MANUAL",
        "year": "2021",
        "mileage": "104.362",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 51.990,00",
        "detailUrl": "/carros/Fiat/Uno/10-Evo-Attractive-8v-Flex-4p-Manual/Fiat-Uno-10-Evo-Attractive-8v-Flex-4p-Manual-2021-São-Paulo-Sao-Paulo-7510141.html"
    },
    {
        "brand": "FIAT",
        "model": "TORO",
        "version": "VOLCANO AT9 D4",
        "year": "2021",
        "mileage": "162.133",
        "fuel": "DIESEL",
        "color": "PRETO",
        "price": "R$ 105.990,00",
        "detailUrl": "/carros/Fiat/Toro/Volcano-At9-D4/Fiat-Toro-Volcano-At9-D4-2021-São-Paulo-Sao-Paulo-7451524.html"
    },
    # PÁGINA 2
    {
        "brand": "FIAT",
        "model": "UNO",
        "version": "ATTRACTIVE 1.0",
        "year": "2021",
        "mileage": "113.457",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 52.990,00",
        "detailUrl": "/carros/Fiat/Uno/Attractive-10/Fiat-Uno-Attractive-10-2021-São-Paulo-Sao-Paulo-7439016.html"
    },
    {
        "brand": "JEEP",
        "model": "RENEGADE",
        "version": "LIMITED AT",
        "year": "2020",
        "mileage": "59.352",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 82.990,00",
        "detailUrl": "/carros/Jeep/Renegade/Limited-At/Jeep-Renegade-Limited-At-2020-São-Paulo-Sao-Paulo-7555522.html"
    },
    {
        "brand": "VOLKSWAGEN",
        "model": "T-CROSS",
        "version": "SENSE TSI AD",
        "year": "2020",
        "mileage": "25.000",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 93.990,00",
        "detailUrl": "/carros/Volkswagen/T-Cross/Sense-Tsi-Ad/Volkswagen-T-Cross-Sense-Tsi-Ad-2020-São-Paulo-Sao-Paulo-7557278.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "HB20S",
        "version": "1.0 M COMFORT",
        "year": "2019",
        "mileage": "129.096",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 62.990,00",
        "detailUrl": "/carros/Hyundai/Hb20s/10-M-Comfort/Hyundai-Hb20s-10-M-Comfort-2019-São-Paulo-Sao-Paulo-7189697.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "HB20",
        "version": "1.6A COMF",
        "year": "2019",
        "mileage": "117.617",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 67.990,00",
        "detailUrl": "/carros/Hyundai/Hb20/16a-Comf/Hyundai-Hb20-16a-Comf-2019-São-Paulo-Sao-Paulo-7090325.html"
    },
    {
        "brand": "KIA",
        "model": "SPORTAGE",
        "version": "EX2 FFG3",
        "year": "2019",
        "mileage": "1",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Kia/Sportage/Ex2-Ffg3/Kia-Sportage-Ex2-Ffg3-2019-São-Paulo-Sao-Paulo-7460314.html"
    },
    {
        "brand": "VOLKSWAGEN",
        "model": "VOYAGE",
        "version": "1.6 MSI FLEX 8V 4P",
        "year": "2018",
        "mileage": "175.547",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 50.990,00",
        "detailUrl": "/carros/Volkswagen/Voyage/16-Msi-Flex-8v-4p/Volkswagen-Voyage-16-Msi-Flex-8v-4p-2018-São-Paulo-Sao-Paulo-7390216.html"
    },
    {
        "brand": "RENAULT",
        "model": "LOGAN",
        "version": "EXPR 1016V",
        "year": "2018",
        "mileage": "232.141",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 40.990,00",
        "detailUrl": "/carros/Renault/Logan/Expr-1016v/Renault-Logan-Expr-1016v-2018-São-Paulo-Sao-Paulo-7472135.html"
    },
    {
        "brand": "TOYOTA",
        "model": "COROLLA",
        "version": "XEI 20FLEX",
        "year": "2018",
        "mileage": "70.123",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 108.990,00",
        "detailUrl": "/carros/Toyota/Corolla/Xei-20flex/Toyota-Corolla-Xei-20flex-2018-São-Paulo-Sao-Paulo-7391590.html"
    },
    {
        "brand": "RENAULT",
        "model": "KWID",
        "version": "INTENSE 1.0 MT",
        "year": "2018",
        "mileage": "35.427",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Renault/Kwid/Intense-10-Mt/Renault-Kwid-Intense-10-Mt-2018-São-Paulo-Sao-Paulo-7524715.html"
    },
    {
        "brand": "SSANGYONG",
        "model": "KORANDO",
        "version": "C AT",
        "year": "2018",
        "mileage": "77.924",
        "fuel": "DIESEL",
        "color": "BRANCO",
        "price": "R$ 70.990,00",
        "detailUrl": "/carros/Ssangyong/Korando/C-At/Ssangyong-Korando-C-At-2018-São-Paulo-Sao-Paulo-6830859.html"
    },
    {
        "brand": "TOYOTA",
        "model": "PRIUS",
        "version": "HYBRID 1.8 16V 5P AUT",
        "year": "2018",
        "mileage": "90.401",
        "fuel": "HÍBRIDO",
        "color": "PRATA",
        "price": "R$ 86.990,00",
        "detailUrl": "/carros/Toyota/Prius/Hybrid-18-16v-5p-Aut/Toyota-Prius-Hybrid-18-16v-5p-Aut-2018-São-Paulo-Sao-Paulo-6887185.html"
    },
    {
        "brand": "FORD",
        "model": "FIESTA",
        "version": "16SE",
        "year": "2018",
        "mileage": "145.323",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 52.990,00",
        "detailUrl": "/carros/Ford/Fiesta/16se/Ford-Fiesta-16se-2018-São-Paulo-Sao-Paulo-7286784.html"
    },
    {
        "brand": "JEEP",
        "model": "COMPASS",
        "version": "LONGITUDE F",
        "year": "2018",
        "mileage": "109.600",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 89.990,00",
        "detailUrl": "/carros/Jeep/Compass/Longitude-F/Jeep-Compass-Longitude-F-2018-São-Paulo-Sao-Paulo-7506446.html"
    },
    {
        "brand": "FORD",
        "model": "ECOSPORT",
        "version": "1.5 SE AUT",
        "year": "2018",
        "mileage": "142.980",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 65.990,00",
        "detailUrl": "/carros/Ford/Ecosport/15-Se-Aut/Ford-Ecosport-15-Se-Aut-2018-São-Paulo-Sao-Paulo-7411489.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "HB20S",
        "version": "1.0M COMF",
        "year": "2017",
        "mileage": "137.290",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 58.990,00",
        "detailUrl": "/carros/Hyundai/Hb20s/10m-Comf/Hyundai-Hb20s-10m-Comf-2017-São-Paulo-Sao-Paulo-7483908.html"
    },
    {
        "brand": "CITROEN",
        "model": "AIRCROSS",
        "version": "A FEEL",
        "year": "2017",
        "mileage": "83.689",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 54.990,00",
        "detailUrl": "/carros/Citroen/Aircross/A-Feel/Citroen-Aircross-A-Feel-2017-São-Paulo-Sao-Paulo-6248716.html"
    },
    {
        "brand": "VOLKSWAGEN",
        "model": "FOX",
        "version": "TL MCV",
        "year": "2017",
        "mileage": "898.581",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 53.990,00",
        "detailUrl": "/carros/Volkswagen/Fox/Tl-Mcv/Volkswagen-Fox-Tl-Mcv-2017-São-Paulo-Sao-Paulo-7565690.html"
    },
    {
        "brand": "FIAT",
        "model": "UNO",
        "version": "ATTRACTIVE 1.0",
        "year": "2016",
        "mileage": "142.416",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 40.990,00",
        "detailUrl": "/carros/Fiat/Uno/Attractive-10/Fiat-Uno-Attractive-10-2016-São-Paulo-Sao-Paulo-7412248.html"
    },
    {
        "brand": "HONDA",
        "model": "CIVIC",
        "version": "EXR",
        "year": "2016",
        "mileage": "123.345",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 89.990,00",
        "detailUrl": "/carros/Honda/Civic/Exr/Honda-Civic-Exr-2016-São-Paulo-Sao-Paulo-7412964.html"
    },
    # PÁGINA 3
    {
        "brand": "CHEVROLET",
        "model": "ONIX",
        "version": "1.4 MPFI LTZ 8V FLEX 4P MEC",
        "year": "2016",
        "mileage": "160.344",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 55.990,00",
        "detailUrl": "/carros/Chevrolet/Onix/14-Mpfi-Ltz-8v-Flex-4p-Mec/Chevrolet-Onix-14-Mpfi-Ltz-8v-Flex-4p-Mec-2016-São-Paulo-Sao-Paulo-7465584.html"
    },
    {
        "brand": "HONDA",
        "model": "HR-V",
        "version": "EX CVT",
        "year": "2016",
        "mileage": "117.071",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 85.990,00",
        "detailUrl": "/carros/Honda/Hr-v/Ex-Cvt/Honda-Hr-v-Ex-Cvt-2016-São-Paulo-Sao-Paulo-7470466.html"
    },
    {
        "brand": "FORD",
        "model": "FOCUS",
        "version": "SEDAN 2.0 SE PLUS 16V FLEX 4P POWERSHIFT",
        "year": "2015",
        "mileage": "103.300",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 56.990,00",
        "detailUrl": "/carros/Ford/Focus/Sedan-20-Se-Plus-16v-Flex-4p-Powershift/Ford-Focus-Sedan-20-Se-Plus-16v-Flex-4p-Powershift-2015-São-Paulo-Sao-Paulo-6195382.html"
    },
    {
        "brand": "HONDA",
        "model": "CITY",
        "version": "1.5 LX 16V FLEX 4P AUT",
        "year": "2015",
        "mileage": "133.829",
        "fuel": "FLEX",
        "color": "MARROM",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Honda/City/15-Lx-16v-Flex-4p-Aut/Honda-City-15-Lx-16v-Flex-4p-Aut-2015-São-Paulo-Sao-Paulo-7462795.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "CRUZE",
        "version": "LTZ NB AT",
        "year": "2015",
        "mileage": "163.310",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 64.990,00",
        "detailUrl": "/carros/Chevrolet/Cruze/Ltz-Nb-At/Chevrolet-Cruze-Ltz-Nb-At-2015-São-Paulo-Sao-Paulo-6905766.html"
    },
    {
        "brand": "FIAT",
        "model": "IDEA",
        "version": "ATTRACTIVE 1.4",
        "year": "2014",
        "mileage": "176.620",
        "fuel": "FLEX",
        "color": "BEGE",
        "price": "R$ 40.990,00",
        "detailUrl": "/carros/Fiat/Idea/Attractive-14/Fiat-Idea-Attractive-14-2014-São-Paulo-Sao-Paulo-7249294.html"
    },
    {
        "brand": "FORD",
        "model": "FIESTA",
        "version": "1.6 SE POWER SHIFT",
        "year": "2014",
        "mileage": "0",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Ford/Fiesta/16-Se-Power-Shift/Ford-Fiesta-16-Se-Power-Shift-2014-São-Paulo-Sao-Paulo-6757513.html"
    },
    {
        "brand": "CITROEN",
        "model": "C3",
        "version": "90M ORIGINE",
        "year": "2014",
        "mileage": "103.919",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 34.990,00",
        "detailUrl": "/carros/Citroen/C3-90m/Origine/Citroen-C3-90m-Origine-2014-São-Paulo-Sao-Paulo-6474259.html"
    },
    {
        "brand": "FORD",
        "model": "FIESTA",
        "version": "FLEX",
        "year": "2014",
        "mileage": "139.126",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 37.990,00",
        "detailUrl": "/carros/Ford/Fiesta/Flex/Ford-Fiesta-Flex-2014-São-Paulo-Sao-Paulo-7346992.html"
    },
    {
        "brand": "TOYOTA",
        "model": "COROLLA",
        "version": "XEI 20FLEX",
        "year": "2014",
        "mileage": "97.327",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 70.990,00",
        "detailUrl": "/carros/Toyota/Corolla/Xei-20flex/Toyota-Corolla-Xei-20flex-2014-São-Paulo-Sao-Paulo-7464889.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "CRUZE",
        "version": "LT NB",
        "year": "2014",
        "mileage": "102.603",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 62.990,00",
        "detailUrl": "/carros/Chevrolet/Cruze/Lt-Nb/Chevrolet-Cruze-Lt-Nb-2014-São-Paulo-Sao-Paulo-7416063.html"
    },
    {
        "brand": "FIAT",
        "model": "FREEMONT",
        "version": "PREC AT6",
        "year": "2014",
        "mileage": "163.474",
        "fuel": "GASOLINA",
        "color": "PRATA",
        "price": "R$ 52.990,00",
        "detailUrl": "/carros/Fiat/Freemont/Prec-At6/Fiat-Freemont-Prec-At6-2014-São-Paulo-Sao-Paulo-7452053.html"
    },
    {
        "brand": "TOYOTA",
        "model": "ETIOS",
        "version": "1.3 HBX 16V FLEX 4P MANUAL",
        "year": "2014",
        "mileage": "89.899",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 36.990,00",
        "detailUrl": "/carros/Toyota/Etios/13-Hbx-16v-Flex-4p-Manual/Toyota-Etios-13-Hbx-16v-Flex-4p-Manual-2014-São-Paulo-Sao-Paulo-7482783.html"
    },
    {
        "brand": "NISSAN",
        "model": "SENTRA",
        "version": "20SL CVT",
        "year": "2014",
        "mileage": "1",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Nissan/Sentra/20sl-Cvt/Nissan-Sentra-20sl-Cvt-2014-São-Paulo-Sao-Paulo-7570541.html"
    },
    {
        "brand": "HYUNDAI",
        "model": "TUCSON",
        "version": "GLS 2.0",
        "year": "2013",
        "mileage": "143.476",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 51.990,00",
        "detailUrl": "/carros/Hyundai/Tucson/Gls-20/Hyundai-Tucson-Gls-20-2013-São-Paulo-Sao-Paulo-7457363.html"
    },
    {
        "brand": "VOLKSWAGEN",
        "model": "FOX",
        "version": "1.6 GII",
        "year": "2013",
        "mileage": "133.052",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 44.990,00",
        "detailUrl": "/carros/Volkswagen/Fox/16-Gii/Volkswagen-Fox-16-Gii-2013-São-Paulo-Sao-Paulo-7542734.html"
    },
    {
        "brand": "FORD",
        "model": "FIESTA",
        "version": "1.0 MPI CLASS HATCH 8V FLEX 4P MANUAL",
        "year": "2013",
        "mileage": "107.662",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 32.990,00",
        "detailUrl": "/carros/Ford/Fiesta/10-Mpi-Class-Hatch-8v-Flex-4p-Manual/Ford-Fiesta-10-Mpi-Class-Hatch-8v-Flex-4p-Manual-2013-São-Paulo-Sao-Paulo-7523011.html"
    },
    {
        "brand": "FIAT",
        "model": "PUNTO",
        "version": "ESSENCE 1.6",
        "year": "2013",
        "mileage": "152.784",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 40.990,00",
        "detailUrl": "/carros/Fiat/Punto/Essence-16/Fiat-Punto-Essence-16-2013-São-Paulo-Sao-Paulo-7570615.html"
    },
    {
        "brand": "KIA",
        "model": "SOUL",
        "version": "EX 1.6 FF MT",
        "year": "2012",
        "mileage": "168.479",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 43.990,00",
        "detailUrl": "/carros/Kia/Kia/Soul-Ex-16-Ff-Mt/Kia-Kia-Soul-Ex-16-Ff-Mt-2012-São-Paulo-Sao-Paulo-7555076.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "CELTA",
        "version": "1.0L LS",
        "year": "2012",
        "mileage": "106.700",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Chevrolet/Celta/10l-Ls/Chevrolet-Celta-10l-Ls-2012-São-Paulo-Sao-Paulo-7514332.html"
    },
    # PÁGINA 4
    {
        "brand": "NISSAN",
        "model": "GRAND LIVINA",
        "version": "18SL",
        "year": "2012",
        "mileage": "165.619",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 43.990,00",
        "detailUrl": "/carros/Nissan/Grand/Livina-18sl/Nissan-Grand-Livina-18sl-2012-São-Paulo-Sao-Paulo-7537188.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "MERIVA",
        "version": "MAXX 1.4 8V 4P",
        "year": "2012",
        "mileage": "0",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Chevrolet/Meriva/Maxx-14-8v-4p/Chevrolet-Meriva-Maxx-14-8v-4p-2012-São-Paulo-Sao-Paulo-7544134.html"
    },
    {
        "brand": "MITSUBISHI",
        "model": "PAJERO",
        "version": "TR4 FL 2WD HP",
        "year": "2012",
        "mileage": "143.815",
        "fuel": "FLEX",
        "color": "BRANCO",
        "price": "R$ 59.990,00",
        "detailUrl": "/carros/Mitsubishi/Pajero/Tr4-Fl-2wd-Hp/Mitsubishi-Pajero-Tr4-Fl-2wd-Hp-2012-São-Paulo-Sao-Paulo-7399245.html"
    },
    {
        "brand": "NISSAN",
        "model": "GRAND LIVINA",
        "version": "18SL",
        "year": "2012",
        "mileage": "170.391",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 46.990,00",
        "detailUrl": "/carros/Nissan/Grand/Livina-18sl/Nissan-Grand-Livina-18sl-2012-São-Paulo-Sao-Paulo-7389913.html"
    },
    {
        "brand": "FORD",
        "model": "FIESTA",
        "version": "1.0 8V FLEX 5P",
        "year": "2012",
        "mileage": "90.126",
        "fuel": "FLEX",
        "color": "VERMELHO",
        "price": "R$ 35.990,00",
        "detailUrl": "/carros/Ford/Fiesta/10-8v-Flex-5p/Ford-Fiesta-10-8v-Flex-5p-2012-São-Paulo-Sao-Paulo-7456164.html"
    },
    {
        "brand": "FORD",
        "model": "ECOSPORT",
        "version": "2.0 XLT 16V FLEX 4P AUTOMATICO",
        "year": "2011",
        "mileage": "174.226",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ 39.990,00",
        "detailUrl": "/carros/Ford/Ecosport/20-Xlt-16v-Flex-4p-Automatico/Ford-Ecosport-20-Xlt-16v-Flex-4p-Automatico-2011-São-Paulo-Sao-Paulo-7316640.html"
    },
    {
        "brand": "FORD",
        "model": "KA",
        "version": "1.0",
        "year": "2011",
        "mileage": "144.046",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Ford/Ka-10//Ford-Ka-10-2011-São-Paulo-Sao-Paulo-7392531.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "CELTA",
        "version": "4P SPIRIT",
        "year": "2011",
        "mileage": "0",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Chevrolet/Celta/4p-Spirit/Chevrolet-Celta-4p-Spirit-2011-São-Paulo-Sao-Paulo-7457362.html"
    },
    {
        "brand": "PEUGEOT",
        "model": "207",
        "version": "1.4 XR 8V FLEX 4P MANUAL",
        "year": "2011",
        "mileage": "1",
        "fuel": "FLEX",
        "color": "PRETO",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Peugeot/207/14-Xr-8v-Flex-4p-Manual/Peugeot-207-14-Xr-8v-Flex-4p-Manual-2011-São-Paulo-Sao-Paulo-7504355.html"
    },
    {
        "brand": "VOLKSWAGEN",
        "model": "VOYAGE",
        "version": "NOVO 1.0",
        "year": "2011",
        "mileage": "147.000",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ Consulte",
        "detailUrl": "/carros/Volkswagen/Novo/Voyage-10/Volkswagen-Novo-Voyage-10-2011-São-Paulo-Sao-Paulo-7491434.html"
    },
    {
        "brand": "FIAT",
        "model": "PALIO",
        "version": "FIRE ECONOMY",
        "year": "2010",
        "mileage": "210.018",
        "fuel": "FLEX",
        "color": "VERDE",
        "price": "R$ 29.990,00",
        "detailUrl": "/carros/Fiat/Fiat/Palio-Fire-Economy/Fiat-Fiat-Palio-Fire-Economy-2010-São-Paulo-Sao-Paulo-7371857.html"
    },
    {
        "brand": "TOYOTA",
        "model": "COROLLA",
        "version": "XEI18FLEX",
        "year": "2009",
        "mileage": "125.393",
        "fuel": "FLEX",
        "color": "CINZA",
        "price": "R$ 49.990,00",
        "detailUrl": "/carros/Toyota/Corolla/Xei18flex/Toyota-Corolla-Xei18flex-2009-São-Paulo-Sao-Paulo-6939688.html"
    },
    {
        "brand": "CHEVROLET",
        "model": "CELTA",
        "version": "1.0 VHC 2P",
        "year": "2008",
        "mileage": "201.202",
        "fuel": "FLEX",
        "color": "PRATA",
        "price": "R$ 23.990,00",
        "detailUrl": "/carros/Chevrolet/Celta/10-Vhc-2p/Chevrolet-Celta-10-Vhc-2p-2008-São-Paulo-Sao-Paulo-7536946.html"
    }
]

# Processar os dados
vehicles = []
for vehicle in vehicles_data:
    # Normalizar combustível
    fuel = vehicle['fuel'].upper()
    if 'ELÉTRICO' in fuel or 'ELETRICO' in fuel:
        fuel = 'ELÉTRICO'
    elif 'HÍBRIDO' in fuel or 'HIBRIDO' in fuel:
        fuel = 'HÍBRIDO'
    
    vehicles.append({
        "brand": vehicle['brand'],
        "model": vehicle['model'],
        "version": vehicle['version'],
        "year": int(vehicle['year']),
        "mileage": clean_mileage(vehicle['mileage']),
        "fuel": fuel,
        "color": vehicle['color'],
        "price": extract_price(vehicle['price']),
        "detailUrl": "https://robustcar.com.br" + vehicle['detailUrl'],
        "category": detect_category(vehicle['model'])
    })

# Gerar estatísticas
total = len(vehicles)
categories = {}
for v in vehicles:
    cat = v['category']
    categories[cat] = categories.get(cat, 0) + 1

# Salvar JSON
output_path = '/home/rafaelnovaes22/faciliauto-mvp-v2/scripts/robustcar-vehicles.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(vehicles, f, ensure_ascii=False, indent=2)

print(f"✅ Scraping completo!")
print(f"\n📊 RESUMO:")
print(f"Total de veículos extraídos: {total}")
print(f"\n📈 Distribuição por categoria:")
for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
    print(f"  {cat}: {count}")

print(f"\n💾 Arquivo salvo em: {output_path}")

print(f"\n🚗 Exemplos de veículos:")
for i, v in enumerate(vehicles[:3], 1):
    print(f"\n{i}. {v['brand']} {v['model']} {v['version']}")
    print(f"   Ano: {v['year']} | KM: {v['mileage']:,}")
    print(f"   Combustível: {v['fuel']} | Cor: {v['color']}")
    print(f"   Preço: {'R$ {:,.2f}'.format(v['price']) if v['price'] else 'Consulte'}")
    print(f"   Categoria: {v['category']}")
    print(f"   URL: {v['detailUrl']}")
