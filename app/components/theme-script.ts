/**
 * Runs in <head> before the first paint so a dark-mode visitor never sees a
 * white flash. Mirrors the logic in theme-provider.tsx.
 */
export const themeInitScript = `(function(){try{var k="surefood:theme",s=localStorage.getItem(k);if(s!=="dark"&&s!=="light"){s=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;r.setAttribute("data-theme",s);r.style.colorScheme=s;}catch(e){}})();`;
