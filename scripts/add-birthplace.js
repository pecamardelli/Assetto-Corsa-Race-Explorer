const fs = require('fs');
const path = require('path');

// Cities by country/nationality
const citiesByNation = {
  'Argentina': ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'San Miguel de Tucumán', 'Mar del Plata'],
  'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges'],
  'Bolivia': ['La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre', 'Oruro', 'Potosí'],
  'Brazil': ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre'],
  'Chile': ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Viña del Mar'],
  'China': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xian'],
  'Croatia': ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Dubrovnik'],
  'Czech': ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc'],
  'German': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig'],
  'Danish': ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers'],
  'Ecuadorian': ['Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala', 'Manta'],
  'Spanish': ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Bilbao', 'Murcia', 'Alicante', 'Granada'],
  'French': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux'],
  'British': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Newcastle', 'Bristol', 'Sheffield', 'Nottingham'],
  'Georgian': ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Gori', 'Zugdidi'],
  'Greek': ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa', 'Volos'],
  'Croatian': ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Dubrovnik'],
  'Iranian': ['Tehran', 'Mashhad', 'Isfahan', 'Karaj', 'Shiraz', 'Tabriz', 'Qom'],
  'Irish': ['Dublin', 'Cork', 'Limerick', 'Galway', 'Waterford', 'Drogheda', 'Dundalk'],
  'Italian': ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Venice', 'Verona', 'Catania'],
  'Japanese': ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto', 'Hiroshima'],
  'Kenyan': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika'],
  'Mexican': ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida'],
  'Nigerian': ['Lagos', 'Kano', 'Ibadan', 'Abuja', 'Port Harcourt', 'Benin City', 'Kaduna'],
  'Dutch': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg'],
  'Panamanian': ['Panama City', 'San Miguelito', 'Tocumen', 'David', 'Arraiján', 'Colón'],
  'Polish': ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin'],
  'Romanian': ['Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov'],
  'Russian': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara'],
  'Scottish': ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling'],
  'Swedish': ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping'],
  'Turkish': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 'Antalya'],
  'Emirati': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'],
  'Ukrainian': ['Kyiv', 'Kharkiv', 'Odesa', 'Dnipro', 'Lviv', 'Zaporizhzhia', 'Kryvyi Rih'],
  'American': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Charlotte', 'Seattle', 'Denver', 'Boston', 'Detroit', 'Portland', 'Las Vegas', 'Miami', 'Atlanta'],
  'Venezuelan': ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Ciudad Guayana', 'Maturín']
};

function getRandomCity(nationality) {
  const cities = citiesByNation[nationality];
  if (!cities || cities.length === 0) {
    return 'Unknown';
  }
  return cities[Math.floor(Math.random() * cities.length)];
}

const profilesDir = 'app/lib/driver-profiles';
const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(profilesDir, file);
  const driver = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  driver.placeOfBirth = getRandomCity(driver.nationality);

  fs.writeFileSync(filePath, JSON.stringify(driver, null, 2), 'utf8');
});

console.log(`Updated ${files.length} driver profiles with place of birth`);
