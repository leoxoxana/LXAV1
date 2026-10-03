// Moved out of index.html so the Content-Security-Policy can drop 'unsafe-inline' for scripts (same place in the page, same order of execution).
(function(){var p=matchMedia("(max-width:700px) and (orientation:portrait)").matches;var w=new Image();w.src=p?"assets/wild-stack.webp":"assets/wild-wide.webp";if(w.decode)w.decode().catch(function(){});})();
