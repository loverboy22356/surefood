/**
 * Runs in <head> before the first paint so a returning visitor who chose dark
 * never sees a white flash. Mirrors theme-provider.tsx: light is the default,
 * and only a saved choice overrides it.
 */
export const themeInitScript = `(function(){try{var k="surefood:theme",s=localStorage.getItem(k);if(s!=="dark"){s="light";}var r=document.documentElement;r.setAttribute("data-theme",s);r.style.colorScheme=s;}catch(e){}})();`;
