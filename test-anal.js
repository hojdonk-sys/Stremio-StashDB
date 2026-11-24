require('dotenv').config();

async function test(name, query, variables) {
  console.log('\n--- TEST:', name, '---');
  try {
    const r = await fetch('https://stashdb.org/graphql', {
      method: 'POST',
      headers: { 'apikey': process.env.STASHDB_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const j = await r.json();
    if (j.errors) {
      console.log('Hata:', JSON.stringify(j.errors, null, 2));
    } else {
      console.log('OK:', JSON.stringify(j.data, null, 2).slice(0, 1000));
    }
  } catch (e) {
    console.log('Hata:', e.message);
  }
}

async function run() {
  const id = 'f23972b2-6337-43cf-89fa-db78eebf008c';

  // 1 - Studio var mı, adı ne?
  await test('Studio bilgisi', `query { findStudio(id: "${id}") { id name } }`, {});

  // 2 - studios filtresi
  await test('studios filtresi', `query QueryScenes($page: Int!, $studioId: ID!) { queryScenes(input: { page: $page, per_page: 5, sort: DATE, direction: DESC, studios: { value: [$studioId], modifier: INCLUDES } }) { count scenes { id title studio { id name } } } }`, { page: 1, studioId: id });

  // 3 - parentStudio filtresi
  await test('parentStudio filtresi', `query QueryScenes($page: Int!, $studioId: String!) { queryScenes(input: { page: $page, per_page: 5, sort: DATE, direction: DESC, parentStudio: $studioId }) { count scenes { id title studio { id name } } } }`, { page: 1, studioId: id });
}
run();