import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './core/i18n';
import { router } from './router';
import { pinia } from './store';
import { permissionDirective } from './core/permission/permission.directive';
import './design-system/tokens/light.css';
import './design-system/tokens/dark.css';
import './design-system/tokens/spacing.css';
import './design-system/styles/base.css';
import './design-system/styles/list-page.css';
import { installErrorFeedback } from './core/error/error-feedback';
import { appDescription, appName } from './core/config/app-runtime';

document.title = appName;
document.querySelector('meta[name="description"]')?.setAttribute('content', appDescription);

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(i18n);
app.directive('permission', permissionDirective);
installErrorFeedback(app);

app.mount('#app');
