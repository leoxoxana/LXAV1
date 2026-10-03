// Moved out of index.html so the Content-Security-Policy can drop 'unsafe-inline' for scripts (same place in the page, same order of execution).
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
