import {siteRoot} from './client.js?v=22';
// Fragments never reach the HTTP server; retain old homepage section bookmarks separately.
const targets={'#doz_menu_moim':'moim/','#doz_menu_silove':'silove/'};
function route(){const target=targets[location.hash];if(target)location.replace(new URL(target,siteRoot).href)}
route();window.addEventListener('hashchange',route);
