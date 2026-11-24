require('dotenv').config();
const axios = require('axios');

async function test(name, query, variables) {
  console.log('\n--- TEST:', name, '---');
  try {
    const r = await axios.post('https://stashdb.org/graphql',
      { query, variables },
      { headers: { 'apikey': process.env.STASHDB_API_KEY, 'Content-Type': 'application/json' } }
    );
    if (r.data.errors) {
      console.log('GraphQL errors:', JSON.stringify(r.data.errors, null, 2));
    } else {
      console.log('OK, gelen sahne:', r.data.data.queryScenes.scenes.length, 'count:', r.data.data.queryScenes.count);
      console.log('İlk sahne:', r.data.data.queryScenes.scenes[0]?.title, '| studio:', r.data.data.queryScenes.scenes[0]?.studio?.name, '| date:', r.data.data.queryScenes.scenes[0]?.date);
    }
  } catch (e) {
    console.log('HTTP hata:', e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }
}

async function run() {
  const fields = `scenes { id title date studio { id name } } count`;

  // 1 - studios direkt input içinde (doğrusu bu olmalı)
  await test('studios direkt', `query QueryScenes($page: Int!, $studioId: ID!) { queryScenes(input: { page: $page, per_page: 5, sort: DATE, direction: DESC, studios: { value: [$studioId], modifier: INCLUDES } }) { ${fields} } }`, { page: 1, studioId: '39cee498-a9ac-4403-910a-1a0157ad22d8' });

  // 2 - parentStudio direkt (alternatif)
  await test('parentStudio direkt', `query QueryScenes($page: Int!, $studioId: ID!) { queryScenes(input: { page: $page, per_page: 5, sort: DATE, direction: DESC, parentStudio: $studioId }) { ${fields} } }`, { page: 1, studioId: '39cee498-a9ac-4403-910a-1a0157ad22d8' });
}
run();