// ☢️ THE FINAL PURGE: Hardcore Service Worker Bypass
// This script runs inside the Service Worker and short-circuits any fetch for 'ws-server'

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/ws-server') || event.request.url.includes('socket.io')) {
    console.log('⚡ SW Bypass: Short-circuiting socket traffic:', event.request.url);
    // Returning nothing allows the browser to handle the request normally via network
    return;
  }
});

console.log('☢️ The Final Purge: Socket bypass listener active.');
