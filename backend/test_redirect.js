import fetch from 'node-fetch';

const test = async () => {
  const url = 'https://www.geeksforgeeks.org/pcb-design-basics/';
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    const res = await fetch(url, { headers });
    console.log('Status:', res.status);
    console.log('Final URL:', res.url);
    const body = await res.text();
    console.log('Body length:', body.length);
    console.log('Contains "404" or "not found":', body.toLowerCase().includes('404') || body.toLowerCase().includes('page not found') || body.toLowerCase().includes('no results'));
    console.log('Body snippet:', body.substring(0, 1000));
  } catch (err) {
    console.error(err);
  }
};

test();
